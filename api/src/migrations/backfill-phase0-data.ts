import { Global, Logger, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { MongooseModule, getModelToken } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { validateEnv } from '../config/env.validation';
import { JobsService } from '../jobs/jobs.service';
import { decomposeIntoKana } from '../common/kana/decompose';
import {
  KanaItem,
  KanaItemSchema,
  KanaItemDocument,
} from '../content/schemas/kana-item.schema';
import {
  VocabItem,
  VocabItemSchema,
  VocabItemDocument,
} from '../content/schemas/vocab-item.schema';
import {
  Lesson,
  LessonSchema,
  LessonDocument,
} from '../content/schemas/lesson.schema';

/**
 * Phase 0 — Data foundation backfill.
 *
 * Three additive writes; none are destructive; all are idempotent:
 *
 *  1. `KanaItem.taughtInLesson` — derived from every lesson that lists this
 *     kana in `itemRefs` (kind = `'kana'`). The first lesson wins (one kana
 *     belongs to one intro lesson by schema convention).
 *
 *  2. `VocabItem.constituentKana` — derived from `lemma` via
 *     `decomposeIntoKana`. Order-stable, dedup by first occurrence.
 *     Skipped when the lemma has no kana (the field stays absent, the
 *     partial index stays slim).
 *
 *  3. `User.learningState.knownKana` — initialised to `[]` for any user
 *     whose `learningState.knownKana` is absent. The whole `learningState`
 *     sub-doc is set in one write rather than a partial `knownKana` `$set`,
 *     so adding new `LearningState` fields later won't leave existing rows
 *     in a "some fields present, some absent" state.
 *
 * §5.4 rule 2: never destructive in the same commit. Nothing here `$unset`s
 * a field; nothing lowers a required status. A read after this migration
 * sees every existing document, just with the Phase 0 fields present.
 *
 * Run with `npm run migrate:phase0-data`.
 *
 * §5.4 rule 1: take a verified backup first (`scripts/backup.sh`) before
 * running this against real data. The migration is additive but the rule
 * exists so "safe" is never a judgement made in the moment.
 *
 * Idempotent: re-running on a database that already has the Phase 0 fields
 * is a no-op for fields whose target matches current, and an overwrite
 * (back to agreement with the current seed) where the target differs.
 */

const migrationJobsStub: Pick<JobsService, 'enqueue' | 'schedule'> = {
  enqueue: async (name) => {
    new Logger('Migration').warn(`Ignored background job '${name}' — no Redis here.`);
  },
  schedule: async (schedulerId) => {
    new Logger('Migration').warn(`Ignored schedule '${schedulerId}' — no Redis here.`);
  },
};

@Global()
@Module({
  providers: [{ provide: JobsService, useValue: migrationJobsStub }],
  exports: [JobsService],
})
class MigrationJobsModule {}

/**
 * Lean schema for the `users` collection, sufficient to write
 * `learningState.knownKana` and read `_id` / current state. Registered as
 * a side-channel here because importing `UserModule` pulls in the auth
 * graph (argon2, JWT, mailer) — the migration's whole design is the
 * smallest module graph that can do its work.
 *
 * Drift risk vs. `UserModule` is a known concern, shared with `seed.ts` —
 * the cut-down-root-module pattern §11 documents. The cost is paid once,
 * here, and the test that exercises `MigrationRootModule` is the guard
 * against future drift.
 *
 * `strictPropertyInitialization` is satisfied via the `!:` definite-assignment
 * assertion — Mongoose constructs the document; TypeScript just types the
 * field for our reads. The `eslint-disable` keeps the existing ruleset
 * (no-unused-variable-on-types) quiet about a class whose only purpose is
 * to define types.
 */
const UserSideCollection = 'users';

interface UserSideSchemaShape {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  _id: any;
  learningState?: { knownKana?: string[] };
}

class UserSideDocument implements UserSideSchemaShape {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  _id!: any;
  learningState!: { knownKana?: string[] };
}

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: '.env', validate: validateEnv }),
    MongooseModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        uri: config.getOrThrow<string>('MONGO_URI'),
        serverSelectionTimeoutMS: 3000,
      }),
    }),
    JwtModule.register({ global: true }),
    MigrationJobsModule,
    MongooseModule.forFeature([
      { name: KanaItem.name, schema: KanaItemSchema, collection: 'kanaItems' },
      { name: VocabItem.name, schema: VocabItemSchema, collection: 'vocabItems' },
      { name: Lesson.name, schema: LessonSchema, collection: 'lessons' },
      { name: UserSideCollection, schema: UserSideDocument },
    ]),
  ],
})
class MigrationRootModule {}

interface Phase0Report {
  kanaScanned: number;
  kanaTaughtSet: number;
  vocabScanned: number;
  vocabDecomposed: number;
  usersInitialised: number;
}

/** Stable order mapping: lesson id → its position within its unit. */
function lessonOrderById(lessons: LessonDocument[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const lesson of lessons) {
    map.set(lesson._id.toString(), lesson.order);
  }
  return map;
}

/**
 * For each kana item, find the first lesson that lists it and stamp the
 * lesson's order onto `taughtInLesson`.
 */
async function backfillKanaTaughtIn(
  kanaModel: Model<KanaItemDocument>,
  lessonOrders: Map<string, number>,
  logger: Logger,
): Promise<number> {
  // Walk all lessons once, build a map `kanaId -> first lessonId that lists it`.
  // The seed convention is one intro lesson per kana, so the first one wins.
  const kanaLessonIds = new Map<string, string>();
  const lessons = await kanaModel.db
    .collection<LessonDocument>('lessons')
    .find({})
    .toArray();
  for (const lesson of lessons) {
    for (const ref of lesson.itemRefs) {
      if (ref.kind !== 'kana') {
        continue;
      }
      const id = ref.id.toString();
      if (!kanaLessonIds.has(id)) {
        kanaLessonIds.set(id, lesson._id.toString());
      }
    }
  }

  let updated = 0;
  const kanaDocs = await kanaModel.find().lean<KanaItemDocument[]>().exec();
  for (const kana of kanaDocs) {
    const id = kana._id.toString();
    const lessonId = kanaLessonIds.get(id);
    if (!lessonId) {
      continue;
    }
    const target = lessonOrders.get(lessonId);
    if (target === undefined) {
      logger.warn(
        `kana ${kana.kana} references lesson ${lessonId}, but the lesson is gone — skipping`,
      );
      continue;
    }
    if (kana.taughtInLesson === target) {
      continue;
    }
    await kanaModel
      .updateOne({ _id: kana._id }, { $set: { taughtInLesson: target } })
      .exec();
    updated += 1;
  }
  return updated;
}

function arraysEqual(a: readonly string[] | null | undefined, b: readonly string[] | null | undefined): boolean {
  if (a === undefined || a === null) {
    return a === b;
  }
  if (b === undefined || b === null) {
    return false;
  }
  if (a.length !== b.length) {
    return false;
  }
  for (let i = 0; i < a.length; i += 1) {
    if (a[i] !== b[i]) {
      return false;
    }
  }
  return true;
}

/**
 * Walk every vocab doc; decompose `lemma` and write the result onto
 * `constituentKana`. Idempotent: skips on equality, otherwise overwrites.
 *
 * A word with no detectable kana gets the field *left absent* — the partial
 * index stays slim, and the Phase 1 filter handles "empty intersection" by
 * returning zero results rather than throwing.
 */
async function backfillVocabConstituents(
  vocabModel: Model<VocabItemDocument>,
): Promise<number> {
  let updated = 0;
  const vocabDocs = await vocabModel.find().lean<VocabItemDocument[]>().exec();
  for (const vocab of vocabDocs) {
    const target = decomposeIntoKana(vocab.lemma);
    const current = vocab.constituentKana ?? null;
    if (arraysEqual(current, target)) {
      continue;
    }
    if (target.length === 0 && current === null) {
      // Preserve the absent state — see header note.
      continue;
    }
    await vocabModel
      .updateOne({ _id: vocab._id }, { $set: { constituentKana: [...target] } })
      .exec();
    updated += 1;
  }
  return updated;
}

/**
 * Initialise `learningState.knownKana = []` for any user whose field is
 * missing. Whole sub-document in one write.
 */
async function ensureUserLearningState(model: Model<UserSideDocument>): Promise<number> {
  const result = await model
    .updateMany(
      { 'learningState.knownKana': { $exists: false } },
      { $set: { learningState: { knownKana: [] } } },
    )
    .exec();
  return result.modifiedCount ?? 0;
}

async function bootstrap(): Promise<void> {
  const logger = new Logger('Phase0Migration');
  const app = await NestFactory.createApplicationContext(MigrationRootModule, {
    logger: ['log', 'warn', 'error'],
  });

  try {
    const kanaModel = app.get<Model<KanaItemDocument>>(getModelToken(KanaItem.name));
    const vocabModel = app.get<Model<VocabItemDocument>>(getModelToken(VocabItem.name));
    const userModel = app.get<Model<UserSideDocument>>(getModelToken(UserSideCollection));

    const lessons = await kanaModel.db
      .collection<LessonDocument>('lessons')
      .find({})
      .toArray();
    const orders = lessonOrderById(lessons);

    const kanaTaughtSet = await backfillKanaTaughtIn(kanaModel, orders, logger);
    const vocabDecomposed = await backfillVocabConstituents(vocabModel);
    const usersInitialised = await ensureUserLearningState(userModel);

    const kanaScanned = await kanaModel.estimatedDocumentCount();
    const vocabScanned = await vocabModel.estimatedDocumentCount();

    const report: Phase0Report = {
      kanaScanned,
      kanaTaughtSet,
      vocabScanned,
      vocabDecomposed,
      usersInitialised,
    };

    logger.log(
      `phase0 backfill done — ` +
        `kana: ${report.kanaScanned} scanned, ${report.kanaTaughtSet} updated; ` +
        `vocab: ${report.vocabScanned} scanned, ${report.vocabDecomposed} updated; ` +
        `users: ${report.usersInitialised} initialised`,
    );
    await app.close();
    process.exit(0);
  } catch (err) {
    logger.error(
      `Phase 0 migration failed: ${err instanceof Error ? err.message : String(err)}`,
    );
    await app.close();
    process.exit(1);
  }
}

void bootstrap();

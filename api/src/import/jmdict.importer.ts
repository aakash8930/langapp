import * as fs from 'node:fs';
import * as path from 'node:path';
import { Logger, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { MongooseModule, getModelToken } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { validateEnv } from '../config/env.validation';
import {
  DictionaryEntry,
  DictionaryEntryDocument,
  DictionaryEntrySchema,
} from '../content/schemas/dictionary-entry.schema';
import { ImportRun, ImportRunSchema } from '../content/schemas/import-run.schema';
import { SourceProvenance } from '../content/schemas/source-provenance.schema';
import { parseJMdict } from './jmdict/parse-jmdict';

/**
 * Imports JMdict (data/sources.json#jmdict) into `dictionaryEntries`.
 *
 * Run with `npm run import:jmdict`. Idempotent: every write is an upsert on
 * `jmdictSeq`, JMdict's own stable entry ID, so re-running (e.g. after
 * re-downloading a newer snapshot) updates existing rows rather than
 * duplicating them.
 *
 * This writes only to the new `dictionaryEntries` collection. It never
 * touches `vocabItems` (the hand-curated lesson content) — see the schema
 * file for why that link is a deliberate future decision, not automatic.
 */

const BATCH_SIZE = 1000;
const PROGRESS_EVERY = 20; // batches

function resolveDataRawDir(): string {
  return process.env.LANGAPP_DATA_RAW_DIR ?? path.resolve(__dirname, '../../../data/raw');
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
    MongooseModule.forFeature([
      { name: DictionaryEntry.name, schema: DictionaryEntrySchema },
      { name: ImportRun.name, schema: ImportRunSchema },
    ]),
  ],
})
class JmdictImportModule {}

async function run(
  model: Model<DictionaryEntryDocument>,
  importRunModel: Model<ImportRun>,
  logger: Logger,
): Promise<void> {
  const startedAt = new Date();
  const jmdictPath = path.join(resolveDataRawDir(), 'jmdict', 'JMdict_e');
  if (!fs.existsSync(jmdictPath)) {
    throw new Error(
      `JMdict source file not found at ${jmdictPath}. See data/sources.json#jmdict for the download step, ` +
        `or set LANGAPP_DATA_RAW_DIR if data/raw/ lives somewhere else.`,
    );
  }

  logger.log(`Reading ${jmdictPath}...`);
  const raw = fs.readFileSync(jmdictPath, 'utf-8');

  logger.log('Parsing (expanding custom XML entities, then walking every <entry>)...');
  const entries = parseJMdict(raw);
  logger.log(`Parsed ${entries.length} entries.`);

  const provenance: SourceProvenance = {
    name: 'JMdict',
    sourceId: 'edrdg-jmdict',
    license: 'CC BY-SA (EDRDG Licence)',
    importedAt: new Date(),
    sourceVersion: 'snapshot 2026-08-13',
  };

  let upserted = 0;
  let failedEntries = 0;

  for (let i = 0; i < entries.length; i += BATCH_SIZE) {
    const batch = entries.slice(i, i + BATCH_SIZE);
    try {
      const result = await model.bulkWrite(
        batch.map((entry) => ({
          updateOne: {
            filter: { jmdictSeq: entry.jmdictSeq },
            update: { $set: { ...entry, source: provenance } },
            upsert: true,
          },
        })),
        { ordered: false },
      );
      upserted += (result.upsertedCount ?? 0) + (result.modifiedCount ?? 0);
    } catch (err) {
      failedEntries += batch.length;
      logger.error(
        `Batch at offset ${i} (size ${batch.length}) failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    }

    const batchNumber = i / BATCH_SIZE;
    if (batchNumber % PROGRESS_EVERY === 0) {
      logger.log(`  ...${Math.min(i + BATCH_SIZE, entries.length)}/${entries.length}`);
    }
  }

  logger.log('Ensuring indexes...');
  await model.ensureIndexes();

  logger.log(
    `Done. Parsed ${entries.length}, upserted/updated ${upserted}, failed ${failedEntries} entries ` +
      `(${entries.length - upserted - failedEntries} unchanged from a prior run).`,
  );

  await importRunModel.create({
    source: 'jmdict',
    startedAt,
    finishedAt: new Date(),
    status: failedEntries === 0 ? 'success' : upserted > 0 ? 'partial' : 'failed',
    parsed: entries.length,
    upserted,
    failed: failedEntries,
    sourceVersion: provenance.sourceVersion,
  });
}

async function bootstrap(): Promise<void> {
  const logger = new Logger('ImportJMdict');
  const app = await NestFactory.createApplicationContext(JmdictImportModule, {
    logger: ['log', 'warn', 'error'],
  });

  try {
    const model = app.get<Model<DictionaryEntryDocument>>(getModelToken(DictionaryEntry.name));
    const importRunModel = app.get<Model<ImportRun>>(getModelToken(ImportRun.name));
    await run(model, importRunModel, logger);
    await app.close();
    process.exit(0);
  } catch (err) {
    logger.error(`Import failed: ${err instanceof Error ? err.message : String(err)}`);
    await app.close();
    process.exit(1);
  }
}

void bootstrap();

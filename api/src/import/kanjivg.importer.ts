import * as fs from 'node:fs';
import * as path from 'node:path';
import { Logger, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { MongooseModule, getModelToken } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { StorageModule } from '../common/storage/storage.module';
import { StorageService } from '../common/storage/storage.service';
import { validateEnv } from '../config/env.validation';
import { ImportRun, ImportRunSchema } from '../content/schemas/import-run.schema';
import { parseKanjiVgFile } from './kanjivg/parse-kanjivg';

/**
 * Imports KanjiVG (data/sources.json#kanjivg) into object storage at
 * `strokes/<codepoint>.json` — exactly the key `strokes.controller.ts`
 * already reads from `GET /content/strokes/:codepoint`. That endpoint and
 * its client consumers (TraceCanvas, StrokeOrder) already exist; before this
 * import runs, every request 404s because nothing was ever seeded (found
 * during the 2026-08-13 platform audit). This closes that gap — no schema or
 * endpoint work needed, only data.
 *
 * Run with `npm run import:kanjivg`. Idempotent: `StorageService.put`
 * replaces whatever was at a key, so re-running (e.g. after a newer KanjiVG
 * snapshot) overwrites cleanly rather than duplicating anything.
 *
 * Source is the per-character files under `data/raw/kanjivg/repo/kanji/`,
 * not the merged `release/kanjivg.xml` — filtered to the 6,703 plain
 * `<codepoint>.svg` base forms; KanjiVG also ships ~4,900 variant renderings
 * (`-Kaisho`, `-Vt...` suffixes) that the endpoint's bare-codepoint key has
 * no way to address, so those are intentionally skipped.
 */

const BASE_FILENAME_RE = /^([0-9a-f]{5})\.svg$/;
const PROGRESS_EVERY = 1000;

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
    MongooseModule.forFeature([{ name: ImportRun.name, schema: ImportRunSchema }]),
    StorageModule,
  ],
})
class KanjiVgImportModule {}

async function run(
  storage: StorageService,
  importRunModel: Model<ImportRun>,
  logger: Logger,
): Promise<void> {
  const startedAt = new Date();
  const kanjiDir = path.join(resolveDataRawDir(), 'kanjivg', 'repo', 'kanji');
  if (!fs.existsSync(kanjiDir)) {
    throw new Error(
      `KanjiVG source directory not found at ${kanjiDir}. See data/sources.json#kanjivg for the download step, ` +
        `or set LANGAPP_DATA_RAW_DIR if data/raw/ lives somewhere else.`,
    );
  }

  const files = fs.readdirSync(kanjiDir).filter((name) => BASE_FILENAME_RE.test(name));
  logger.log(`Found ${files.length} base-form KanjiVG files in ${kanjiDir}.`);

  let written = 0;
  let failed = 0;
  const failures: string[] = [];

  for (let i = 0; i < files.length; i++) {
    const filename = files[i];
    const match = BASE_FILENAME_RE.exec(filename)!;
    const codepoint = match[1];

    try {
      const raw = fs.readFileSync(path.join(kanjiDir, filename), 'utf-8');
      const strokeData = parseKanjiVgFile(codepoint, raw);
      await storage.put(`strokes/${codepoint}.json`, Buffer.from(JSON.stringify(strokeData), 'utf-8'));
      written++;
    } catch (err) {
      failed++;
      const message = err instanceof Error ? err.message : String(err);
      failures.push(`${codepoint}: ${message}`);
      logger.error(`Failed on ${filename}: ${message}`);
    }

    if ((i + 1) % PROGRESS_EVERY === 0) {
      logger.log(`  ...${i + 1}/${files.length}`);
    }
  }

  const finishedAt = new Date();
  logger.log(`Done. ${files.length} files, ${written} written, ${failed} failed.`);

  await importRunModel.create({
    source: 'kanjivg',
    startedAt,
    finishedAt,
    status: failed === 0 ? 'success' : written > 0 ? 'partial' : 'failed',
    parsed: files.length,
    upserted: written,
    failed,
    sourceVersion: 'r20220427 (per-character repo form)',
    errorSummary: failures.length > 0 ? failures.slice(0, 20).join('; ') : undefined,
  });
}

async function bootstrap(): Promise<void> {
  const logger = new Logger('ImportKanjiVG');
  const app = await NestFactory.createApplicationContext(KanjiVgImportModule, {
    logger: ['log', 'warn', 'error'],
  });

  try {
    const storage = app.get(StorageService);
    const importRunModel = app.get<Model<ImportRun>>(getModelToken(ImportRun.name));
    await run(storage, importRunModel, logger);
    await app.close();
    process.exit(0);
  } catch (err) {
    logger.error(`Import failed: ${err instanceof Error ? err.message : String(err)}`);
    await app.close();
    process.exit(1);
  }
}

void bootstrap();

import { createHash } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import {
  REQUIRED_SEED_BASELINE,
  REQUIRED_STROKE_CHARACTERS,
  REQUIRED_UNIT_SLUGS,
} from './required-content';
import { startingRecommendation } from '../learning/starting-recommendation';

const EXPECTED_BASELINE = {
  kana: 208,
  vocab: 929,
  grammar: 32,
  kanji: 188,
  lessons: 114,
} as const;

type Manifest = {
  source: string;
  sourceRevision: string;
  license: string;
  files: Record<string, string>;
};

async function verify(): Promise<void> {
  for (const key of ['kana', 'vocab', 'grammar', 'kanji', 'lessons'] as const) {
    if (REQUIRED_SEED_BASELINE[key] !== EXPECTED_BASELINE[key]) {
      throw new Error(
        `Required ${key} baseline changed: expected ${EXPECTED_BASELINE[key]}, got ${REQUIRED_SEED_BASELINE[key]}`,
      );
    }
  }
  if (REQUIRED_SEED_BASELINE.lessons <= 0) throw new Error('No required lessons are authored');

  const unitSlugs = new Set<string>(REQUIRED_UNIT_SLUGS);
  for (const level of ['beginner', 'n5', 'n4', 'n3', 'n2', 'n1']) {
    for (const goal of ['conversation', 'reading', 'travel', 'jlpt', 'work']) {
      const recommendation = startingRecommendation({ proficiencyLevel: level, learningGoals: [goal] });
      if (!unitSlugs.has(recommendation.unit)) {
        throw new Error(`Recommendation ${level}/${goal} names missing unit ${recommendation.unit}`);
      }
    }
  }

  const strokeRoot = resolve(process.cwd(), 'storage/strokes');
  const manifest = JSON.parse(await readFile(resolve(strokeRoot, 'manifest.json'), 'utf8')) as Manifest;
  if (manifest.source !== 'KanjiVG' || manifest.license !== 'CC BY-SA 3.0') {
    throw new Error('Stroke manifest is missing its KanjiVG source/license declaration');
  }
  if (!/^[a-f0-9]{40}$/.test(manifest.sourceRevision)) {
    throw new Error('Stroke manifest sourceRevision must be an immutable Git commit');
  }

  const requiredFiles = REQUIRED_STROKE_CHARACTERS.map(
    (char) => `${char.codePointAt(0)!.toString(16).padStart(5, '0')}.json`,
  );
  const presentFiles = (await readdir(strokeRoot))
    .filter((file) => file.endsWith('.json') && file !== 'manifest.json')
    .sort();
  const manifestedFiles = Object.keys(manifest.files).sort();

  // The repository ships the full normalized KanjiVG pack so dictionary and
  // future-course characters work without another asset deployment. The
  // authored curriculum is a guaranteed subset, not an allow-list for the pack.
  // Every shipped file is still pinned by hash: accepting unmanifested extras
  // would turn a green verifier into permission to smuggle arbitrary JSON into
  // the public immutable asset route.
  if (JSON.stringify(presentFiles) !== JSON.stringify(manifestedFiles)) {
    const present = new Set(presentFiles);
    const manifested = new Set(manifestedFiles);
    const missing = manifestedFiles.filter((file) => !present.has(file));
    const unmanifested = presentFiles.filter((file) => !manifested.has(file));
    throw new Error(
      `Stroke pack differs from manifest; missing=[${missing.join(',')}], `
        + `unmanifested=[${unmanifested.join(',')}]`,
    );
  }

  const present = new Set(presentFiles);
  const missingRequired = requiredFiles.filter((file) => !present.has(file));
  if (missingRequired.length > 0) {
    throw new Error(`Stroke pack is missing taught characters: [${missingRequired.join(',')}]`);
  }

  for (const file of presentFiles) {
    const bytes = await readFile(resolve(strokeRoot, file));
    const expectedHash = manifest.files[file];
    const hash = createHash('sha256').update(bytes).digest('hex');
    if (!expectedHash || hash !== expectedHash) throw new Error(`Stroke hash mismatch: ${file}`);

    const row = JSON.parse(bytes.toString('utf8')) as { char?: string; viewBox?: string; paths?: unknown[] };
    const expectedFile = row.char
      ? `${row.char.codePointAt(0)!.toString(16).padStart(5, '0')}.json`
      : '';
    if (expectedFile !== file) throw new Error(`Wrong character in ${file}`);
    if (!row.viewBox || !Array.isArray(row.paths) || row.paths.length === 0
      || row.paths.some((path) => typeof path !== 'string' || path.length === 0)) {
      throw new Error(`Invalid stroke payload: ${file}`);
    }
  }

  console.log(
    `Required content verified: ${REQUIRED_SEED_BASELINE.lessons} lessons, `
      + `${REQUIRED_STROKE_CHARACTERS.length} taught characters within `
      + `${presentFiles.length} deterministic stroke assets.`,
  );
}

verify().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});

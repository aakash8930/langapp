import { NotFoundException } from '@nestjs/common';
import { StorageService } from '../common/storage/storage.service';
import { StrokesController } from './strokes.controller';

/**
 * The padding rule is the whole of this file's reason to exist.
 *
 * KanjiVG names its files with a five-digit zero-padded codepoint, so あ is
 * `03042.json`. A client computing `codePointAt(0).toString(16)` gets the
 * natural four digits, `3042`. The first deploy passed the parameter straight
 * through and every request 404'd — a bug that could not fail in typecheck,
 * could not fail in a build, and looked exactly like "this character has no
 * stroke data", which is a legitimate state.
 */
function makeController(files: Record<string, string>) {
  const asked: string[] = [];
  const storage = {
    get: (key: string) => {
      asked.push(key);
      const found = files[key];
      return found === undefined
        ? Promise.reject(new Error('missing'))
        : Promise.resolve(Buffer.from(found, 'utf-8'));
    },
  } as unknown as StorageService;

  return { controller: new StrokesController(storage), asked };
}

const A = JSON.stringify({ char: 'あ', viewBox: '0 0 109 109', paths: ['M1', 'M2', 'M3'] });

describe('StrokesController', () => {
  it('finds a character from the four digits a client naturally computes', async () => {
    // `'あ'.codePointAt(0).toString(16)` is exactly this — no padding.
    const { controller, asked } = makeController({ 'strokes/03042.json': A });

    await expect(controller.strokes('3042')).resolves.toContain('あ');
    expect(asked).toEqual(['strokes/03042.json']);
  });

  it('also accepts the already-padded five digits', async () => {
    const { controller } = makeController({ 'strokes/03042.json': A });

    await expect(controller.strokes('03042')).resolves.toContain('あ');
  });

  it('is case-insensitive, since hex from either side may be upper', async () => {
    const { controller } = makeController({ 'strokes/030a2.json': A });

    await expect(controller.strokes('30A2')).resolves.toContain('あ');
  });

  it('returns the stored JSON untouched, in stroke order', async () => {
    const { controller } = makeController({ 'strokes/03042.json': A });

    const body = await controller.strokes('3042');
    const parsed = JSON.parse(body) as { paths: string[] };
    // Order is the data's entire point — it must survive the round trip.
    expect(parsed.paths).toEqual(['M1', 'M2', 'M3']);
  });

  it('404s a character with no stroke data rather than erroring', async () => {
    const { controller } = makeController({});

    await expect(controller.strokes('4e00')).rejects.toBeInstanceOf(NotFoundException);
  });

  it.each(['../../etc/passwd', 'zzzz', '', '12', '1234567', 'abc/def'])(
    'refuses %p before it can reach storage',
    async (hostile) => {
      const { controller, asked } = makeController({});

      await expect(controller.strokes(hostile)).rejects.toBeInstanceOf(NotFoundException);
      // Rejected on shape, so storage is never consulted at all.
      expect(asked).toEqual([]);
    },
  );
});

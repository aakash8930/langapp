import { Controller, Get, Header, NotFoundException, Param } from '@nestjs/common';
import { StorageService } from '../common/storage/storage.service';

/**
 * Stroke-order outlines for a character.
 *
 * ## Keyed by codepoint, not by item id
 *
 * Unlike the audio route, which is keyed by the vocabulary item's `_id`. A
 * character's strokes are a property of the *character*, not of the row that
 * happens to teach it — き appears as a kana item and inside きゃ, and 山 is both
 * a kanji entry and part of a word. One file serves all of them, and a client
 * derives the key with `codePointAt(0).toString(16)` rather than looking
 * anything up.
 *
 * That is also why yōon are not stored whole: きゃ is two characters with two
 * stroke orders, and the client already renders it into two manuscript cells.
 *
 * ## Unauthenticated asset exception
 *
 * Like audio, this immutable render asset accepts no bearer header. Curriculum
 * JSON remains state-gated and the asset contains no learner data.
 *
 * ## Licensing
 *
 * The outlines are KanjiVG (https://kanjivg.tagaini.net/), CC BY-SA 3.0. Every
 * surface that draws them shows the credit, and `NOTICE` at the repo root
 * records the obligation. The share-alike covers this data only — it does not
 * reach the rest of the API.
 */
@Controller('content/strokes')
export class StrokesController {
  constructor(private readonly storage: StorageService) {}

  @Get(':codepoint')
  @Header('Content-Type', 'application/json; charset=utf-8')
  // A character's stroke order is fixed for the life of the writing system, so
  // this is as immutable as content gets.
  @Header('Cache-Control', 'public, max-age=31536000, immutable')
  async strokes(@Param('codepoint') codepoint: string): Promise<string> {
    // Lowercase hex, 4–5 digits — every character in the course sits in the
    // BMP. `resolveKey` in LocalStorageService is the real containment
    // boundary; this refuses the obviously hostile shape before it gets there
    // and turns a traversal attempt into a plain 404.
    if (!/^[a-f0-9]{4,5}$/i.test(codepoint)) {
      throw new NotFoundException('No stroke data for that character');
    }

    // Zero-pad to five, because that is how the files are named — KanjiVG's
    // convention, kept rather than renamed so the data stays diffable against
    // upstream. `あ` is U+3042, and a client that sends the natural four digits
    // must not miss `03042.json`. Padding here is what makes both forms work,
    // which is what the contract promises.
    const key = codepoint.toLowerCase().padStart(5, '0');

    let bytes: Buffer;
    try {
      bytes = await this.storage.get(`strokes/${key}.json`);
    } catch {
      // A character with no stroke data is a 404, not a 500 — the client's
      // fallback is to show the character without a diagram, which is the
      // intended behaviour rather than an error.
      throw new NotFoundException('No stroke data for that character');
    }

    // Already JSON on disk; returned as a string so Nest does not parse and
    // re-serialise a payload it has no reason to look inside.
    return bytes.toString('utf-8');
  }
}

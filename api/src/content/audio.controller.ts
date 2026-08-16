import { Controller, Get, Header, NotFoundException, Param, Res } from '@nestjs/common';
import type { Response } from 'express';
import { StorageService } from '../common/storage/storage.service';

/**
 * Spoken audio for a vocabulary word.
 *
 * ## Unauthenticated asset exception
 *
 * Curriculum JSON is account-state gated, but these immutable bytes stay public:
 * requiring a bearer header would prevent the client from handing the URL to a
 * plain `<audio>` element or `expo-av`. IDs come from protected curriculum data;
 * the route exposes no learner state.
 *
 * ## Nothing is synthesised here
 *
 * The files are produced ahead of time by `tools/generate-audio.py` and read
 * straight off storage. No model runs in this process: the vocabulary is fixed,
 * so synthesising on demand would burn CPU re-making a file that cannot change,
 * and would put a TTS runtime on a server that is a laptop.
 *
 * `id` is the vocabulary item's own `_id`, so the key is derivable from anything
 * the client already has — no second lookup, and no filename to keep in step with
 * a renamed word.
 */
@Controller('content')
export class AudioController {
  constructor(private readonly storage: StorageService) {}

  /**
   * Kana are spoken too, and that is not a special case of the above — it is
   * the same file, reached by a different noun.
   *
   * Both collections write into `audio/<item id>.wav`, so one implementation
   * serves both and the two routes exist only because a client asking for a
   * kana should not have to call it a vocab. Kana were left out of the first
   * generation pass on the reasoning that romaji already spells the sound;
   * that was wrong, because romaji spells it for someone who reads romaji and
   * the first unit exists to stop needing it.
   *
   * Kanji still get no audio, and for an unrelated reason that has not changed:
   * one kanji has several readings and which applies depends on the word, so
   * voicing one beside a bare glyph teaches a falsehood. A kana has exactly one
   * reading, which is what makes it safe to speak.
   */
  @Get('kana/:id/audio')
  @Header('Content-Type', 'audio/wav')
  @Header('Cache-Control', 'public, max-age=31536000, immutable')
  async kanaAudio(@Param('id') id: string, @Res() res: Response): Promise<void> {
    return this.serve(id, res);
  }

  @Get('vocab/:id/audio')
  @Header('Content-Type', 'audio/wav')
  // Immutable: a word's pronunciation does not change, and the key is its id, so
  // a regenerated voice would be a new deploy rather than new bytes at this URL.
  // Long cache means the phone fetches each word once, ever.
  @Header('Cache-Control', 'public, max-age=31536000, immutable')
  async audio(@Param('id') id: string, @Res() res: Response): Promise<void> {
    return this.serve(id, res);
  }

  private async serve(id: string, res: Response): Promise<void> {
    // The id goes into a storage key, and `resolveKey` in LocalStorageService is
    // the containment boundary — but a hex check here refuses the obviously
    // hostile shape before it ever gets there, and turns a traversal attempt into
    // a plain 404 rather than an error page.
    if (!/^[a-f0-9]{24}$/i.test(id)) {
      throw new NotFoundException('No audio for that item');
    }

    let bytes: Buffer;
    try {
      bytes = await this.storage.get(`audio/${id}.wav`);
    } catch {
      // An item whose audio has not been generated yet is a 404, not a 500.
      // That is the normal state for content added since the last run.
      throw new NotFoundException('No audio for that item');
    }

    res.send(bytes);
  }
}

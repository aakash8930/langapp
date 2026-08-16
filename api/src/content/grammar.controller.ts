import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { Types } from 'mongoose';
import { AuthenticatedUser, JwtAuthGuard } from '../common/auth/jwt-auth.guard';
import { AccountStateGuard } from '../common/auth/account-state.guard';
import { CurrentUser } from '../common/auth/current-user.decorator';
import { ContentService } from './content.service';
import { SentenceReadabilityRow } from './dto/sentence-readability-response.dto';

/**
 * Phase 3 #15 — Sentence-level reading. Mirror of `VocabController` for
 * grammar examples.
 *
 * The route lives under `/content/grammar` rather than `/grammar` for the
 * same reason vocab lives under `/content/vocab` — the vocabulary and
 * sentence readers are a parallel pair (per-learner, content-shaped reads),
 * and putting them under a per-content-type prefix keeps the URL list
 * legible when the bare reading screen starts fetching both.
 *
 * Bearer-protected for the same reason `/content/vocab/by-known-kana` is.
 */
@Controller('content/grammar')
@UseGuards(JwtAuthGuard, AccountStateGuard)
export class GrammarController {
  constructor(private readonly contentService: ContentService) {}

  /**
   * Returns grammar examples whose every kana is in the learner's `knownKana`.
   * Empty for a brand-new learner; the client-side sentence screen surfaces
   * the same explainer as the vocab reader.
   *
   * `cap` defaults to 200 — the grammar unit only seeds on the order of a
   * dozen points with one example each, so the cap is a safety bound rather
   * than a real pagination signal. Held to the same 200 ceiling as the vocab
   * reader so the two endpoints share a response shape.
   */
  @Get('by-known-kana')
  async byKnownKana(
    @CurrentUser() user: AuthenticatedUser,
    @Query('cap') cap?: string,
  ): Promise<SentenceReadabilityRow[]> {
    const parsed = cap ? Number.parseInt(cap, 10) : 200;
    const safe = Number.isFinite(parsed) ? Math.max(0, Math.min(parsed, 200)) : 200;
    return this.contentService.findSentencesByKnownKana(
      new Types.ObjectId(user.userId),
      safe,
    );
  }
}

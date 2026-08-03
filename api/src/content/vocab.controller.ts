import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { Types } from 'mongoose';
import { AuthenticatedUser, JwtAuthGuard } from '../common/auth/jwt-auth.guard';
import { CurrentUser } from '../common/auth/current-user.decorator';
import { ContentService } from './content.service';
import { VocabReadabilityRow } from './dto/vocab-readability-response.dto';

/**
 * Phase 0 — Data foundation. Authentication-guarded vocab surface.
 *
 * Distinct from `/lessons/:id` which embeds vocab inside a lesson and is
 * unauthenticated because it's reference content. This controller exists for
 * one purpose: the bare reading screen (Phase 0 #4) needs *readable* words
 * per learner, and "readable per learner" carries per-user state.
 *
 * `currentUserId` is the bearer-token subject. We pass it through to the
 * service as a `Types.ObjectId` so the service stays the single point of
 * authority on "what does this learner know" — controllers do not reach
 * into the user document.
 */
@Controller('vocab')
@UseGuards(JwtAuthGuard)
export class VocabController {
  constructor(private readonly contentService: ContentService) {}

  /**
   * Phase 0 — Data foundation. Returns vocabulary whose every kana is in the
   * learner's `knownKana`. Empty for a brand-new learner (no kana taught
   * yet); the bare reading screen surfaces this as an explainer.
   *
   * `cap` defaults to 200. Phase 0 only needs one word per screen-fetch,
   * but the endpoint returns up to `cap` rows so the same shape works for
   * a future review surface.
   */
  @Get('by-known-kana')
  async byKnownKana(
    @CurrentUser() user: AuthenticatedUser,
    @Query('cap') cap?: string,
  ): Promise<VocabReadabilityRow[]> {
    const parsed = cap ? Number.parseInt(cap, 10) : 200;
    const safe = Number.isFinite(parsed) ? Math.max(0, Math.min(parsed, 200)) : 200;
    return this.contentService.findVocabByKnownKana(new Types.ObjectId(user.userId), safe);
  }
}

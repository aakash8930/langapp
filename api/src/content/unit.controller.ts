import { Controller, Get, Param } from '@nestjs/common';
import { ContentService, UnitContent } from './content.service';

/**
 * Everything a unit teaches, resolved, in curriculum order.
 *
 * ## Why this exists as a route when the service already existed
 *
 * `ContentService.findUnitContent` has been here since the checkpoint was
 * built and no controller exposed it, so the only way for a client to see a
 * unit's items was to read `/lessons?unit=` and then `GET /lessons/:id` for
 * every row — 33 round trips for `vocab-n5`, which is exactly the cost the
 * service's own comment says it exists to avoid. The browse surfaces
 * (Vocabulary, Kanji, Grammar) had been sitting behind that gap.
 *
 * The method is unchanged: two queries regardless of unit size, one for the
 * unit's lessons and one batched resolve across every item kind, with items
 * deduplicated by `(kind, id)`.
 *
 * ## Unauthenticated, like the rest of the content surface
 *
 * Same reasoning as `LessonController`: units are shared reference content with
 * no per-user state. A learner's *progress* through a unit is not here — that
 * is `/me/progress` — so this leaks nothing personal. If Funnel scraping ever
 * becomes a concern, adding `JwtAuthGuard` is one line here as it is there.
 *
 * ## An unknown unit is an empty unit, not a 404
 *
 * `findUnitContent` returns empty for a slug it does not recognise, and that
 * behaviour is deliberate and documented on the service — `findLessons` does
 * the same. The controller does not add a 404 on top: a browse screen asking
 * for a unit that has been renamed should render "nothing here" rather than an
 * error page, and the caller can tell the difference from `lessonIds` being
 * empty too.
 */
@Controller('units')
export class UnitController {
  constructor(private readonly contentService: ContentService) {}

  @Get(':unit/content')
  async findContent(@Param('unit') unit: string): Promise<UnitContent> {
    return this.contentService.findUnitContent(unit);
  }
}

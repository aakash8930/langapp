import { ContentService, UnitContent } from './content.service';
import { UnitController } from './unit.controller';
import { JwtAuthGuard } from '../common/auth/jwt-auth.guard';
import { AccountStateGuard } from '../common/auth/account-state.guard';

/**
 * This controller is one line of delegation, so what is worth testing is not
 * the delegation — it is the two contract decisions the route inherits from
 * `findUnitContent` and deliberately does not override.
 *
 * Both matter to the browse screens that consume it, and both are the kind of
 * thing a later "tidy-up" adds without realising it is a behaviour change.
 */
function makeController(impl: (unit: string) => Promise<UnitContent>) {
  const asked: string[] = [];
  const service = {
    findUnitContent: (unit: string) => {
      asked.push(unit);
      return impl(unit);
    },
  } as unknown as ContentService;

  return { controller: new UnitController(service), asked };
}

const EMPTY: UnitContent = { unit: 'nope', lessonIds: [], items: [], exerciseTypes: [] };

const VOCAB: UnitContent = {
  unit: 'vocab-basics',
  lessonIds: ['l1', 'l2'],
  items: [
    {
      kind: 'vocab',
      id: 'v1',
      lemma: 'わたし',
      reading: 'わたし',
      romaji: 'watashi',
      gloss: 'I, me',
      pos: 'pronoun',
      jlpt: 'N5',
    },
  ] as UnitContent['items'],
  exerciseTypes: ['multipleChoice'],
};

describe('UnitController', () => {
  it('passes the unit slug through untouched', async () => {
    const { controller, asked } = makeController(() => Promise.resolve(VOCAB));

    await expect(controller.findContent('vocab-basics')).resolves.toBe(VOCAB);
    expect(asked).toEqual(['vocab-basics']);
  });

  /**
   * An unknown unit is an empty unit, not a 404.
   *
   * `findUnitContent` returns empty for a slug it does not recognise, matching
   * `findLessons`, and the controller does not add a 404 on top. A browse
   * screen asking for a unit that has since been renamed should render "nothing
   * here" rather than an error page — and `lessonIds` being empty too is how a
   * caller distinguishes that from a real unit that happens to teach nothing.
   */
  it('answers 200 with an empty payload for a unit that does not exist', async () => {
    const { controller } = makeController(() => Promise.resolve(EMPTY));

    await expect(controller.findContent('nope')).resolves.toEqual(EMPTY);
  });

  it('requires an authenticated, fully onboarded account', () => {
    expect(Reflect.getMetadata('__guards__', UnitController)).toEqual([
      JwtAuthGuard,
      AccountStateGuard,
    ]);
  });
});

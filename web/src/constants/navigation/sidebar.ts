import type { SidebarGroup } from '../../types/layout';

/**
 * The sidebar, as data.
 *
 * ## Why some of this is still `planned`
 *
 * The design this is built from lists twenty-four destinations. Nine existed
 * when this file was written; eighteen do now. Rather than trim the menu to
 * what is built — which would have hidden the shape of the product — the rest
 * are declared `planned`: visible, described, locked, and impossible to click.
 * The union in `types/layout/sidebar.ts` enforces that a planned row cannot
 * carry a route, so "looks live, goes nowhere" is not a state this file can
 * express.
 *
 * **What is still locked is locked on data, not on effort.** Each remaining
 * row needs something that does not exist yet:
 *
 *   - **Flashcards, Quizzes, Practice Hub** — `GET /reviews/session` returns a
 *     stable daily set (due cards first, then up to five new ones) and would
 *     back all three. Not blocked; simply not built yet.
 *   - **Listening, Speaking** — the endpoints exist (the two
 *     `/content/…/audio` routes) and `SpeechQuiz` exists, but no audio is
 *     seeded in this database, so both screens would be silent.
 *   - **Writing** — `TraceCanvas` and `StrokeOrder` are written and
 *     `/content/strokes/:codepoint` is live, but it 404s for every character
 *     tried, kana and kanji alike. Nothing is seeded, which also means the
 *     Study screen's tracing box has had no target for its whole life.
 *   - **JLPT** — every one of the 814 levelled items in the corpus is N5. A
 *     screen whose only axis has one value on it is a filter that filters
 *     nothing, and there is no per-item mastery endpoint to turn it into a
 *     readiness figure instead.
 *   - **Study Groups** — no API at all. `/social` covers friends and messages;
 *     groups are not modelled anywhere.
 *
 * (The `/content/…/audio` paths above are written without a glob on purpose: a
 * `*` followed by a slash inside a block comment closes it, and the parse
 * errors that follow point at a line a hundred rows below the real cause.)
 *
 * Two of the mock's rows turned out to exist already under different names, and
 * finding that was worth the audit:
 *
 *   - **AI Tutor** is `/practice`. That route is the chat screen —
 *     `createChatSession` and `sendChatMessage` — not a practice hub, whatever
 *     the path says.
 *   - **Reading** is `/read`, the known-kana vocabulary feed.
 *
 * So "Practice Hub" is the planned one and "AI Tutor" is live, which is the
 * reverse of what the path names suggest. Don't swap them back.
 *
 * ## The kana rows use glyphs, not icons
 *
 * Hiragana, Katakana and Kanji render あ / ア / 漢 in the icon slot, as in the
 * design. A line icon for "the hiragana syllabary" would be an abstraction of
 * the one thing that is already a picture of itself.
 */
export const sidebarGroups: SidebarGroup[] = [
  {
    id: 'top',
    items: [{ kind: 'link', id: 'dashboard', label: 'Dashboard', icon: 'home', to: '/' }],
  },
  {
    id: 'learn',
    title: 'Learn',
    items: [
      { kind: 'link', id: 'courses', label: 'Courses', icon: 'book-open', to: '/courses' },
      { kind: 'link', id: 'hiragana', label: 'Hiragana', glyph: 'あ', to: '/hiragana' },
      { kind: 'link', id: 'katakana', label: 'Katakana', glyph: 'ア', to: '/katakana' },
      { kind: 'link', id: 'vocabulary', label: 'Vocabulary', icon: 'library', to: '/vocabulary' },
      { kind: 'link', id: 'kanji', label: 'Kanji', glyph: '漢', to: '/kanji' },
      { kind: 'link', id: 'grammar', label: 'Grammar', icon: 'book-marked', to: '/grammar' },
      { kind: 'link', id: 'listening', label: 'Listening', icon: 'headphones', to: '/hiragana-listening' },
      { kind: 'link', id: 'speaking', label: 'Speaking', icon: 'mic', to: '/speaking' },
      { kind: 'link', id: 'reading', label: 'Reading', icon: 'languages', to: '/read' },
      { kind: 'link', id: 'writing', label: 'Writing', icon: 'pen-tool', to: '/hiragana-writing' },
      { kind: 'planned', id: 'jlpt', label: 'JLPT', icon: 'graduation-cap' },
    ],
  },
  {
    id: 'practice',
    title: 'Practice',
    items: [
      {
        kind: 'link',
        id: 'review',
        label: 'Review (SRS)',
        icon: 'refresh-cw',
        to: '/review',
        badge: 'due',
      },
      { kind: 'link', id: 'flashcards', label: 'Flashcards', icon: 'layers', to: '/hiragana-flashcards' },
      { kind: 'planned', id: 'quizzes', label: 'Quizzes', icon: 'grid' },
      { kind: 'planned', id: 'practice-hub', label: 'Practice Hub', icon: 'pen-square' },
    ],
  },
  {
    id: 'community',
    title: 'Community',
    items: [
      { kind: 'link', id: 'community', label: 'Community', icon: 'users', to: '/social' },
      { kind: 'planned', id: 'study-groups', label: 'Study Groups', icon: 'users-round' },
      { kind: 'link', id: 'leaderboard', label: 'Leaderboard', icon: 'trophy', to: '/leagues' },
    ],
  },
  {
    id: 'more',
    title: 'More',
    items: [
      {
        kind: 'link',
        id: 'dictionary',
        label: 'Dictionary',
        icon: 'book-marked',
        to: '/dictionary',
      },
      { kind: 'link', id: 'ai-tutor', label: 'AI Tutor', icon: 'bot', to: '/practice' },
      { kind: 'link', id: 'progress', label: 'Progress', icon: 'trending-up', to: '/progress' },
      {
        kind: 'link',
        id: 'security',
        label: 'Security',
        icon: 'shield',
        to: '/security',
      },
      {
        kind: 'link',
        id: 'achievements',
        label: 'Achievements',
        icon: 'award',
        to: '/achievements',
      },
      {
        kind: 'link',
        id: 'creator',
        label: 'Creator',
        icon: 'wand-2',
        to: '/creator',
        adminOnly: true,
      },
      { kind: 'link', id: 'settings', label: 'Settings', icon: 'settings', to: '/settings' },
    ],
  },
];

import type { SidebarGroup } from '../../types/layout';

/**
 * The sidebar, as data.
 *
 * The public MVP navigation contains only destinations with working product
 * behaviour. Planned surfaces (including study groups and paid billing) stay
 * out of navigation until their API and release contracts exist; a disabled
 * row still reads like a product promise.
 *
 * Speaking and Listening are live. Both use the real course corpus and audio
 * routes with explicit browser fallbacks. Speaking adds local voice recording,
 * browser transcription, and the account-backed AI conversation API without
 * pretending transcription is a pronunciation score.
 *
 * Two rows use routes whose historical names are easy to misread:
 *
 *   - **AI Tutor** remains `/practice`, now the shared Speaking conversation UI.
 *   - **Reading** is `/read`, the course-backed interactive reader.
 *   - **Writing** is `/writing`, the guided editor and writing workflow.
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
    items: [
      { kind: 'link', id: 'dashboard', label: 'Dashboard', icon: 'home', to: '/' },
      { kind: 'link', id: 'profile', label: 'Profile', icon: 'award', to: '/profile' },
    ],
  },
  {
    id: 'admin',
    items: [
      {
        kind: 'link',
        id: 'admin',
        label: 'Admin Panel',
        icon: 'shield',
        to: '/admin',
        adminOnly: true,
      },
    ],
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
      { kind: 'link', id: 'listening', label: 'Listening', icon: 'headphones', to: '/listening' },
      { kind: 'link', id: 'speaking', label: 'Speaking', icon: 'mic', to: '/speaking' },
      { kind: 'link', id: 'reading', label: 'Reading', icon: 'languages', to: '/read' },
      { kind: 'link', id: 'writing', label: 'Writing', icon: 'pen-tool', to: '/writing' },
      { kind: 'link', id: 'jlpt', label: 'JLPT', icon: 'graduation-cap', to: '/jlpt' },
    ],
  },
  {
    id: 'practice',
    title: 'Practice',
    items: [
      { kind: 'link', id: 'flashcards', label: 'Flashcards', icon: 'layers', to: '/flashcards' },
      { kind: 'link', id: 'quizzes', label: 'Quizzes', icon: 'grid', to: '/quizzes' },
      { kind: 'link', id: 'practice-hub', label: 'Practice Hub', icon: 'pen-square', to: '/practice-hub' },
    ],
  },
  {
    id: 'community',
    title: 'Community',
    items: [
      { kind: 'link', id: 'community', label: 'Community', icon: 'users', to: '/social' },
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
      { kind: 'link', id: 'exams', label: 'Exams', icon: 'graduation-cap', to: '/exams' },
      { kind: 'link', id: 'progress', label: 'Progress', icon: 'trending-up', to: '/progress' },
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
      {
        kind: 'link',
        id: 'notifications',
        label: 'Notifications',
        icon: 'bell',
        to: '/notifications',
      },
    ],
  },
];

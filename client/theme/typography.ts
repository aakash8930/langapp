import { Platform, type TextStyle } from 'react-native';

/**
 * Type scale.
 *
 * Japanese uses Zen Kaku Gothic New — a print/gothic face, correct for reading
 * practice. Kana and kanji are meant to render large; `displayKana` and
 * `displayKanji` are the exercise-card sizes and are deliberately extreme.
 *
 * Latin/UI currently uses the platform system face. The design direction calls
 * for Schibsted Grotesk or Manrope, but neither is installed — adding one is a
 * new dependency. Swapping `families.ui` here is the only change required.
 */

export const families = {
  jaLight: 'ZenKakuGothicNew_300Light',
  ja: 'ZenKakuGothicNew_400Regular',
  jaMedium: 'ZenKakuGothicNew_500Medium',
  jaBold: 'ZenKakuGothicNew_700Bold',
  /** Latin/UI. See the note above before changing. */
  ui: Platform.select({ ios: 'System', default: 'sans-serif' }) as string,
} as const;

export const fontSize = {
  caption: 14,
  small: 16,
  body: 18,
  bodyLarge: 20,
  title: 24,
  heading: 32,
  /** Large numeric display — the streak counter, which carries the home screen. */
  displayNumber: 64,
  /** Kanji on an exercise card. */
  displayKanji: 56,
  /** Kana on an exercise card — larger, since kana carry less detail. */
  displayKana: 72,
} as const;

export const lineHeight = {
  caption: 20,
  small: 22,
  body: 26,
  bodyLarge: 28,
  title: 32,
  heading: 40,
} as const;

/**
 * XP and streak numerals get tabular figures so counters do not jitter as they
 * tick. Spread this into a Text style; it is not a size, so it composes with
 * any of the sizes above.
 */
export const tabularFigures: TextStyle = {
  fontVariant: ['tabular-nums'],
};

export type FontSize = keyof typeof fontSize;

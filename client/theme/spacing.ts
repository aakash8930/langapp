import { StyleSheet } from 'react-native';

/** 4pt base scale. Every margin and padding in the app comes from here. */
export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
} as const;

/**
 * Height of a tappable control — button, text input. Comfortably clear of the
 * 44pt minimum touch target, and shared so a button and the field above it line
 * up without either hard-coding a number.
 */
export const controlHeight = 52;

export const radius = {
  none: 0,
  sm: 4,
  md: 8,
  lg: 12,
  pill: 999,
} as const;

/**
 * The house style permits exactly one separation device: a 1px hairline.
 * `StyleSheet.hairlineWidth` resolves to a true device pixel, so this stays
 * hairline-thin on 3x screens instead of rendering as a heavy 1pt rule.
 */
export const hairlineWidth = StyleSheet.hairlineWidth;

/**
 * Motion budget. Card transitions and nothing else — no bounce, no spring
 * overshoot. Screens must still check `useReducedMotion()` and skip animating
 * rather than merely shortening these.
 */
export const duration = {
  fast: 120,
  base: 200,
  slow: 320,
} as const;

export type Spacing = keyof typeof spacing;

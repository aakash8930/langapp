import { darkPalette, lightPalette, type Palette } from './colors';
import { controlHeight, duration, hairlineWidth, radius, spacing } from './spacing';
import { families, fontSize, lineHeight, tabularFigures } from './typography';

/**
 * The two assembled themes, in their own module so `ThemeProvider` and
 * `useTheme` can both reach them without importing each other. They did import
 * each other once; the cycle happened to resolve, which is not a thing to rely
 * on under Metro.
 */

export type Theme = {
  scheme: 'light' | 'dark';
  colors: Palette;
  spacing: typeof spacing;
  radius: typeof radius;
  controlHeight: number;
  hairlineWidth: number;
  duration: typeof duration;
  families: typeof families;
  fontSize: typeof fontSize;
  lineHeight: typeof lineHeight;
  tabularFigures: typeof tabularFigures;
};

const shared = {
  spacing,
  radius,
  controlHeight,
  hairlineWidth,
  duration,
  families,
  fontSize,
  lineHeight,
  tabularFigures,
};

export const lightTheme: Theme = { scheme: 'light', colors: lightPalette, ...shared };
export const darkTheme: Theme = { scheme: 'dark', colors: darkPalette, ...shared };

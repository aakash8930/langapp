import { useColorScheme } from 'react-native';

import { darkTheme, lightTheme, type Theme } from './themes';
import { useThemeContext } from './ThemeProvider';

/**
 * The single source of colour and metrics for every component.
 *
 * Reads the resolved palette from `ThemeProvider`, which reconciles the user's
 * stored preference with the OS setting. Outside a provider it follows the OS,
 * so the splash and the font-loading hold — both of which render before there
 * is a session to have a preference in — still look right.
 */
export function useTheme(): Theme {
  const provided = useThemeContext();
  const osScheme = useColorScheme();

  if (provided) return provided;
  return osScheme === 'dark' ? darkTheme : lightTheme;
}

export { darkTheme, lightTheme, type Theme } from './themes';
export { ThemeProvider, type ThemePreference } from './ThemeProvider';
export { darkPalette, lightPalette } from './colors';
export type { Palette } from './colors';
export { controlHeight, duration, hairlineWidth, radius, spacing } from './spacing';
export { families, fontSize, lineHeight, tabularFigures } from './typography';

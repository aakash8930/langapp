import { createContext, useContext, useMemo } from 'react';
import { useColorScheme } from 'react-native';

import { darkTheme, lightTheme, type Theme } from './themes';

/** What the user picked. `system` defers to the OS. */
export type ThemePreference = 'light' | 'dark' | 'system';

/**
 * Null outside a provider, which is deliberate: `useTheme()` falls back to
 * following the OS, so a component rendered before the session is known — the
 * splash, the font-loading hold — still gets a sensible palette instead of
 * throwing.
 */
const ThemeContext = createContext<Theme | null>(null);

/**
 * Resolves the stored preference against the OS setting.
 *
 * The server stores the preference but never resolves it; `system` is only
 * meaningful on a device that has an OS setting to follow. So the resolution
 * happens here, once, and everything below reads a settled palette.
 */
export function ThemeProvider({
  preference,
  children,
}: {
  preference: ThemePreference;
  children: React.ReactNode;
}) {
  const osScheme = useColorScheme();

  const theme = useMemo(() => {
    // `useColorScheme()` returns null before the native module reports in.
    // Treating that as light avoids a dark flash on a light-mode device.
    const scheme = preference === 'system' ? (osScheme ?? 'light') : preference;
    return scheme === 'dark' ? darkTheme : lightTheme;
  }, [osScheme, preference]);

  return <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>;
}

/** Used by `useTheme()`. Not exported from `theme/` — read the theme instead. */
export function useThemeContext(): Theme | null {
  return useContext(ThemeContext);
}

import AsyncStorage from '@react-native-async-storage/async-storage';
import { useColorScheme } from 'react-native';
import React, { createContext, useContext, useEffect, useMemo, useState, type PropsWithChildren } from 'react';
import { createAppTheme, type ThemePalette } from '@/ui/theme';

export type ThemeMode = 'system' | 'light' | 'dark';

type ThemeContextValue = {
  mode: ThemeMode;
  resolvedMode: 'light' | 'dark';
  isDark: boolean;
  colors: ThemePalette;
  setMode: (mode: ThemeMode) => Promise<void>;
};

const THEME_MODE_STORAGE_KEY = '@laundryfresh/theme-mode';
const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: PropsWithChildren) {
  const systemScheme = useColorScheme();
  const [mode, setModeState] = useState<ThemeMode>('system');

  useEffect(() => {
    AsyncStorage.getItem(THEME_MODE_STORAGE_KEY)
      .then((storedMode) => {
        if (storedMode === 'light' || storedMode === 'dark' || storedMode === 'system') {
          setModeState(storedMode);
        }
      })
      .catch(() => undefined);
  }, []);

  const resolvedMode = mode === 'system'
    ? systemScheme === 'dark' ? 'dark' : 'light'
    : mode;

  const value = useMemo<ThemeContextValue>(() => ({
    mode,
    resolvedMode,
    isDark: resolvedMode === 'dark',
    colors: createAppTheme(resolvedMode).palette,
    setMode: async (nextMode) => {
      setModeState(nextMode);
      await AsyncStorage.setItem(THEME_MODE_STORAGE_KEY, nextMode);
    },
  }), [mode, resolvedMode]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used inside ThemeProvider');
  return context;
}

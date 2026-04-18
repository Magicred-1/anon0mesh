import React, { createContext, useContext, useMemo } from 'react';
import { useColorScheme } from 'react-native';
import { darkColors, lightColors, type AppColors } from './colors';
import { spacing, radii, shadows } from './spacing';
import { textVariants, fontFamily, fontSize, fontWeight } from './typography';

export type Theme = {
  colors: AppColors;
  spacing: typeof spacing;
  radii: typeof radii;
  shadows: typeof shadows;
  textVariants: typeof textVariants;
  fontFamily: typeof fontFamily;
  fontSize: typeof fontSize;
  fontWeight: typeof fontWeight;
  isDark: boolean;
};

const buildTheme = (isDark: boolean): Theme => ({
  colors: isDark ? darkColors : lightColors,
  spacing,
  radii,
  shadows,
  textVariants,
  fontFamily,
  fontSize,
  fontWeight,
  isDark,
});

const ThemeContext = createContext<Theme>(buildTheme(true));

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const scheme = useColorScheme();
  const theme = useMemo(() => buildTheme(scheme !== 'light'), [scheme]);
  return <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>;
}

export function useTheme(): Theme {
  return useContext(ThemeContext);
}

import React, { createContext, useContext } from 'react';
import { darkColors, type AppColors } from './colors';
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

const DARK_THEME: Theme = {
  colors: darkColors,
  spacing,
  radii,
  shadows,
  textVariants,
  fontFamily,
  fontSize,
  fontWeight,
  isDark: true,
};

const ThemeContext = createContext<Theme>(DARK_THEME);

export function ThemeProvider({ children }: Readonly<{ children: React.ReactNode }>) {
  return <ThemeContext.Provider value={DARK_THEME}>{children}</ThemeContext.Provider>;
}

export function useTheme(): Theme {
  return useContext(ThemeContext);
}

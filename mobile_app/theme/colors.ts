export const palette = {
  // Neutrals
  black: '#000000',
  grey950: '#090A0C',
  grey900: '#0E1015',
  grey850: '#141720',
  grey800: '#1C2030',
  grey700: '#2A2F42',
  grey600: '#3D4460',
  grey500: '#5A6380',
  grey400: '#8A94B0',
  grey300: '#B0B8D0',
  grey200: '#CDD3E2',
  grey100: '#E8EBEE',
  white: '#FFFFFF',

  // Primary — teal/cyan
  teal900: '#003D36',
  teal700: '#007A6A',
  teal500: '#00C4A7',
  teal400: '#00E0BF',
  teal300: '#4DEFD9',
  teal200: '#A0F5EA',

  // Accent — violet
  violet900: '#1A0033',
  violet700: '#4B00A0',
  violet500: '#7B2FBE',
  violet400: '#9B4FDE',
  violet300: '#C090F0',

  // Semantic
  red500: '#FF4D4D',
  red300: '#FF9090',
  yellow500: '#FFB800',
  yellow300: '#FFDA70',
  green500: '#00D46A',
  green300: '#7AEFB0',
} as const;

export type ColorPalette = typeof palette;

export const darkColors = {
  // Surfaces
  background: palette.grey950,
  surface0: palette.grey900,
  surface1: palette.grey850,
  surface2: palette.grey800,
  surface3: palette.grey700,

  // Text
  textPrimary: palette.white,
  textSecondary: palette.grey300,
  textTertiary: palette.grey400,
  textDisabled: palette.grey500,
  textInverse: palette.grey950,

  // Brand
  primary: palette.teal400,
  primaryDim: palette.teal500,
  primarySubtle: palette.teal900,
  accent: palette.violet400,
  accentSubtle: palette.violet900,

  // Semantic
  error: palette.red500,
  errorSubtle: '#330000',
  warning: palette.yellow500,
  warningSubtle: '#332500',
  success: palette.green500,
  successSubtle: '#003320',

  // Borders
  borderSubtle: palette.grey800,
  border: palette.grey700,
  borderStrong: palette.grey600,

  // Overlays
  overlay: 'rgba(0,0,0,0.6)',
  glass: 'rgba(14,16,21,0.85)',
} as const;

export const lightColors = {
  background: '#F0F4F8',
  surface0: '#FFFFFF',
  surface1: '#F5F7FA',
  surface2: '#EAF0F7',
  surface3: '#DDE5F0',

  textPrimary: palette.grey900,
  textSecondary: palette.grey700,
  textTertiary: palette.grey500,
  textDisabled: palette.grey300,
  textInverse: palette.white,

  primary: palette.teal700,
  primaryDim: palette.teal500,
  primarySubtle: palette.teal200,
  accent: palette.violet500,
  accentSubtle: palette.violet300,

  error: '#CC0000',
  errorSubtle: '#FFEAEA',
  warning: '#996000',
  warningSubtle: '#FFF8E0',
  success: '#007A3A',
  successSubtle: '#E0FAF0',

  borderSubtle: palette.grey100,
  border: palette.grey200,
  borderStrong: palette.grey300,

  overlay: 'rgba(0,0,0,0.4)',
  glass: 'rgba(255,255,255,0.85)',
} as const;

export type AppColors = typeof darkColors;

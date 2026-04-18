export const palette = {
  black:   '#000000',
  white:   '#ffffff',

  // Void — dark navy-teal backgrounds (anonme.sh base)
  void950: '#00080c',
  void900: '#030c12',
  void850: '#071520',
  void800: '#0c1e2e',
  void700: '#12263c',
  void600: '#1b3550',
  void500: '#2d4f68',
  void400: '#527090',
  void300: '#7a9db5',
  void200: '#aac8da',
  void100: '#daeaf3',

  // Text grays — from anonme.sh carbon design system
  gray90:  '#c6c6c6',
  gray70:  '#8d8d8d',
  gray50:  '#525252',
  gray30:  '#393939',

  // Cyan — anonme.sh primary (#00e5ff)
  cyan900: '#001520',
  cyan700: '#004d66',
  cyan500: '#00a8c4',
  cyan400: '#00cde8',
  cyan300: '#00e5ff',
  cyan200: '#66eeff',
  cyan100: '#ccf9ff',

  // Neon green — anonme.sh success / accent
  neon900: '#0a2c02',
  neon700: '#106b02',
  neon500: '#009f00',
  neon400: '#00cf00',
  neon300: '#5cff3b',
  neon200: '#b2ff94',

  // Semantic
  red500:    '#da1e28',
  red300:    '#ff6b6b',
  yellow500: '#f1c21b',
  yellow300: '#f7d872',
  green500:  '#198038',
  green300:  '#42be65',
} as const;

export type ColorPalette = typeof palette;

export const darkColors = {
  // Surfaces
  background: palette.void950,
  surface0:   palette.void900,
  surface1:   palette.void850,
  surface2:   palette.void800,
  surface3:   palette.void700,

  // Text
  textPrimary:   palette.white,
  textSecondary: palette.gray90,
  textTertiary:  palette.gray70,
  textDisabled:  palette.gray50,
  textInverse:   palette.void950,

  // Brand
  primary:       palette.cyan300,
  primaryDim:    palette.cyan500,
  primarySubtle: 'rgba(0,229,255,0.08)',

  accent:        palette.neon300,
  accentSubtle:  'rgba(0,207,0,0.10)',

  // Semantic
  error:         palette.red500,
  errorSubtle:   '#330008',
  warning:       palette.yellow500,
  warningSubtle: '#2c2200',
  success:       palette.neon300,
  successSubtle: palette.neon900,

  // Borders — cyan-glow tinted
  borderSubtle: 'rgba(0,229,255,0.06)',
  border:       'rgba(0,229,255,0.13)',
  borderStrong: 'rgba(0,229,255,0.28)',

  // Overlays
  overlay: 'rgba(0,0,0,0.72)',
  glass:   'rgba(0,8,12,0.92)',
} as const;

export const lightColors = {
  background: '#f0f8fc',
  surface0:   palette.white,
  surface1:   '#e8f4fa',
  surface2:   '#d0e8f4',
  surface3:   '#b8dced',

  textPrimary:   palette.void950,
  textSecondary: palette.void700,
  textTertiary:  palette.void500,
  textDisabled:  palette.void300,
  textInverse:   palette.white,

  primary:       '#0070b8',
  primaryDim:    '#005590',
  primarySubtle: 'rgba(0,112,184,0.10)',

  accent:        palette.neon500,
  accentSubtle:  'rgba(0,159,0,0.10)',

  error:         '#c01020',
  errorSubtle:   '#fff0f0',
  warning:       '#7a5400',
  warningSubtle: '#fff8e0',
  success:       palette.green500,
  successSubtle: '#e8f9ee',

  borderSubtle: '#d0e8f4',
  border:       '#a8d0e4',
  borderStrong: '#80b8d0',

  overlay: 'rgba(0,0,0,0.40)',
  glass:   'rgba(240,248,252,0.92)',
} as const;

export type AppColors = typeof darkColors;

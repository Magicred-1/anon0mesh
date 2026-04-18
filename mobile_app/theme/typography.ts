import { Platform } from 'react-native';

export const fontFamily = Platform.select({
  ios: {
    sans: 'System',
    mono: 'Courier New',
  },
  android: {
    sans: 'Roboto',
    mono: 'monospace',
  },
  default: {
    sans: 'System',
    mono: 'monospace',
  },
})!;

export const fontSize = {
  xs: 11,
  sm: 13,
  md: 15,
  lg: 17,
  xl: 20,
  '2xl': 24,
  '3xl': 30,
  '4xl': 38,
} as const;

export const fontWeight = {
  regular: '400' as const,
  medium: '500' as const,
  semibold: '600' as const,
  bold: '700' as const,
};

export const lineHeight = {
  tight: 1.2,
  normal: 1.5,
  relaxed: 1.75,
} as const;

export const textVariants = {
  displayLg: { fontSize: fontSize['4xl'], fontWeight: fontWeight.bold, lineHeight: fontSize['4xl'] * 1.2 },
  displayMd: { fontSize: fontSize['3xl'], fontWeight: fontWeight.bold, lineHeight: fontSize['3xl'] * 1.2 },
  headingLg: { fontSize: fontSize['2xl'], fontWeight: fontWeight.semibold, lineHeight: fontSize['2xl'] * 1.3 },
  headingMd: { fontSize: fontSize.xl,   fontWeight: fontWeight.semibold, lineHeight: fontSize.xl * 1.3 },
  headingSm: { fontSize: fontSize.lg,   fontWeight: fontWeight.semibold, lineHeight: fontSize.lg * 1.4 },
  bodyLg:    { fontSize: fontSize.lg,   fontWeight: fontWeight.regular,  lineHeight: fontSize.lg * 1.5 },
  bodyMd:    { fontSize: fontSize.md,   fontWeight: fontWeight.regular,  lineHeight: fontSize.md * 1.5 },
  bodySm:    { fontSize: fontSize.sm,   fontWeight: fontWeight.regular,  lineHeight: fontSize.sm * 1.5 },
  labelLg:   { fontSize: fontSize.md,   fontWeight: fontWeight.medium,   lineHeight: fontSize.md * 1.4 },
  labelMd:   { fontSize: fontSize.sm,   fontWeight: fontWeight.medium,   lineHeight: fontSize.sm * 1.4 },
  labelSm:   { fontSize: fontSize.xs,   fontWeight: fontWeight.medium,   lineHeight: fontSize.xs * 1.4 },
  codeMd:    { fontSize: fontSize.sm,   fontWeight: fontWeight.regular,  lineHeight: fontSize.sm * 1.5, fontFamily: fontFamily.mono },
  codeSm:    { fontSize: fontSize.xs,   fontWeight: fontWeight.regular,  lineHeight: fontSize.xs * 1.5, fontFamily: fontFamily.mono },
} as const;

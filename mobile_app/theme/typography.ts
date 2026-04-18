export const fontFamily = {
  sans:       'SpaceGrotesk_400Regular',
  sansMd:     'SpaceGrotesk_500Medium',
  sansSb:     'SpaceGrotesk_600SemiBold',
  sansBold:   'SpaceGrotesk_700Bold',
  sansLight:  'SpaceGrotesk_300Light',
  mono:       'monospace',
} as const;

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
  displayLg: { fontSize: fontSize['4xl'], fontFamily: fontFamily.sansBold,  lineHeight: fontSize['4xl'] * 1.2 },
  displayMd: { fontSize: fontSize['3xl'], fontFamily: fontFamily.sansBold,  lineHeight: fontSize['3xl'] * 1.2 },
  headingLg: { fontSize: fontSize['2xl'], fontFamily: fontFamily.sansSb,    lineHeight: fontSize['2xl'] * 1.3 },
  headingMd: { fontSize: fontSize.xl,    fontFamily: fontFamily.sansSb,    lineHeight: fontSize.xl    * 1.3 },
  headingSm: { fontSize: fontSize.lg,    fontFamily: fontFamily.sansSb,    lineHeight: fontSize.lg    * 1.4 },
  bodyLg:    { fontSize: fontSize.lg,    fontFamily: fontFamily.sans,      lineHeight: fontSize.lg    * 1.5 },
  bodyMd:    { fontSize: fontSize.md,    fontFamily: fontFamily.sans,      lineHeight: fontSize.md    * 1.5 },
  bodySm:    { fontSize: fontSize.sm,    fontFamily: fontFamily.sans,      lineHeight: fontSize.sm    * 1.5 },
  labelLg:   { fontSize: fontSize.md,    fontFamily: fontFamily.sansMd,   lineHeight: fontSize.md    * 1.4 },
  labelMd:   { fontSize: fontSize.sm,    fontFamily: fontFamily.sansMd,   lineHeight: fontSize.sm    * 1.4 },
  labelSm:   { fontSize: fontSize.xs,    fontFamily: fontFamily.sansMd,   lineHeight: fontSize.xs    * 1.4 },
  codeMd:    { fontSize: fontSize.sm,    fontFamily: fontFamily.mono,      lineHeight: fontSize.sm    * 1.5 },
  codeSm:    { fontSize: fontSize.xs,    fontFamily: fontFamily.mono,      lineHeight: fontSize.xs    * 1.5 },
} as const;

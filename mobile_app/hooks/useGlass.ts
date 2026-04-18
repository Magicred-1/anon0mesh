import { useTheme } from '@/theme';

export type GlassVariant = 'base' | 'soft' | 'accent' | 'strong';

export function useGlass(variant: GlassVariant = 'base') {
  const { colors } = useTheme();
  switch (variant) {
    case 'soft':   return { backgroundColor: colors.surface0,      borderWidth: 0.5 as const, borderColor: colors.borderSubtle };
    case 'accent': return { backgroundColor: colors.primarySubtle, borderWidth: 0.5 as const, borderColor: colors.primary + '40' };
    case 'strong': return { backgroundColor: colors.surface2,      borderWidth: 0.5 as const, borderColor: colors.borderStrong };
    default:       return { backgroundColor: colors.surface1,      borderWidth: 0.5 as const, borderColor: colors.border };
  }
}

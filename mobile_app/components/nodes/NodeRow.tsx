import React, { memo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { fontFamily, fontSize, spacing, useTheme } from '@/theme';
import { Pill } from '@/components/ui/Pill';
import { SignalBars } from './SignalBars';
import type { NodeData } from './types';

interface Props {
  n: NodeData;
  selected?: boolean;
}

const IFACE_VARIANT: Record<string, 'primary' | 'accent' | 'default'> = {
  TCP: 'primary', BLE: 'accent', RNode: 'default',
};

export const NodeRow = memo(function NodeRow({ n, selected }: Props) {
  const { colors } = useTheme();
  return (
    <View style={[S.row, {
      borderBottomColor: 'rgba(255,255,255,0.04)',
      backgroundColor: selected ? colors.primarySubtle : 'transparent',
    }]}>
      <View style={[S.hopBadge, { borderColor: selected ? colors.primary + '80' : colors.border }]}>
        {'beacon' in n && n.beacon
          ? <Feather name="radio" size={14} color={colors.primary} />
          : <Text style={[S.hopNum, { color: colors.textSecondary }]}>{n.hops}</Text>
        }
      </View>

      <View style={{ flex: 1, minWidth: 0 }}>
        <View style={S.handleRow}>
          <Text style={[S.handle, { color: selected ? colors.primary : colors.textPrimary }]} numberOfLines={1}>
            {n.handle}
          </Text>
          {n.beacon && <Pill label="BEACON" variant="primary" />}
        </View>
        <View style={S.meta}>
          <Text style={[S.metaText, { color: colors.textTertiary }]}>HOPS · {String(n.hops).padStart(2,'0')}</Text>
          <Text style={[S.metaText, { color: colors.textTertiary }]}>·</Text>
          <Text style={[S.metaText, { color: colors.textTertiary }]}>{n.latency}</Text>
        </View>
      </View>

      <View style={S.right}>
        <Pill label={n.iface} variant={IFACE_VARIANT[n.iface] ?? 'default'} />
        <SignalBars value={n.signal} size={9} />
      </View>
    </View>
  );
});

const S = StyleSheet.create({
  row:       { flexDirection: 'row', alignItems: 'center', padding: spacing[4], paddingHorizontal: spacing[6], gap: spacing[4], borderBottomWidth: 0.5 },
  hopBadge:  { width: 28, height: 28, borderWidth: 0.5, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  hopNum:    { fontFamily: fontFamily.sansMd, fontSize: fontSize.xs },
  handleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[3], flexWrap: 'wrap' },
  handle:    { fontFamily: fontFamily.sansMd, fontSize: fontSize.sm, letterSpacing: 0.2, flexShrink: 1 },
  meta:      { flexDirection: 'row', gap: 10, marginTop: spacing[2] },
  metaText:  { fontFamily: fontFamily.sansMd, fontSize: fontSize.xs, letterSpacing: 1.5, textTransform: 'uppercase' },
  right:     { flexDirection: 'column', alignItems: 'flex-end', gap: 5, flexShrink: 0 },
});

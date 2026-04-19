import React, { memo } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { fontFamily, useTheme } from '@/theme';
import { useGlass } from '@/hooks/useGlass';
import type { Tab } from './types';

const TABS: { id: Tab; icon: string; label: string }[] = [
  { id: 'send',    icon: 'arrow-up-right',  label: 'SEND'  },
  { id: 'receive', icon: 'arrow-down-left', label: 'RECV'  },
  { id: 'swap',    icon: 'repeat',          label: 'SWAP'  },
  { id: 'yield',   icon: 'trending-up',     label: 'YIELD' },
];

interface Props { tab: Tab | null; onTab: (t: Tab) => void }

export const WalletTabs = memo(function WalletTabs({ tab, onTab }: Props) {
  const { colors } = useTheme();
  const softGlass  = useGlass('soft');
  const accentGlass = useGlass('accent');

  return (
    <View style={S.row}>
      {TABS.map(t => {
        const on = tab === t.id;
        return (
          <Pressable
            key={t.id}
            onPress={() => onTab(t.id)}
            style={[S.btn, on ? accentGlass : softGlass, on && { borderColor: colors.primary + '60' }]}
          >
            <Feather name={t.icon as any} size={18} color={on ? colors.primary : colors.textSecondary} />
            <Text style={[S.label, { color: on ? colors.primary : colors.textTertiary }]}>{t.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
});

const S = StyleSheet.create({
  row:   { flexDirection: 'row', paddingHorizontal: 20, gap: 8, marginTop: 4 },
  btn:   { flex: 1, paddingVertical: 12, borderRadius: 14, alignItems: 'center', gap: 5 },
  label: { fontFamily: fontFamily.sansMd, fontSize: 9, letterSpacing: 2, textTransform: 'uppercase' },
});

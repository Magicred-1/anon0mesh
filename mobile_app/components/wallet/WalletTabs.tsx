import React, { memo } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { fontFamily, useTheme } from '@/theme';
import { useGlass } from '@/hooks/useGlass';
import type { Tab } from './types';

const TABS: { id: Tab; label: string }[] = [
  { id: 'send',  label: 'send'  },
  { id: 'swap',  label: 'swap'  },
  { id: 'yield', label: 'yield' },
];

interface Props { tab: Tab; onTab: (t: Tab) => void }

export const WalletTabs = memo(function WalletTabs({ tab, onTab }: Props) {
  const { colors } = useTheme();
  const softGlass  = useGlass('soft');
  return (
    <View style={[S.tabBar, softGlass]}>
      {TABS.map(t => {
        const on = tab === t.id;
        return (
          <Pressable key={t.id} onPress={() => onTab(t.id)} style={[S.tabBtn, on && { backgroundColor: colors.primary }]}>
            <Text style={[S.tabLabel, { color: on ? '#08080A' : colors.textTertiary, fontWeight: on ? '600' : '500' }]}>
              {t.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
});

const S = StyleSheet.create({
  tabBar:   { flexDirection: 'row', padding: 4, marginHorizontal: 20, borderRadius: 12, gap: 2 },
  tabBtn:   { flex: 1, paddingVertical: 10, borderRadius: 9, alignItems: 'center' },
  tabLabel: { fontFamily: fontFamily.sansMd, fontSize: 11, letterSpacing: 2, textTransform: 'uppercase' },
});

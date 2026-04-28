import { Tabs, usePathname, useRouter } from 'expo-router';
import React, { useMemo, useRef, useState, useEffect, useCallback } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import * as Haptics from 'expo-haptics';

import { HapticTab }          from '@/components/haptic-tab';
import { Feather }            from '@expo/vector-icons';
import { useTheme }           from '@/theme';
import { subscribeDrawer }    from '@/hooks/drawerState';

// ── Tab order ─────────────────────────────────────────────────────────────────
const TABS = ['/', '/wallet', '/nodes', '/settings'] as const;
type TabPath = typeof TABS[number];

function tabIdx(path: string): number {
  const i = TABS.indexOf(path as TabPath);
  return i === -1 ? 0 : i;
}

// ── Icons ─────────────────────────────────────────────────────────────────────
const MessagesIcon = ({ color }: { color: string }) => <Feather name="message-circle" size={22} color={color} />;
const WalletIcon   = ({ color }: { color: string }) => <Feather name="credit-card"    size={22} color={color} />;
const NodesIcon    = ({ color }: { color: string }) => <Feather name="share-2"        size={22} color={color} />;
const SettingsIcon = ({ color }: { color: string }) => <Feather name="sliders"        size={22} color={color} />;

// ── Layout ────────────────────────────────────────────────────────────────────
export default function TabLayout() {
  const { colors } = useTheme();
  const router     = useRouter();
  const pathname   = usePathname();

  // Disable tab swipe while PeersDrawer is open — prevents gesture stealing.
  const [drawerOpen, setDrawerOpen] = useState(false);
  useEffect(() => subscribeDrawer(setDrawerOpen), []);

  const pathnameRef = useRef(pathname);
  pathnameRef.current = pathname;

  const doNavigate = useCallback((tab: TabPath) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    router.navigate(tab);
  }, [router]);

  const swipe = useMemo(() => Gesture.Pan()
    .activeOffsetX([-30, 30])
    .failOffsetY([-20, 20])
    .enabled(!drawerOpen)
    .runOnJS(true)
    .onEnd(e => {
      const strong = Math.abs(e.translationX) > 80 || Math.abs(e.velocityX) > 400;
      if (!strong) return;

      const delta = (e.velocityX < 0 || e.translationX < -80) ? 1 : -1;
      const cur   = tabIdx(pathnameRef.current);
      const next  = Math.max(0, Math.min(TABS.length - 1, cur + delta));

      if (next !== cur) doNavigate(TABS[next]);
    }),
  [drawerOpen, doNavigate]);

  return (
    <GestureDetector gesture={swipe}>
      <View style={S.fill}>
        <Tabs
          screenOptions={{
            tabBarActiveTintColor:   colors.primary,
            tabBarInactiveTintColor: colors.textTertiary,
            tabBarStyle: {
              backgroundColor: colors.surface0,
              borderTopColor:  colors.borderSubtle,
              ...(Platform.OS === 'ios' && { paddingBottom: 0 }),
            },
            headerStyle:     { backgroundColor: colors.background },
            headerTintColor: colors.textPrimary,
            headerShown:     false,
            tabBarButton:    HapticTab,
          }}
        >
          <Tabs.Screen name="index"    options={{ title: 'Messages', tabBarIcon: MessagesIcon }} />
          <Tabs.Screen name="wallet"   options={{ title: 'Wallet',   tabBarIcon: WalletIcon   }} />
          <Tabs.Screen name="nodes"    options={{ title: 'Peers',    tabBarIcon: NodesIcon    }} />
          <Tabs.Screen name="settings" options={{ title: 'Settings', tabBarIcon: SettingsIcon }} />
        </Tabs>
      </View>
    </GestureDetector>
  );
}

const S = StyleSheet.create({
  fill: { flex: 1 },
});

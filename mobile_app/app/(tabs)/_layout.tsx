import { Tabs, usePathname, useRouter } from 'expo-router';
import React, { useMemo, useRef } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import * as Haptics from 'expo-haptics';

import { HapticTab } from '@/components/haptic-tab';
import { Feather }   from '@expo/vector-icons';
import { useTheme }  from '@/theme';
import { drawerIsOpen } from '@/hooks/drawerState';

// ── Tab order ─────────────────────────────────────────────────────────────────
// Must match the Tabs.Screen order below.
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

  // Keep pathname in a ref so the stable gesture closure always reads current route.
  const pathnameRef = useRef(pathname);
  pathnameRef.current = pathname;

  const swipe = useMemo(() => Gesture.Pan()
    // Needs ≥30px horizontal before activating — inner gestures (drawer at 10px,
    // MeshMap at 6px) grab the touch first in their own areas, no conflict.
    .activeOffsetX([-30, 30])
    // Fail immediately on scroll-like vertical movement.
    .failOffsetY([-20, 20])
    .runOnJS(true)
    .onEnd(e => {
      if (drawerIsOpen.current) return;
      // Require a deliberate swipe: 80px translation OR 400px/s velocity.
      const strong = Math.abs(e.translationX) > 80 || Math.abs(e.velocityX) > 400;
      if (!strong) return;

      const delta = (e.velocityX < 0 || e.translationX < -80) ? 1 : -1;
      const cur   = tabIdx(pathnameRef.current);
      const next  = Math.max(0, Math.min(TABS.length - 1, cur + delta));
      if (next === cur) return;

      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      router.navigate(TABS[next]);
    }),
  [router]);

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

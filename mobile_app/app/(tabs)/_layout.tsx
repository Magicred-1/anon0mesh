import { Tabs, usePathname, useRouter } from 'expo-router';
import React, { useMemo, useRef, useState, useEffect, useCallback } from 'react';
import { Animated, BackHandler, Platform, StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import * as Haptics from 'expo-haptics';

import { HapticTab }          from '@/components/haptic-tab';
import { Feather }            from '@expo/vector-icons';
import { fontFamily, useTheme } from '@/theme';
import { subscribeDrawer }    from '@/hooks/drawerState';
import { useSafeAreaInsets }  from 'react-native-safe-area-context';

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

// ── Exit toast ────────────────────────────────────────────────────────────────
const EXIT_WINDOW_MS = 2000;

function ExitToast({ visible }: { readonly visible: boolean }) {
  const { colors } = useTheme();
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(anim, {
      toValue:         visible ? 1 : 0,
      useNativeDriver: true,
      speed:           20,
      bounciness:      6,
    }).start();
  }, [visible, anim]);

  const translateY = anim.interpolate({ inputRange: [0, 1], outputRange: [24, 0] });

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        S.toast,
        {
          backgroundColor: colors.surface1,
          borderColor:     colors.border,
          opacity:         anim,
          transform:       [{ translateY }],
        },
      ]}
    >
      <Feather name="log-out" size={13} color={colors.primary} />
      <Text style={[S.toastText, { color: colors.textSecondary }]}>
        press back again to <Text style={{ color: colors.primary }}>exit</Text>
      </Text>
    </Animated.View>
  );
}

// ── Layout ────────────────────────────────────────────────────────────────────
export default function TabLayout() {
  const { colors } = useTheme();
  const insets     = useSafeAreaInsets();
  const router     = useRouter();
  const pathname   = usePathname();

  const [showExitToast, setShowExitToast] = useState(false);
  const exitWindowRef = useRef(false);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (exitWindowRef.current) {
        BackHandler.exitApp();
        return true;
      }
      exitWindowRef.current = true;
      setShowExitToast(true);
      toastTimerRef.current = setTimeout(() => {
        exitWindowRef.current = false;
        setShowExitToast(false);
      }, EXIT_WINDOW_MS);
      return true;
    });
    return () => {
      sub.remove();
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    };
  }, []);

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
              height:          56 + insets.bottom,
              paddingBottom:   insets.bottom,
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

        <ExitToast visible={showExitToast} />
      </View>
    </GestureDetector>
  );
}

const S = StyleSheet.create({
  fill: { flex: 1 },

  toast: {
    position:        'absolute',
    bottom:          90,
    alignSelf:       'center',
    flexDirection:   'row',
    alignItems:      'center',
    gap:             8,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius:    12,
    borderWidth:     0.5,
  },
  toastText: {
    fontFamily: fontFamily.sansMd,
    fontSize:   12,
    letterSpacing: 0.3,
  },
});

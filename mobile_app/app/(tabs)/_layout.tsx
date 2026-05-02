import { Tabs, usePathname, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  BackHandler,
  Keyboard,
  LayoutChangeEvent,
  Platform,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Gesture, GestureDetector, Pressable } from 'react-native-gesture-handler';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { TabActions } from '@react-navigation/native';
import Reanimated, {
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { Feather }            from '@expo/vector-icons';
import { fontFamily, useTheme } from '@/theme';
import { subscribeDrawer }    from '@/hooks/drawerState';
import { useSafeAreaInsets }  from 'react-native-safe-area-context';
import { appMotion } from '@/src/design-system/motion';
import * as haptics from '@/src/design-system/haptics';

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

const TAB_META: Record<string, { label: string; icon: React.ComponentProps<typeof Feather>['name'] }> = {
  index: { label: 'Messages', icon: 'message-circle' },
  wallet: { label: 'Wallet', icon: 'credit-card' },
  nodes: { label: 'Peers', icon: 'share-2' },
  settings: { label: 'Settings', icon: 'sliders' },
};

const ReanimatedPressable = Reanimated.createAnimatedComponent(Pressable);
const ReanimatedView = Reanimated.createAnimatedComponent(View);
const TAB_BAR_PADDING = 4;
const ACTIVE_PILL_INSET = 4;
const TAB_SWITCH_DURATION_MS = 52;

function tabHaptic() {
  haptics.select();
}

function PolishedTabButton({
  color,
  icon,
  isFocused,
  label,
  labelColor,
  onLongPress,
  onPress,
  onPressIn,
}: {
  color: string;
  icon: React.ComponentProps<typeof Feather>['name'];
  isFocused: boolean;
  label: string;
  labelColor: string;
  onLongPress: () => void;
  onPress: () => void;
  onPressIn: () => void;
}) {
  const pressed = useSharedValue(0);
  const tabStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: interpolate(pressed.value, [0, 1], [1, 0.96]) },
      {
        translateY: interpolate(
          pressed.value,
          [0, 1],
          [isFocused ? -1 : 0, appMotion.press.compression.translateY],
        ),
      },
    ],
  }));

  const iconStyle = useAnimatedStyle(() => ({
    opacity: interpolate(pressed.value, [0, 1], [1, 0.72]),
    transform: [
      { scale: interpolate(pressed.value, [0, 1], [1, appMotion.press.icon.scale]) },
    ],
  }));

  const handlePressIn = () => {
    pressed.value = withTiming(1, {
      duration: 45,
      easing: appMotion.easing.standard,
    });
    onPressIn();
    tabHaptic();
  };

  const handlePressOut = () => {
    pressed.value = withTiming(0, {
      duration: 70,
      easing: appMotion.easing.emphasis,
    });
  };

  return (
    <ReanimatedPressable
      accessibilityLabel={label}
      accessibilityRole="tab"
      accessibilityState={isFocused ? { selected: true } : {}}
      hitSlop={6}
      onLongPress={onLongPress}
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={[S.tab, tabStyle]}
    >
      <Reanimated.View style={[S.tabIcon, iconStyle]}>
        <Feather name={icon} size={21} color={color} />
      </Reanimated.View>
      <Text style={[S.tabLabel, { color: labelColor }]} numberOfLines={1}>
        {label}
      </Text>
    </ReanimatedPressable>
  );
}

function PolishedTabBar({ state, navigation }: BottomTabBarProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const [optimisticIndex, setOptimisticIndex] = useState(state.index);
  const [rowWidth, setRowWidth] = useState(0);
  const indicatorX = useSharedValue(0);
  const tabWidth = rowWidth > 0 ? rowWidth / state.routes.length : 0;
  const activeIndex = Math.min(optimisticIndex, state.routes.length - 1);

  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', () => setKeyboardVisible(true));
    const hide = Keyboard.addListener('keyboardDidHide', () => setKeyboardVisible(false));

    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  useEffect(() => {
    setOptimisticIndex(state.index);
  }, [state.index]);

  useEffect(() => {
    if (tabWidth <= 0) return;
    indicatorX.value = withTiming(activeIndex * tabWidth, {
      duration: TAB_SWITCH_DURATION_MS,
      easing: appMotion.easing.standard,
    });
  }, [activeIndex, indicatorX, tabWidth]);

  const indicatorStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: indicatorX.value }],
    width: tabWidth,
  }));

  const onLayout = (event: LayoutChangeEvent) => {
    setRowWidth(event.nativeEvent.layout.width);
  };

  if (keyboardVisible) {
    return null;
  }

  return (
    <View
      style={[
        S.navWrap,
        {
          backgroundColor: colors.background,
          height: 86 + insets.bottom,
          paddingBottom: insets.bottom,
        },
      ]}
    >
      <View style={S.navTrack}>
        <LinearGradient
          colors={[colors.surface1, colors.surface0]}
          end={{ x: 0.9, y: 1 }}
          start={{ x: 0.1, y: 0 }}
          style={[S.navBar, { borderColor: colors.border }]}
        >
          {tabWidth > 0 ? (
            <ReanimatedView
              pointerEvents="none"
              style={[
                S.activePill,
                indicatorStyle,
              ]}
            >
              <LinearGradient
                colors={[colors.surface2, colors.surface1]}
                end={{ x: 0, y: 1 }}
                start={{ x: 0, y: 0 }}
                style={StyleSheet.absoluteFill}
              />
            </ReanimatedView>
          ) : null}
          <View onLayout={onLayout} style={S.tabRow}>
            {state.routes.map((route, index) => {
              const isFocused = activeIndex === index;
              const meta = TAB_META[route.name] ?? {
                label: route.name,
                icon: 'circle' as React.ComponentProps<typeof Feather>['name'],
              };
              const color = isFocused ? colors.primary : colors.textTertiary;
              const labelColor = isFocused ? colors.textPrimary : colors.textTertiary;

              const onPressIn = () => {
                if (tabWidth > 0) {
                  indicatorX.value = withTiming(index * tabWidth, {
                    duration: TAB_SWITCH_DURATION_MS,
                    easing: appMotion.easing.standard,
                  });
                }
                setOptimisticIndex(index);
              };

              const onPress = () => {
                const event = navigation.emit({
                  type: 'tabPress',
                  target: route.key,
                  canPreventDefault: true,
                });

                if (event.defaultPrevented) {
                  setOptimisticIndex(state.index);
                  return;
                }

                if (!isFocused && !event.defaultPrevented) {
                  navigation.dispatch(TabActions.jumpTo(route.name, route.params));
                }
              };

              const onLongPress = () => {
                navigation.emit({
                  type: 'tabLongPress',
                  target: route.key,
                });
              };

              return (
                <View key={route.key} style={S.tabSlot}>
                  <PolishedTabButton
                    color={color}
                    icon={meta.icon}
                    isFocused={isFocused}
                    label={meta.label}
                    labelColor={labelColor}
                    onLongPress={onLongPress}
                    onPress={onPress}
                    onPressIn={onPressIn}
                  />
                </View>
              );
            })}
          </View>
        </LinearGradient>
      </View>
    </View>
  );
}

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
    haptics.lightPress();
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
          detachInactiveScreens={false}
          tabBar={(props) => <PolishedTabBar {...props} />}
          screenOptions={{
            tabBarActiveTintColor:   colors.primary,
            tabBarInactiveTintColor: colors.textTertiary,
            animation:            'none',
            freezeOnBlur:         false,
            headerStyle:     { backgroundColor: colors.background },
            headerTintColor: colors.textPrimary,
            headerShown:          false,
            lazy:                 false,
            tabBarHideOnKeyboard: true,
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

  navWrap: {
    justifyContent: 'flex-end',
    paddingHorizontal: 12,
    paddingTop: 8,
  },
  navTrack: {
    borderRadius: 16,
    elevation: 12,
    height: 68,
    justifyContent: 'center',
    position: 'relative',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.34,
    shadowRadius: 16,
  },
  navBar: {
    borderRadius: 16,
    borderWidth: 1,
    height: 68,
    overflow: 'hidden',
    padding: TAB_BAR_PADDING,
    position: 'relative',
  },
  tabRow: {
    flexDirection: 'row',
    height: '100%',
  },
  tabSlot: {
    flex: 1,
    minHeight: 54,
  },
  activePill: {
    borderRadius: 12,
    bottom: ACTIVE_PILL_INSET,
    left: ACTIVE_PILL_INSET,
    overflow: 'hidden',
    position: 'absolute',
    top: ACTIVE_PILL_INSET,
  },
  tab: {
    alignItems: 'center',
    borderRadius: 12,
    gap: 4,
    height: '100%',
    justifyContent: 'center',
    minHeight: 54,
    paddingVertical: 4,
    width: '100%',
  },
  tabIcon: {
    alignItems: 'center',
    height: 22,
    justifyContent: 'center',
    width: 26,
  },
  tabLabel: {
    fontFamily: fontFamily.sansMd,
    fontSize: 10,
    letterSpacing: 0.2,
    maxWidth: 68,
  },
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

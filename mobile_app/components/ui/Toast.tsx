import React, { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { fontFamily, fontSize, radii, useTheme } from '@/theme';

/**
 * Lightweight, non-blocking, auto-dismissing toast. A single <ToastHost/> is
 * mounted once in AppShell (see app/_layout.tsx, mirroring InAppNotificationBanner)
 * and any module can fire feedback via the imperative showToast(message).
 *
 * Unlike Alert.alert this never steals focus, never blocks the JS thread, and
 * matches the dark/cyan theme. Use it for transient confirmations ("Copied"),
 * NOT for choices/confirmations (those need a real dialog).
 */

const AUTO_MS = 2000;
const HIDDEN_Y = 40;

type Listener = (message: string) => void;

let listener: Listener | null = null;

/** Show a transient themed toast. No-op if no <ToastHost/> is mounted. */
export function showToast(message: string) {
  listener?.(message);
}

export function ToastHost() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [message, setMessage] = useState<string | null>(null);

  const translateY = useRef(new Animated.Value(HIDDEN_Y)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const seqRef = useRef(0);

  useEffect(() => {
    listener = (msg: string) => setMessage(msg);
    return () => {
      listener = null;
    };
  }, []);

  useEffect(() => {
    if (!message) return;

    const seq = ++seqRef.current;
    if (timerRef.current) clearTimeout(timerRef.current);

    translateY.setValue(HIDDEN_Y);
    opacity.setValue(0);
    Animated.parallel([
      Animated.spring(translateY, { toValue: 0, useNativeDriver: true, bounciness: 6 }),
      Animated.timing(opacity, { toValue: 1, duration: 160, useNativeDriver: true }),
    ]).start();

    timerRef.current = setTimeout(() => {
      Animated.parallel([
        Animated.spring(translateY, { toValue: HIDDEN_Y, useNativeDriver: true, overshootClamping: true }),
        Animated.timing(opacity, { toValue: 0, duration: 180, useNativeDriver: true }),
      ]).start(() => {
        // Only clear if no newer toast replaced this one mid-fade.
        if (seqRef.current === seq) setMessage(null);
      });
    }, AUTO_MS);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [message, opacity, translateY]);

  if (!message) return null;

  return (
    <Animated.View
      pointerEvents="none"
      accessibilityLiveRegion="polite"
      accessibilityRole="alert"
      style={[
        S.toast,
        { backgroundColor: colors.glass, borderColor: colors.border, bottom: insets.bottom + 24 },
        { opacity, transform: [{ translateY }] },
      ]}
    >
      <Feather name="check-circle" size={15} color={colors.primary} />
      <Text style={[S.text, { color: colors.textPrimary }]} numberOfLines={2}>
        {message}
      </Text>
    </Animated.View>
  );
}

const S = StyleSheet.create({
  toast: {
    position: 'absolute',
    left: 24,
    right: 24,
    zIndex: 1000,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 13,
    borderRadius: radii.lg,
    borderWidth: 0.5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 10,
  },
  text: {
    flex: 1,
    fontFamily: fontFamily.sansMd,
    fontSize: fontSize.sm,
    fontWeight: '600',
  },
});

import React, { useEffect, useRef } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { fontFamily, fontSize, radii, useTheme } from '@/theme';

export interface NotificationPayload {
  id:       number;
  sender:   string;
  body:     string;
  destHash: string;
}

interface Props {
  notification: NotificationPayload | null;
  onDismiss:    () => void;
  onPress:      (n: NotificationPayload) => void;
}

const BANNER_H = 72;
const AUTO_MS  = 4000;
const HIDDEN_Y = -(BANNER_H + 40);

export function InAppNotificationBanner({ notification, onDismiss, onPress }: Props) {
  const { colors }  = useTheme();
  const insets      = useSafeAreaInsets();
  const translateY  = useRef(new Animated.Value(HIDDEN_Y)).current;
  const timerRef    = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastNotif   = useRef<NotificationPayload | null>(null);

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);

    if (notification) {
      lastNotif.current = notification;
      Animated.spring(translateY, {
        toValue: insets.top + 10,
        useNativeDriver: true,
        bounciness: 6,
      }).start();
      timerRef.current = setTimeout(onDismiss, AUTO_MS);
    } else {
      Animated.spring(translateY, {
        toValue: HIDDEN_Y,
        useNativeDriver: true,
        overshootClamping: true,
      }).start();
    }

    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [notification, insets.top, onDismiss, translateY]);

  // Keep lastNotif so content doesn't blank during slide-out
  const n = notification ?? lastNotif.current;
  if (!n) return null;

  return (
    <Animated.View
      style={[
        S.banner,
        { backgroundColor: colors.glass, borderColor: colors.border },
        { transform: [{ translateY }] },
      ]}
    >
      <Pressable style={S.inner} onPress={() => { onDismiss(); onPress(n); }}>
        <View style={[S.iconWrap, { backgroundColor: colors.primarySubtle }]}>
          <Feather name="message-circle" size={18} color={colors.primary} />
        </View>
        <View style={S.text}>
          <Text style={[S.sender, { color: colors.textPrimary }]} numberOfLines={1}>
            {n.sender}
          </Text>
          <Text style={[S.body, { color: colors.textSecondary }]} numberOfLines={1}>
            {n.body}
          </Text>
        </View>
        <Pressable onPress={onDismiss} hitSlop={12} style={S.close}>
          <Feather name="x" size={14} color={colors.textTertiary} />
        </Pressable>
      </Pressable>
    </Animated.View>
  );
}

const S = StyleSheet.create({
  banner:   {
    position: 'absolute', left: 12, right: 12, zIndex: 999,
    borderRadius: radii.lg, borderWidth: 0.5,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 12, elevation: 10,
  },
  inner:    { flexDirection: 'row', alignItems: 'center', padding: 12, gap: 10 },
  iconWrap: { width: 40, height: 40, borderRadius: radii.md, alignItems: 'center', justifyContent: 'center' },
  text:     { flex: 1, minWidth: 0 },
  sender:   { fontFamily: fontFamily.sansMd, fontSize: fontSize.sm, fontWeight: '600', marginBottom: 2 },
  body:     { fontFamily: fontFamily.sansMd, fontSize: 11.5, opacity: 0.8 },
  close:    { padding: 4 },
});

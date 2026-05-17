import { Feather } from '@expo/vector-icons';
import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';
import { useNetworkMode } from '@/src/infrastructure/network';
import { useTheme } from '@/theme';

const CONFIG = {
  online:  { label: 'ONLINE',     icon: 'wifi'        as const, color: '#14F195' },
  mesh:    { label: 'MESH RELAY', icon: 'radio'       as const, color: '#00E5FF' },
  isolated: { label: 'ISOLATED',   icon: 'wifi-off'    as const, color: '#FF4444' },
};

export function NetworkStatusBadge() {
  const { colors, fontFamily, spacing } = useTheme();
  const { mode, adapter } = useNetworkMode();
  const cfg = CONFIG[mode];

  const pulseAnim = useRef(new Animated.Value(1)).current;
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    // a11y: skip pulse loop under "reduce motion" — color + label still
    // communicate the mesh/isolated state without animation.
    if (mode === 'online' || reduceMotion) {
      pulseAnim.setValue(1);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 0.3, duration: 900, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1,   duration: 900, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [mode, pulseAnim, reduceMotion]);

  return (
    <View style={[styles.row, { paddingHorizontal: spacing[5], marginBottom: spacing[2] }]}>
      <View style={[styles.badge, { backgroundColor: cfg.color + '18', borderColor: cfg.color + '40' }]}>
        <Animated.View style={[styles.dot, { backgroundColor: cfg.color, opacity: pulseAnim }]} />
        <Feather name={cfg.icon} size={11} color={cfg.color} />
        <Text style={[styles.label, { color: cfg.color, fontFamily: fontFamily.sansMd }]}>
          {cfg.label}
        </Text>
        {mode === 'mesh' && adapter.relayHash ? (
          <Text style={[styles.relay, { color: colors.textTertiary, fontFamily: fontFamily.sansMd }]}>
            via {adapter.relayHash.slice(0, 8)}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row:   { alignItems: 'flex-start' },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 0.5,
  },
  dot:   { width: 5, height: 5, borderRadius: 99 },
  label: { fontSize: 10, letterSpacing: 1.5, textTransform: 'uppercase' },
  relay: { fontSize: 10, letterSpacing: 0.5 },
});

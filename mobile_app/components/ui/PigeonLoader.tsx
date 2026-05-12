import React, { useEffect, useRef } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import Svg, { Circle } from 'react-native-svg';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { fontFamily, fontSize, useTheme } from '@/theme';
import * as haptics from '@/src/design-system/haptics';

const PIGEON_SRC = require('@/assets/animations/sending.webp');

const SPRITE = 280;
const CHECK_SIZE = 96;
const HALO_PAD = 28;
const RING_BOX = CHECK_SIZE + HALO_PAD * 2;
const RING_CENTER = RING_BOX / 2;

export type PigeonLoaderStatus = 'loading' | 'success';

interface Props {
  readonly visible: boolean;
  readonly status?: PigeonLoaderStatus;
  readonly label?: string;
  readonly sublabel?: string;
  readonly onCancel?: () => void;
  readonly testID?: string;
}

export function PigeonLoader({
  visible,
  status = 'loading',
  label,
  sublabel,
  onCancel,
  testID,
}: Props) {
  const { colors, spacing } = useTheme();
  const insets = useSafeAreaInsets();

  const pulse = useSharedValue(1);
  const pigeonOpacity = useSharedValue(1);
  const checkOpacity = useSharedValue(0);
  const checkScale = useSharedValue(0.4);

  const wasVisible = useRef(false);
  const wasSuccess = useRef(false);

  useEffect(() => {
    if (visible && !wasVisible.current) {
      haptics.mediumPress();
    }
    wasVisible.current = visible;
  }, [visible]);

  useEffect(() => {
    const isSuccess = status === 'success' && visible;
    if (isSuccess && !wasSuccess.current) {
      haptics.confirm();
      pigeonOpacity.value = withTiming(0, { duration: 220, easing: Easing.out(Easing.cubic) });
      checkOpacity.value = withDelay(80, withTiming(1, { duration: 280 }));
      checkScale.value = withDelay(
        80,
        withSpring(1, { damping: 9, mass: 0.9, stiffness: 140 }),
      );
    }
    if (!isSuccess && wasSuccess.current) {
      pigeonOpacity.value = withTiming(1, { duration: 180 });
      checkOpacity.value = withTiming(0, { duration: 140 });
      checkScale.value = 0.4;
    }
    wasSuccess.current = isSuccess;
  }, [status, visible, pigeonOpacity, checkOpacity, checkScale]);

  useEffect(() => {
    if (visible && status === 'loading') {
      pulse.value = withRepeat(
        withSequence(
          withTiming(1.03, { duration: 900, easing: Easing.inOut(Easing.sin) }),
          withTiming(1.00, { duration: 900, easing: Easing.inOut(Easing.sin) }),
        ),
        -1,
        false,
      );
    } else {
      cancelAnimation(pulse);
      pulse.value = withTiming(1, { duration: 240 });
    }
    return () => cancelAnimation(pulse);
  }, [visible, status, pulse]);

  const pigeonStyle = useAnimatedStyle(() => ({
    opacity: pigeonOpacity.value,
    transform: [{ scale: pulse.value }],
  }));

  const checkStyle = useAnimatedStyle(() => ({
    opacity: checkOpacity.value,
    transform: [{ scale: checkScale.value }],
  }));

  const resolvedLabel = label ?? (status === 'success' ? 'Sent' : 'Sending');

  return (
    <Modal
      visible={visible}
      transparent
      statusBarTranslucent
      animationType="fade"
      onRequestClose={() => { if (onCancel) onCancel(); }}
      testID={testID}
    >
      <View
        style={[S.backdrop, { backgroundColor: colors.background }]}
        accessible
        accessibilityRole="alert"
        accessibilityLabel={sublabel ? `${resolvedLabel}. ${sublabel}` : resolvedLabel}
        accessibilityLiveRegion="polite"
      >
        <View style={S.content}>
          <View style={S.spriteWrap}>
            <Animated.View style={[S.sprite, pigeonStyle]}>
              <Image
                source={PIGEON_SRC}
                style={S.pigeon}
                contentFit="contain"
                transition={0}
                recyclingKey="pigeon-sending"
              />
            </Animated.View>
            <Animated.View
              style={[S.sprite, checkStyle]}
              pointerEvents="none"
            >
              <View style={S.checkRingWrap}>
                <Svg width={RING_BOX} height={RING_BOX}>
                  <Circle
                    cx={RING_CENTER}
                    cy={RING_CENTER}
                    r={RING_CENTER - 2}
                    fill={colors.success}
                    fillOpacity={0.08}
                  />
                  <Circle
                    cx={RING_CENTER}
                    cy={RING_CENTER}
                    r={CHECK_SIZE / 2 + 8}
                    fill={colors.success}
                    fillOpacity={0.14}
                  />
                  <Circle
                    cx={RING_CENTER}
                    cy={RING_CENTER}
                    r={CHECK_SIZE / 2}
                    stroke={colors.success}
                    strokeOpacity={0.85}
                    strokeWidth={2.5}
                    fill="none"
                  />
                </Svg>
                <View style={S.checkIconLayer}>
                  <Feather name="check" size={CHECK_SIZE * 0.58} color={colors.success} />
                </View>
              </View>
            </Animated.View>
          </View>

          <Text
            style={[
              S.label,
              { color: colors.textPrimary, fontFamily: fontFamily.sansSb },
            ]}
            numberOfLines={1}
          >
            {resolvedLabel}
          </Text>
          {sublabel ? (
            <Text
              style={[
                S.sublabel,
                { color: colors.textSecondary, fontFamily: fontFamily.sans },
              ]}
              numberOfLines={2}
            >
              {sublabel}
            </Text>
          ) : null}
        </View>

        {onCancel && status === 'loading' ? (
          <Pressable
            onPress={onCancel}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Cancel"
            style={({ pressed }) => [
              S.cancel,
              {
                bottom: insets.bottom + spacing[6],
                opacity: pressed ? 0.55 : 1,
              },
            ]}
          >
            <Text style={[S.cancelText, { color: colors.textSecondary, fontFamily: fontFamily.sansMd }]}>
              Cancel
            </Text>
          </Pressable>
        ) : null}
      </View>
    </Modal>
  );
}

const S = StyleSheet.create({
  backdrop: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  spriteWrap: {
    width: SPRITE,
    height: SPRITE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sprite: {
    position: 'absolute',
    width: SPRITE,
    height: SPRITE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pigeon: {
    width: SPRITE,
    height: SPRITE,
  },
  checkRingWrap: {
    width: RING_BOX,
    height: RING_BOX,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkIconLayer: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    marginTop: 18,
    fontSize: fontSize['2xl'],
    letterSpacing: 0.2,
    textAlign: 'center',
  },
  sublabel: {
    marginTop: 8,
    fontSize: fontSize.sm,
    textAlign: 'center',
    maxWidth: 300,
  },
  cancel: {
    position: 'absolute',
    alignSelf: 'center',
    paddingVertical: 12,
    paddingHorizontal: 24,
  },
  cancelText: {
    fontSize: fontSize.md,
    letterSpacing: 0.4,
  },
});

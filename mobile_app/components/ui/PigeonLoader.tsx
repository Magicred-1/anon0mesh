import React, { useEffect, useRef, useState } from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  type TextStyle,
  useWindowDimensions,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import Svg, {
  Circle,
  Defs,
  RadialGradient as SvgRadialGradient,
  Rect,
  Stop,
} from 'react-native-svg';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useReducedMotion,
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
const SHOCK_START_DIAM = (CHECK_SIZE / 2 + 8) * 2;

export type PigeonLoaderStatus = 'loading' | 'success';

interface Props {
  readonly visible: boolean;
  readonly status?: PigeonLoaderStatus;
  readonly label?: string;
  readonly sublabel?: string;
  readonly onCancel?: () => void;
  readonly testID?: string;
}

function Spotlight() {
  const { colors } = useTheme();
  const { width, height } = useWindowDimensions();
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Svg width={width} height={height}>
        <Defs>
          <SvgRadialGradient id="pigeonSpot" cx="50%" cy="50%" r="65%" fx="50%" fy="50%">
            <Stop offset="0%" stopColor={colors.primary} stopOpacity={0.11} />
            <Stop offset="45%" stopColor={colors.primary} stopOpacity={0.04} />
            <Stop offset="100%" stopColor={colors.primary} stopOpacity={0} />
          </SvgRadialGradient>
        </Defs>
        <Rect x={0} y={0} width={width} height={height} fill="url(#pigeonSpot)" />
      </Svg>
    </View>
  );
}

interface SlideLabelProps {
  readonly text: string;
  readonly style: TextStyle | TextStyle[];
}

function SlideLabel({ text, style }: SlideLabelProps) {
  const [current, setCurrent] = useState(text);
  const [outgoing, setOutgoing] = useState<string | null>(null);

  const inY = useSharedValue(0);
  const inOpacity = useSharedValue(1);
  const outY = useSharedValue(0);
  const outOpacity = useSharedValue(0);

  const clearTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (text === current) return;

    setOutgoing(current);
    setCurrent(text);

    outY.value = 0;
    outOpacity.value = 1;
    outY.value = withTiming(-14, { duration: 260, easing: Easing.out(Easing.cubic) });
    outOpacity.value = withTiming(0, { duration: 220, easing: Easing.out(Easing.cubic) });

    inY.value = 14;
    inOpacity.value = 0;
    inY.value = withTiming(0, { duration: 320, easing: Easing.out(Easing.cubic) });
    inOpacity.value = withDelay(70, withTiming(1, { duration: 240 }));

    if (clearTimer.current) clearTimeout(clearTimer.current);
    clearTimer.current = setTimeout(() => setOutgoing(null), 340);
  }, [text, current, inY, inOpacity, outY, outOpacity]);

  useEffect(() => () => { if (clearTimer.current) clearTimeout(clearTimer.current); }, []);

  const inStyle = useAnimatedStyle(() => ({
    opacity: inOpacity.value,
    transform: [{ translateY: inY.value }],
  }));
  const outStyle = useAnimatedStyle(() => ({
    opacity: outOpacity.value,
    transform: [{ translateY: outY.value }],
  }));

  return (
    <View style={S.labelStage}>
      <Animated.View style={inStyle}>
        <Text style={style} numberOfLines={1}>{current}</Text>
      </Animated.View>
      {outgoing ? (
        <Animated.View style={[S.labelOut, outStyle]} pointerEvents="none">
          <Text style={style} numberOfLines={1}>{outgoing}</Text>
        </Animated.View>
      ) : null}
    </View>
  );
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
  const reduceMotion = useReducedMotion();

  const pulse = useSharedValue(1);
  const pigeonOpacity = useSharedValue(1);
  const checkOpacity = useSharedValue(0);
  const checkScale = useSharedValue(0.4);
  const shockScale = useSharedValue(0);
  const shockOpacity = useSharedValue(0);

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
      // Shockwave fires concurrently with the check so the ring is the
      // anchor and the wave reads as its emission, not a parallel event.
      shockScale.value = 0.85;
      shockOpacity.value = 0.55;
      shockScale.value = withDelay(
        80,
        withTiming(3.6, { duration: 720, easing: Easing.out(Easing.cubic) }),
      );
      shockOpacity.value = withDelay(
        80,
        withTiming(0, { duration: 720, easing: Easing.out(Easing.cubic) }),
      );
    }
    if (!isSuccess && wasSuccess.current) {
      pigeonOpacity.value = withTiming(1, { duration: 180 });
      checkOpacity.value = withTiming(0, { duration: 140 });
      checkScale.value = 0.4;
      shockScale.value = 0;
      shockOpacity.value = 0;
    }
    wasSuccess.current = isSuccess;
  }, [status, visible, pigeonOpacity, checkOpacity, checkScale, shockScale, shockOpacity]);

  useEffect(() => {
    // a11y: skip the infinite breathing pulse under "reduce motion". The
    // pigeon sprite, label, and (on success) the check ring + shockwave
    // already communicate progress.
    if (visible && status === 'loading' && !reduceMotion) {
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
  }, [visible, status, pulse, reduceMotion]);

  const pigeonStyle = useAnimatedStyle(() => ({
    opacity: pigeonOpacity.value,
    transform: [{ scale: pulse.value }],
  }));

  const checkStyle = useAnimatedStyle(() => ({
    opacity: checkOpacity.value,
    transform: [{ scale: checkScale.value }],
  }));

  const shockStyle = useAnimatedStyle(() => ({
    opacity: shockOpacity.value,
    transform: [{ scale: shockScale.value }],
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
      <View style={[S.backdrop, { backgroundColor: colors.background }]}>
        <Spotlight />

        <Animated.View
          pointerEvents="none"
          style={[
            S.shockwave,
            shockStyle,
            { borderColor: colors.success },
          ]}
        />

        <View
          style={S.content}
          accessible
          accessibilityRole="alert"
          accessibilityLabel={sublabel ? `${resolvedLabel}. ${sublabel}` : resolvedLabel}
          accessibilityLiveRegion="polite"
        >
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
            <Animated.View style={[S.sprite, checkStyle]} pointerEvents="none">
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

          <SlideLabel
            text={resolvedLabel}
            style={[
              S.label,
              { color: colors.textPrimary, fontFamily: fontFamily.sansSb },
            ]}
          />

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
  shockwave: {
    position: 'absolute',
    width: SHOCK_START_DIAM,
    height: SHOCK_START_DIAM,
    borderRadius: SHOCK_START_DIAM / 2,
    borderWidth: 1.5,
  },
  labelStage: {
    marginTop: 18,
    minHeight: fontSize['2xl'] * 1.4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  labelOut: {
    position: 'absolute',
  },
  label: {
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

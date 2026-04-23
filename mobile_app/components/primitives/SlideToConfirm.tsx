import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import React, { useState } from "react";
import { LayoutChangeEvent, StyleSheet, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  Extrapolation,
  interpolate,
  interpolateColor,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";

import * as haptics from "@/src/design-system/haptics";
import { appMotion } from "@/src/design-system/motion";
import { useTheme } from "@/theme";

// Slider dimensions — previously in componentTokens.slider.
const TRACK_HEIGHT = 62;
const TRACK_RADIUS = 36;
const KNOB_SIZE = 54;
const KNOB_RADIUS = 28;
const KNOB_INSET = 4;
const THRESHOLD = 0.82;
const MAGNET_START = 0.7;
const RESISTANCE_START = 0.95;

interface SlideToConfirmProps {
  label: string;
  onComplete: () => void;
}

export default function SlideToConfirm({ label, onComplete }: SlideToConfirmProps) {
  const { colors, fontFamily, fontSize } = useTheme();
  const [trackWidth, setTrackWidth] = useState(0);
  const translateX = useSharedValue(0);
  const engagement = useSharedValue(0);
  const crossedRef = useSharedValue(false);
  const maxTranslate = Math.max(trackWidth - KNOB_SIZE - KNOB_INSET * 2, 0);

  // Captured theme colors for animated-style interpolation.
  const trackBgIdle    = colors.surface1;
  const trackBgMid     = colors.surface2;
  const trackBgActive  = colors.surface0;
  const borderIdle     = colors.borderStrong;
  const borderMid      = "rgba(0,229,255,0.32)";
  const borderActive   = "rgba(92,255,59,0.45)";
  const knobIdle       = colors.primaryDim;
  const knobMid        = colors.primary;
  const knobActive     = colors.success;
  const knobBorderIdle = "rgba(255,255,255,0.18)";
  const knobBorderMid  = "rgba(255,255,255,0.12)";

  function fireThreshold() {
    haptics.lightPress();
  }

  function fireConfirm() {
    haptics.mediumPress();
    onComplete();
  }

  const pan = Gesture.Pan()
    .activeOffsetX(4)
    .failOffsetY([-10, 10])
    .onBegin(() => {
      crossedRef.value = false;
      engagement.value = withTiming(1, {
        duration: appMotion.duration.instant,
        easing: appMotion.easing.standard,
      });
    })
    .onUpdate((event) => {
      const raw = Math.max(0, event.translationX);
      const rawRatio = maxTranslate > 0 ? raw / maxTranslate : 0;
      let next = raw;

      if (rawRatio > MAGNET_START && rawRatio < 1) {
        const magneticPull = ((rawRatio - MAGNET_START) / (1 - MAGNET_START)) * maxTranslate * 0.06;
        next += magneticPull;
      }

      if (rawRatio > RESISTANCE_START) {
        const over = raw - maxTranslate * RESISTANCE_START;
        next = maxTranslate * RESISTANCE_START + over * 0.28;
      }

      translateX.value = Math.min(Math.max(next, 0), maxTranslate);

      const visualRatio = maxTranslate > 0 ? translateX.value / maxTranslate : 0;
      if (visualRatio >= THRESHOLD && !crossedRef.value) {
        crossedRef.value = true;
        runOnJS(fireThreshold)();
      } else if (visualRatio < THRESHOLD && crossedRef.value) {
        crossedRef.value = false;
      }
    })
    .onEnd(() => {
      const ratio = maxTranslate > 0 ? translateX.value / maxTranslate : 0;

      if (ratio >= THRESHOLD) {
        translateX.value = withTiming(
          maxTranslate,
          { duration: appMotion.duration.instant, easing: appMotion.easing.emphasis },
          (finished) => {
            if (finished) runOnJS(fireConfirm)();
          },
        );
      } else {
        crossedRef.value = false;
        translateX.value = withSpring(0, appMotion.spring.settle);
      }

      engagement.value = withTiming(0, {
        duration: appMotion.duration.quick,
        easing: appMotion.easing.standard,
      });
    });

  const trackStyle = useAnimatedStyle(() => {
    const progress = maxTranslate > 0 ? translateX.value / maxTranslate : 0;
    return {
      backgroundColor: interpolateColor(
        engagement.value + progress * 0.45,
        [0, 0.6, 1.45],
        [trackBgIdle, trackBgMid, trackBgActive],
      ),
      borderColor: interpolateColor(
        progress,
        [0, THRESHOLD, 1],
        [borderIdle, borderMid, borderActive],
      ),
      transform: [{ scale: interpolate(engagement.value, [0, 1], [1, 0.998], Extrapolation.CLAMP) }],
    };
  });

  const progressStyle = useAnimatedStyle(() => {
    const progress = maxTranslate > 0 ? translateX.value / maxTranslate : 0;
    return {
      opacity: interpolate(progress, [0, 0.3, 1], [0.78, 0.92, 1], Extrapolation.CLAMP),
      width: translateX.value + KNOB_SIZE,
    };
  });

  const labelStyle = useAnimatedStyle(() => {
    const progress = maxTranslate > 0 ? translateX.value / maxTranslate : 0;
    return {
      opacity: interpolate(progress, [0, 0.84, 1], [1, 0.14, 0], Extrapolation.CLAMP),
      transform: [{ translateX: interpolate(progress, [0, 1], [0, 8], Extrapolation.CLAMP) }],
    };
  });

  const readyLabelStyle = useAnimatedStyle(() => {
    const progress = maxTranslate > 0 ? translateX.value / maxTranslate : 0;
    return {
      opacity: interpolate(progress, [THRESHOLD - 0.08, THRESHOLD, 1], [0, 0.72, 1], Extrapolation.CLAMP),
      transform: [{ translateX: interpolate(progress, [THRESHOLD - 0.08, 1], [-10, 0], Extrapolation.CLAMP) }],
    };
  });

  const sheenStyle = useAnimatedStyle(() => {
    const progress = maxTranslate > 0 ? translateX.value / maxTranslate : 0;
    return {
      opacity: interpolate(progress, [0, 0.35, 1], [0.12, 0.2, 0.3], Extrapolation.CLAMP),
      transform: [{ translateX: interpolate(progress, [0, 1], [-18, 10], Extrapolation.CLAMP) }],
    };
  });

  const knobStyle = useAnimatedStyle(() => {
    const progress = maxTranslate > 0 ? translateX.value / maxTranslate : 0;
    return {
      backgroundColor: interpolateColor(
        progress,
        [0, 0.88, 1],
        [knobIdle, knobMid, knobActive],
      ),
      borderColor: interpolateColor(
        progress,
        [0, 1],
        [knobBorderIdle, knobBorderMid],
      ),
      shadowOpacity: interpolate(progress, [0, 1], [0.18, 0.24], Extrapolation.CLAMP),
      shadowRadius: interpolate(progress, [0, 1], [12, 16], Extrapolation.CLAMP),
      transform: [
        { translateX: translateX.value },
        { scale: interpolate(engagement.value, [0, 1], [1, 0.986], Extrapolation.CLAMP) },
      ],
    };
  });

  const iconStyle = useAnimatedStyle(() => {
    const progress = maxTranslate > 0 ? translateX.value / maxTranslate : 0;
    return {
      opacity: interpolate(progress, [0, 1], [0.94, 1], Extrapolation.CLAMP),
      transform: [{ translateX: interpolate(progress, [0, THRESHOLD, 1], [0, 1.5, 2.5], Extrapolation.CLAMP) }],
    };
  });

  const knobShadowStyle = useAnimatedStyle(() => {
    const progress = maxTranslate > 0 ? translateX.value / maxTranslate : 0;
    return {
      backgroundColor: interpolateColor(
        progress,
        [0, 0.88, 1],
        [knobIdle, knobMid, knobActive],
      ),
      transform: [
        { translateX: translateX.value },
        { scale: interpolate(engagement.value, [0, 1], [1, 0.986], Extrapolation.CLAMP) },
      ],
    };
  });

  function handleLayout(event: LayoutChangeEvent) {
    setTrackWidth(event.nativeEvent.layout.width);
  }

  return (
    <View style={styles.wrapper}>
      <Animated.View pointerEvents="none" style={[styles.knobShadowTwin, knobShadowStyle]} />
      <Animated.View onLayout={handleLayout} style={[styles.track, trackStyle]}>
        <View style={[styles.trackInnerHighlight, { backgroundColor: "rgba(255,255,255,0.05)" }]} />
        <Animated.View style={[styles.progressFill, { backgroundColor: colors.primarySubtle }, progressStyle]}>
          <Animated.View style={[styles.progressSheen, sheenStyle]}>
            <LinearGradient
              colors={["transparent", "rgba(255,255,255,0.18)", "transparent"]}
              end={{ x: 1, y: 0.5 }}
              start={{ x: 0, y: 0.5 }}
              style={styles.progressSheenFill}
            />
          </Animated.View>
        </Animated.View>
        <Animated.Text
          style={[
            styles.label,
            {
              color: colors.textPrimary,
              fontFamily: fontFamily.sansMd,
              fontSize: fontSize.lg,
            },
            labelStyle,
          ]}
        >
          {label}
        </Animated.Text>
        <Animated.Text
          style={[
            styles.readyLabel,
            {
              color: colors.textPrimary,
              fontFamily: fontFamily.sansMd,
              fontSize: fontSize.lg,
            },
            readyLabelStyle,
          ]}
        >
          Release to send
        </Animated.Text>
        <GestureDetector gesture={pan}>
          <Animated.View style={[styles.knob, { shadowColor: colors.primary }, knobStyle]}>
            <Animated.View style={iconStyle}>
              <Feather color={colors.background} name="arrow-right" size={22} />
            </Animated.View>
          </Animated.View>
        </GestureDetector>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { position: "relative" },
  knobShadowTwin: {
    borderRadius: KNOB_RADIUS,
    elevation: 8,
    height: KNOB_SIZE,
    left: KNOB_INSET,
    position: "absolute",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    top: (TRACK_HEIGHT - KNOB_SIZE) / 2,
    width: KNOB_SIZE,
    zIndex: 2,
  },
  track: {
    alignItems: "center",
    borderRadius: TRACK_RADIUS,
    borderWidth: 1,
    height: TRACK_HEIGHT,
    justifyContent: "center",
    overflow: "hidden",
    position: "relative",
  },
  trackInnerHighlight: {
    height: 1,
    left: 14,
    position: "absolute",
    right: 14,
    top: 0,
  },
  progressFill: {
    borderRadius: KNOB_RADIUS,
    bottom: KNOB_INSET,
    left: KNOB_INSET,
    overflow: "hidden",
    position: "absolute",
    top: KNOB_INSET,
  },
  progressSheen: {
    bottom: 0,
    left: 0,
    position: "absolute",
    top: 0,
    width: 54,
  },
  progressSheenFill: { flex: 1 },
  label: {
    letterSpacing: 0.1,
  },
  readyLabel: {
    letterSpacing: 0.1,
    position: "absolute",
  },
  knob: {
    alignItems: "center",
    borderRadius: KNOB_RADIUS,
    borderWidth: 1,
    height: KNOB_SIZE,
    justifyContent: "center",
    left: KNOB_INSET,
    position: "absolute",
    shadowOffset: { width: 0, height: 8 },
    width: KNOB_SIZE,
  },
});

import { useRouter } from "expo-router";
import React from "react";
import { Dimensions, StyleSheet, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import {
  runOnJS,
  type SharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";

import * as haptics from "@/src/design-system/haptics";
import { useTheme } from "@/theme";

const DISMISS_DISTANCE = 120;
const DISMISS_VELOCITY = 800;
const { height: SCREEN_HEIGHT } = Dimensions.get("window");

interface SwipeDismissHandleProps {
  /** Optional callback instead of router.back() */
  onDismiss?: () => void;
  /** Shared translate value to drive parent content transform */
  translateY: SharedValue<number>;
}

// Top-of-screen grab handle that pans to dismiss. Panning drives the
// `translateY` shared value (use it on the parent container to move
// the screen content with the gesture). Releasing past the threshold
// or with high velocity calls onDismiss (default: router.back()).
// Releasing under threshold springs back.
//
// Using a dedicated handle avoids the scroll-conflict issue of
// wrapping full screen content in a Pan gesture — only the handle
// itself captures the gesture; child scrollviews + pressables work
// normally.
export function SwipeDismissHandle({ onDismiss, translateY }: SwipeDismissHandleProps) {
  const router = useRouter();
  const { colors, spacing } = useTheme();

  function handleDismiss() {
    haptics.tap();
    if (onDismiss) onDismiss();
    else router.back();
  }

  const pan = Gesture.Pan()
    .activeOffsetY(8)
    .failOffsetY(-10)
    .onUpdate((e) => {
      // Only track downward; upward drag is clamped to 0.
      translateY.value = Math.max(0, e.translationY);
    })
    .onEnd((e) => {
      const past = translateY.value > DISMISS_DISTANCE || e.velocityY > DISMISS_VELOCITY;
      if (past) {
        translateY.value = withTiming(SCREEN_HEIGHT, { duration: 220 }, (done) => {
          if (done) runOnJS(handleDismiss)();
        });
      } else {
        translateY.value = withSpring(0, { damping: 22, stiffness: 320 });
      }
    });

  return (
    <GestureDetector gesture={pan}>
      <View
        style={[
          styles.touchArea,
          { paddingVertical: spacing[3] },
        ]}
      >
        <View
          style={[
            styles.bar,
            { backgroundColor: colors.textTertiary },
          ]}
        />
      </View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  touchArea: {
    alignItems: "center",
    justifyContent: "center",
  },
  bar: {
    borderRadius: 3,
    height: 4,
    opacity: 0.5,
    width: 44,
  },
});

import React, { useCallback, useEffect, useState } from "react";
import {
  Dimensions,
  Modal,
  Pressable,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  Easing,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";

import { useTheme } from "@/theme";

// Single source of truth for app bottom-sheet behavior. Built on
// react-native-gesture-handler + Reanimated so the gesture and animation
// run on the UI thread (1:1 finger tracking, no JS lag). Native RN Modal
// gives us a real platform overlay; we own the in-modal layout, gesture,
// and animation.
//
// Behavior:
// - Pan from anywhere on the sheet body. Inner Pressables/inputs still
//   receive their taps (Pan.activeOffsetY only claims after 12pt of
//   downward motion).
// - Native-thread translateY follows the finger 1:1 during drag.
// - Release past distance threshold OR with high downward velocity
//   dismisses; otherwise springs back.
// - Backdrop opacity interpolates with drag progress so the dim fades as
//   the sheet leaves.
// - Spring physics tuned snappy (damping 22, stiffness 250) — feels Apple-
//   adjacent without the gorhom dependency.
//
// Does NOT (yet) implement:
// - Scroll-to-dismiss handoff for inner ScrollView. Sheets with scrollable
//   content should add `simultaneousWithExternalGesture(scrollRef)` on
//   the pan gesture and gate translateY updates on scrollOffset === 0.
//   Add when the first consumer needs it (TxDetailModal post-merge).
// - Snap points. Single-position sheets only. Add if a sheet needs
//   medium/large states.

const SCREEN_HEIGHT = Dimensions.get("window").height;
const DISMISS_DISTANCE = 120;
const DISMISS_VELOCITY = 800;
// Open + close use timing with iOS-feel ease-out cubic — spring physics
// over SCREEN_HEIGHT travel are underdamped (oscillate / overshoot) and
// don't match Apple's modal-sheet animation curve. Timing is deterministic
// and matches the platform.
const TIMING_OPEN = { duration: 320, easing: Easing.out(Easing.cubic) } as const;
const TIMING_CLOSE = { duration: 220, easing: Easing.in(Easing.cubic) } as const;
// Snap-back after partial drag uses a real spring — short distance, no
// overshoot risk, feels natural after interactive gesture.
const SPRING_BACK = { damping: 22, stiffness: 320 } as const;

export interface AppBottomSheetProps {
  readonly visible: boolean;
  readonly onClose: () => void;
  readonly children: React.ReactNode;
  /** Hide the grab indicator. Apple convention keeps it; rare to disable. */
  readonly hideHandle?: boolean;
  readonly contentStyle?: StyleProp<ViewStyle>;
  readonly backgroundColor?: string;
  readonly borderColor?: string;
}

export function AppBottomSheet({
  visible,
  onClose,
  children,
  hideHandle = false,
  contentStyle,
  backgroundColor,
  borderColor,
}: AppBottomSheetProps) {
  const { colors } = useTheme();

  // translateY: 0 = fully open at rest position. SCREEN_HEIGHT = fully
  // off-screen. We animate between these two on visibility flip and during
  // drag.
  const translateY = useSharedValue(SCREEN_HEIGHT);

  // Internal mounted state lags the visible prop on close so the slide-down
  // animation finishes before the native Modal unmounts. Without this the
  // Modal would unmount the instant `visible` flips false, snapping the
  // sheet off-screen and skipping the animation.
  const [mounted, setMounted] = useState(visible);
  const finalizeClose = useCallback(() => setMounted(false), []);

  useEffect(() => {
    if (visible) {
      // Ensure mounted=true BEFORE animating so the Modal is on-screen by
      // the time the open animation runs. Reset translateY off-screen first
      // in case a previous open was interrupted mid-animation.
      setMounted(true);
      translateY.value = SCREEN_HEIGHT;
      translateY.value = withTiming(0, TIMING_OPEN);
    } else if (mounted) {
      translateY.value = withTiming(SCREEN_HEIGHT, TIMING_CLOSE, (finished) => {
        if (finished) runOnJS(finalizeClose)();
      });
    }
  }, [visible, mounted, translateY, finalizeClose]);

  // activeOffsetY(12) — single positive number — activates ONLY on
  // downward translation past 12pt. (Array form [12, SCREEN_HEIGHT]
  // means "activate when Y is OUTSIDE [12, SCREEN_HEIGHT]", which is
  // upward past 12 — opposite of what a pull-down dismiss needs.)
  const panGesture = Gesture.Pan()
    .activeOffsetY(12)
    .failOffsetY(-10)
    .onUpdate((e) => {
      translateY.value = Math.max(0, e.translationY);
    })
    .onEnd((e) => {
      const past = translateY.value > DISMISS_DISTANCE || e.velocityY > DISMISS_VELOCITY;
      if (past) {
        translateY.value = withTiming(SCREEN_HEIGHT, TIMING_CLOSE);
        runOnJS(onClose)();
      } else {
        translateY.value = withSpring(0, SPRING_BACK);
      }
    });

  const sheetAnimStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  const backdropAnimStyle = useAnimatedStyle(() => ({
    opacity: interpolate(translateY.value, [0, SCREEN_HEIGHT], [0.7, 0]),
  }));

  return (
    <Modal animationType="none" transparent visible={mounted} onRequestClose={onClose}>
      <View style={S.root}>
        {/* Dim overlay: full-screen, pointerEvents='none' so taps pass
            through to the dismissArea / sheet beneath. Opacity drives off
            the same shared value as the sheet so the dim fades as the
            sheet slides away. */}
        <Animated.View
          pointerEvents="none"
          style={[StyleSheet.absoluteFill, S.backdrop, backdropAnimStyle]}
        />

        {/* DismissArea: flex:1 fills only the space above the sheet (sheet
            has intrinsic height + maxHeight 90% pushed to bottom by
            justifyContent:flex-end on root). Tap-to-close lives here, not
            on an absoluteFill — so taps inside the sheet never hit a
            backdrop sibling and lose to a parent gesture claim. Same fix
            pattern as TxDetailModal post-debug. */}
        <Pressable style={S.dismissArea} onPress={onClose} />

        <GestureDetector gesture={panGesture}>
          <Animated.View
            style={[
              S.sheet,
              {
                backgroundColor: backgroundColor ?? colors.surface0,
                borderColor: borderColor ?? colors.borderStrong,
              },
              sheetAnimStyle,
            ]}
          >
            <SafeAreaView edges={["bottom"]}>
              {!hideHandle ? (
                <View style={S.handleWrap}>
                  <View style={[S.handleBar, { backgroundColor: colors.textTertiary }]} />
                </View>
              ) : null}
              <View style={[S.content, contentStyle]}>{children}</View>
            </SafeAreaView>
          </Animated.View>
        </GestureDetector>
      </View>
    </Modal>
  );
}

// Standalone grab-handle for surfaces that aren't AppBottomSheets but want
// the same visual indicator (e.g. route-style modals like the receive
// screen). The gesture is owned by the consumer; this is the visual only.
export function BottomSheetHandleBar({ style }: { readonly style?: StyleProp<ViewStyle> }) {
  const { colors } = useTheme();
  return (
    <View style={[S.handleWrap, style]}>
      <View style={[S.handleBar, { backgroundColor: colors.textTertiary }]} />
    </View>
  );
}

const S = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: "flex-end",
  },
  backdrop: {
    backgroundColor: "#000000",
  },
  dismissArea: {
    flex: 1,
  },
  sheet: {
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    borderTopWidth: 1,
    maxHeight: "90%",
    overflow: "hidden",
  },
  handleWrap: {
    alignItems: "center",
    paddingBottom: 8,
    paddingTop: 12,
  },
  handleBar: {
    borderRadius: 2,
    height: 4,
    opacity: 0.5,
    width: 36,
  },
  content: {
    paddingBottom: 16,
    paddingHorizontal: 16,
    paddingTop: 4,
  },
});

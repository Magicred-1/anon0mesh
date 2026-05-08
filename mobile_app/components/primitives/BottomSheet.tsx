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
import { Gesture, GestureDetector, GestureHandlerRootView } from "react-native-gesture-handler";
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
// and animation. Standard primitive — every new sheet in the app should
// use this; no per-screen ad-hoc gesture/animation rewrites.
//
// Behavior:
// - Pan from anywhere on the sheet body. Inner Pressables/inputs still
//   receive their taps (Pan.activeOffsetY(12) only claims after 12pt of
//   downward motion; failOffsetY(-10) yields entirely on upward intent).
// - Native-thread translateY follows the finger 1:1 during drag.
// - Release past distance threshold (120pt) OR with high downward velocity
//   (800px/s) dismisses; otherwise springs back to rest.
// - Open uses timing (320ms ease-out cubic) — matches iOS modal sheet curve
//   without the underdamped spring overshoot we'd get over SCREEN_HEIGHT.
// - Close uses timing (220ms ease-in cubic).
// - Snap-back after partial drag uses a real spring (damping 22, stiffness
//   320) — short distance, no overshoot risk, feels natural after gesture.
// - Backdrop opacity interpolates with drag progress so the dim fades as
//   the sheet leaves.
// - Internal mounted state lags `visible` prop on close so the slide-down
//   animation completes before the Modal unmounts.
//
// Critical wiring:
// - GestureHandlerRootView wraps the Modal contents. RN Modal renders in a
//   separate native view tree (Window/Dialog on Android, separate UIWindow
//   on iOS); the app-root GestureHandlerRootView does NOT propagate inside.
//   Without this wrap, gestures silently fail inside the sheet.
//
// Future extensions (add when first consumer needs them):
// - Scroll-to-dismiss handoff for inner ScrollView (TxDetailModal
//   post-merge): add `simultaneousWithExternalGesture(scrollRef)` to the
//   Pan + gate translateY updates on scrollOffset === 0.
// - Snap points (medium/large rest states): replace the binary
//   open/closed translateY targets with a snap-point array + projection.
// - Keyboard avoidance for sheets with TextInput (recovery export, send
//   amount entry): wrap content in KeyboardAvoidingView with offset.

// Use 'screen' (full device) not 'window' (excludes status bar) so the
// translate-off animation pushes content fully past system UI on Android.
// 'window' can leave a sliver of content under the gesture nav for sheets
// that extend edge-to-edge.
const SCREEN_HEIGHT = Dimensions.get("screen").height;
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
      {/* RN Modal renders contents in a separate native view tree (a
          new Window/Dialog on Android, a separate UIWindow on iOS).
          The app-root GestureHandlerRootView does NOT propagate into
          that tree, so gestures inside the modal need their own root.
          Without this wrap, GestureDetector sees no gestures.
          Documented in react-native-gesture-handler README under
          "Using inside Modal". */}
      <GestureHandlerRootView style={S.root}>
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
                borderColor: borderColor ?? colors.border,
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
      </GestureHandlerRootView>
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
    // Hairline divider only (StyleSheet.hairlineWidth is sub-pixel on iOS,
    // 1px on Android). Color defaults to colors.border (subtle), not
    // borderStrong (cyan-tinted = visible blue line at top of sheet).
    borderTopWidth: StyleSheet.hairlineWidth,
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

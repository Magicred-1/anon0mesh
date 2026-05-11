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
  Extrapolation,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
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
//   receive their taps (Pan.activeOffsetY(5) only claims after 5pt of
//   downward motion; failOffsetY(-10) yields entirely on upward intent;
//   activeOffsetX([-20, 20]) blocks diagonal flicks from triggering).
// - Native-thread translateY follows the finger 1:1 during drag.
// - Release past distance threshold (120pt) OR with high downward velocity
//   (800px/s) dismisses; otherwise springs back to rest.
// - Open: backdrop fades in over 200ms (leading), sheet slides up over
//   320ms (ease-out cubic). The lead establishes the dim before the sheet
//   visibly moves — iOS-standard sheet-modal feel. Without the lead, the
//   backdrop cross-fading with the slide reads as "dim rises with the
//   sheet" rather than as a separate scrim.
// - Close: backdrop + sheet animate in lockstep over 220ms (ease-in cubic).
// - Snap-back after partial drag uses timing (260ms ease-out exponential)
//   — deterministic, no overshoot. A spring here oscillates visibly on
//   settle after short drags where there's no perceptual cover for wobble.
// - During drag, backdrop opacity mirrors sheet translateY so the dim
//   fades as the sheet leaves. Decoupled on open, coupled on drag/close.
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
const BACKDROP_MAX_OPACITY = 0.7;
// Open + close use timing with iOS-feel ease-out cubic — spring physics
// over SCREEN_HEIGHT travel are underdamped (oscillate / overshoot) and
// don't match Apple's modal-sheet animation curve. Timing is deterministic
// and matches the platform.
const TIMING_OPEN = { duration: 320, easing: Easing.out(Easing.cubic) } as const;
const TIMING_CLOSE = { duration: 220, easing: Easing.in(Easing.cubic) } as const;
// Backdrop leads on open: fade in faster (200ms) so the dim is established
// BEFORE the sheet has visibly slid up. Without this lead, the backdrop
// opacity tied to a single translateY value reads as "dim rises with the
// sheet" rather than the iOS-standard "sheet rises onto already-dim canvas".
const TIMING_BACKDROP_OPEN = { duration: 200, easing: Easing.out(Easing.cubic) } as const;
// Snap-back after partial drag. Previously used a spring (damping 22,
// stiffness 320) which is mathematically underdamped — the system overshot
// the rest position and oscillated visibly on settle, especially after
// short drags where there's no perceptual cover for the wobble. Production
// sheet libraries (gorhom/bottom-sheet, etc.) use a deterministic timing
// curve here for exactly this reason: no overshoot, predictable duration,
// no visible jitter on settle.
const TIMING_SNAP_BACK = { duration: 260, easing: Easing.out(Easing.exp) } as const;
// Pan activation thresholds. Lowered from 12 → 5 because with Pressable
// children inside the sheet, RN's responder system may hold the touch
// through the first ~10pt of motion before Pressable cancels — by which
// time gesture-handler can miss the in-progress drag. 5pt activates the
// pan before that contention window, giving the gesture a fair shot.
// activeOffsetX constraint blocks diagonal flicks from claiming the pan.
const PAN_ACTIVE_Y = 5;
const PAN_FAIL_Y = -10;
const PAN_BLOCKED_X: [number, number] = [-20, 20];

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
  // backdropOpacity: 0 = invisible, 1 = full BACKDROP_MAX_OPACITY (0.7).
  // Decoupled from translateY so we can lead the open animation (dim
  // establishes before the sheet visibly slides) — without that lead the
  // cross-fade synchronized with the slide reads as "dim rises with the
  // sheet". During interactive drag the gesture's onUpdate keeps the two
  // in sync so dimming fades as the sheet leaves.
  const backdropOpacity = useSharedValue(0);

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
      backdropOpacity.value = 0;
      // Backdrop leads (200ms) — sheet follows (320ms). Net feel: dim
      // appears, then sheet rises onto already-dim background.
      backdropOpacity.value = withTiming(1, TIMING_BACKDROP_OPEN);
      translateY.value = withTiming(0, TIMING_OPEN);
    } else if (mounted) {
      translateY.value = withTiming(SCREEN_HEIGHT, TIMING_CLOSE, (finished) => {
        if (finished) runOnJS(finalizeClose)();
      });
      // Close fades both in lockstep — the dim leaves with the sheet so
      // the user doesn't see a lingering scrim over the post-dismissal UI.
      backdropOpacity.value = withTiming(0, TIMING_CLOSE);
    }
  }, [visible, mounted, translateY, backdropOpacity, finalizeClose]);

  // Pan activation tuned more aggressively than initial implementation
  // (was activeOffsetY 12, no X constraint). Inner Pressables compete for
  // the touch via RN's responder system; lowering the Y threshold and
  // blocking X motion gives the Pan a fair shot at claiming the gesture
  // before Pressable's press-cancel window. shouldCancelWhenOutside(false)
  // keeps the drag alive if the finger crosses the sheet's visible bounds.
  const panGesture = Gesture.Pan()
    .activeOffsetY(PAN_ACTIVE_Y)
    .failOffsetY(PAN_FAIL_Y)
    .activeOffsetX(PAN_BLOCKED_X)
    .shouldCancelWhenOutside(false)
    .onUpdate((e) => {
      const ty = Math.max(0, e.translationY);
      translateY.value = ty;
      // Mirror sheet position to backdrop while dragging so dismissal
      // fade-out feels coupled to the gesture.
      backdropOpacity.value = interpolate(
        ty,
        [0, SCREEN_HEIGHT],
        [1, 0],
        Extrapolation.CLAMP,
      );
    })
    .onEnd((e) => {
      const past = translateY.value > DISMISS_DISTANCE || e.velocityY > DISMISS_VELOCITY;
      if (past) {
        translateY.value = withTiming(SCREEN_HEIGHT, TIMING_CLOSE);
        backdropOpacity.value = withTiming(0, TIMING_CLOSE);
        runOnJS(onClose)();
      } else {
        translateY.value = withTiming(0, TIMING_SNAP_BACK);
        backdropOpacity.value = withTiming(1, TIMING_SNAP_BACK);
      }
    });

  const sheetAnimStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  const backdropAnimStyle = useAnimatedStyle(() => ({
    opacity: backdropOpacity.value * BACKDROP_MAX_OPACITY,
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

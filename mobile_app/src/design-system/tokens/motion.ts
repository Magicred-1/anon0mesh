import { Easing } from "react-native-reanimated";

export const motionTokens = {
  easing: {
    standard: Easing.bezier(0.2, 0.9, 0.24, 1),
    emphasis: Easing.bezier(0.16, 1, 0.3, 1),
    exit: Easing.bezier(0.4, 0, 0.68, 1),
  },
  duration: {
    instant: 110,
    quick: 160,
    standard: 220,
    linger: 280,
    press: 80,
    release: 160,
  },
  press: {
    compression: { scale: 0.94, translateY: 1 },
    surface: {
      row: { scale: 0.99 },
      strip: { scale: 0.995 },
      card: { scale: 0.99, shadowMultiplier: 0.6 },
    },
    icon: { scale: 0.92 },
  },
  spring: {
    direct: {
      damping: 24,
      stiffness: 360,
      mass: 0.9,
      overshootClamping: true,
    },
    settle: {
      damping: 26,
      stiffness: 340,
      mass: 0.92,
      overshootClamping: true,
    },
    sheet: {
      damping: 28,
      stiffness: 320,
      mass: 1,
      overshootClamping: true,
    },
    pressRelease: {
      damping: 18,
      stiffness: 260,
      mass: 0.9,
      overshootClamping: false,
    },
    iconRelease: {
      damping: 14,
      stiffness: 240,
      mass: 0.85,
      overshootClamping: false,
    },
  },
  travel: {
    subtle: 6,
    section: 12,
    success: 14,
  },
} as const;

export type MotionTokens = typeof motionTokens;

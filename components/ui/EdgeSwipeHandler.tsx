import React from 'react';
import {
  Dimensions,
  GestureResponderEvent,
  PanResponder,
  View
} from 'react-native';

interface Props {
  onOpenLeft?: () => void;
  onOpenRight?: () => void;
  onCloseLeft?: () => void;
  onCloseRight?: () => void;
  leftEdgeWidth?: number;
  rightEdgeWidth?: number;
  activationDistance?: number;
  children?: React.ReactNode;
  enabled?: boolean;
}

export default function EdgeSwipeHandler({
  onOpenLeft,
  onOpenRight,
  onCloseLeft,
  onCloseRight,
  leftEdgeWidth = 36,
  rightEdgeWidth = 36,
  activationDistance = 60,
  children,
  enabled = true,
}: Props) {
  const { width } = Dimensions.get('window');
  const triggeredRef = React.useRef<{ left: boolean; right: boolean }>({
    left: false,
    right: false,
  });

  const pan = React.useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: (evt: GestureResponderEvent) => {
        if (!enabled) return false;
        const x = evt.nativeEvent.pageX;
        // Start detection from edges or anywhere (to allow close gestures)
        return (
          x <= leftEdgeWidth ||
          x >= width - rightEdgeWidth ||
          // Allow mid-screen start if closing
          true
        );
      },
      onMoveShouldSetPanResponder: (evt, gestureState) => {
        if (!enabled) return false;
        return Math.abs(gestureState.dx) > 6;
      },
      onPanResponderGrant: () => {
        triggeredRef.current.left = false;
        triggeredRef.current.right = false;
      },
      onPanResponderMove: (evt, gestureState) => {
        const startX = evt.nativeEvent.pageX - gestureState.dx;
        const dx = gestureState.dx;

        // ---- OPEN gestures ----
        if (
          startX <= leftEdgeWidth &&
          dx > activationDistance &&
          !triggeredRef.current.left
        ) {
          triggeredRef.current.left = true;
          onOpenLeft?.();
        }

        if (
          startX >= width - rightEdgeWidth &&
          dx < -activationDistance &&
          !triggeredRef.current.right
        ) {
          triggeredRef.current.right = true;
          onOpenRight?.();
        }

        // ---- CLOSE gestures ----
        // Swiping back toward edge (left close = move left, right close = move right)
        if (
          startX > leftEdgeWidth + 10 &&
          dx < -activationDistance &&
          !triggeredRef.current.left
        ) {
          triggeredRef.current.left = true;
          onCloseLeft?.();
        }

        if (
          startX < width - rightEdgeWidth - 10 &&
          dx > activationDistance &&
          !triggeredRef.current.right
        ) {
          triggeredRef.current.right = true;
          onCloseRight?.();
        }
      },
      onPanResponderRelease: () => {
        triggeredRef.current.left = false;
        triggeredRef.current.right = false;
      },
      onPanResponderTerminate: () => {
        triggeredRef.current.left = false;
        triggeredRef.current.right = false;
      },
    })
  ).current;

  return (
    <View style={{ flex: 1 }} pointerEvents="box-none" {...pan.panHandlers}>
      {children}
    </View>
  );
}

import React from 'react';
import { Dimensions, GestureResponderEvent, PanResponder, PanResponderGestureState, View } from 'react-native';

interface Props {
    onOpenLeft?: () => void;
    onOpenRight?: () => void;
    leftEdgeWidth?: number; // px from left edge to start detection
    rightEdgeWidth?: number; // px from right edge to start detection
    activationDistance?: number; // px to move to trigger open
    children?: React.ReactNode;
    enabled?: boolean;
}

export default function EdgeSwipeHandler({
  onOpenLeft,
  onOpenRight,
  leftEdgeWidth = 36,
  rightEdgeWidth = 36,
  activationDistance = 60,
  children,
  enabled = true,
}: Props) {
  const { width } = Dimensions.get('window');
  const triggeredRef = React.useRef<{ left: boolean; right: boolean }>({ left: false, right: false });

  const pan = React.useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: (evt: GestureResponderEvent) => {
        if (!enabled) return false;
        return evt.nativeEvent.pageX <= leftEdgeWidth || evt.nativeEvent.pageX >= width - rightEdgeWidth;
      },
      onMoveShouldSetPanResponder: (evt: GestureResponderEvent, gestureState: PanResponderGestureState) => {
        if (!enabled) return false;
        // small vertical movement should not cancel
        return Math.abs(gestureState.dx) > 6;
      },
      onPanResponderGrant: () => {
        triggeredRef.current.left = false;
        triggeredRef.current.right = false;
      },
      onPanResponderMove: (evt: GestureResponderEvent, gestureState: PanResponderGestureState) => {
        const startX = evt.nativeEvent.pageX - gestureState.dx; // estimate initial
        const dx = gestureState.dx;

        // Left-edge swipe: started near left and moved right
        if (startX <= leftEdgeWidth && dx > activationDistance && !triggeredRef.current.left) {
          triggeredRef.current.left = true;
          onOpenLeft?.();
        }

        // Right-edge swipe: started near right and moved left
        if (startX >= width - rightEdgeWidth && dx < -activationDistance && !triggeredRef.current.right) {
          triggeredRef.current.right = true;
          onOpenRight?.();
        }
      },
      onPanResponderTerminationRequest: () => true,
      onPanResponderRelease: () => {
        // reset after release
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

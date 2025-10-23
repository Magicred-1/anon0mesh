import React from 'react';
import { Animated, Dimensions, Easing, GestureResponderEvent, PanResponder, PanResponderGestureState, StyleSheet, View } from 'react-native';

interface Props {
    onOpenLeft?: () => void;
    onOpenRight?: () => void;
    leftEdgeWidth?: number; // px from left edge to start detection
    rightEdgeWidth?: number; // px from right edge to start detection
    activationDistance?: number; // px to move to trigger open
    children?: React.ReactNode;
    enabled?: boolean;
    showVisualFeedback?: boolean; // Show animated edge indicator
}

export default function EdgeSwipeHandler({
    onOpenLeft,
    onOpenRight,
    leftEdgeWidth = 36,
    rightEdgeWidth = 36,
    activationDistance = 60,
    children,
    enabled = true,
    showVisualFeedback = true,
}: Props) {
    const { width } = Dimensions.get('window');
    const triggeredRef = React.useRef<{ left: boolean; right: boolean }>({ left: false, right: false });
    
    // Animation values for smooth visual feedback
    const leftEdgeOpacity = React.useRef(new Animated.Value(0)).current;
    const leftEdgeScale = React.useRef(new Animated.Value(0)).current;
    const rightEdgeOpacity = React.useRef(new Animated.Value(0)).current;
    const rightEdgeScale = React.useRef(new Animated.Value(0)).current;
    
    // Track which edge is active
    const activeEdgeRef = React.useRef<'left' | 'right' | null>(null);

    const animateEdgeIn = (edge: 'left' | 'right') => {
        const opacity = edge === 'left' ? leftEdgeOpacity : rightEdgeOpacity;
        const scale = edge === 'left' ? leftEdgeScale : rightEdgeScale;
        
        Animated.parallel([
        Animated.timing(opacity, {
            toValue: 0.3,
            duration: 150,
            easing: Easing.out(Easing.ease),
            useNativeDriver: true,
        }),
        Animated.spring(scale, {
            toValue: 1,
            tension: 80,
            friction: 8,
            useNativeDriver: true,
        }),
        ]).start();
    };

    const animateEdgeProgress = (edge: 'left' | 'right', progress: number) => {
        const opacity = edge === 'left' ? leftEdgeOpacity : rightEdgeOpacity;
        const scale = edge === 'left' ? leftEdgeScale : rightEdgeScale;
        
        // Clamp progress between 0 and 1
        const clampedProgress = Math.max(0, Math.min(1, progress));
        
        opacity.setValue(0.3 + clampedProgress * 0.4); // 0.3 to 0.7
        scale.setValue(0.8 + clampedProgress * 0.4); // 0.8 to 1.2
    };

    const animateEdgeOut = (edge: 'left' | 'right') => {
        const opacity = edge === 'left' ? leftEdgeOpacity : rightEdgeOpacity;
        const scale = edge === 'left' ? leftEdgeScale : rightEdgeScale;
        
        Animated.parallel([
        Animated.timing(opacity, {
            toValue: 0,
            duration: 200,
            easing: Easing.out(Easing.ease),
            useNativeDriver: true,
        }),
        Animated.timing(scale, {
            toValue: 0,
            duration: 200,
            easing: Easing.out(Easing.ease),
            useNativeDriver: true,
        }),
        ]).start();
    };

    const animateEdgeActivation = (edge: 'left' | 'right') => {
        const opacity = edge === 'left' ? leftEdgeOpacity : rightEdgeOpacity;
        const scale = edge === 'left' ? leftEdgeScale : rightEdgeScale;
        
        // Quick pulse animation on activation
        Animated.sequence([
        Animated.parallel([
            Animated.timing(opacity, {
            toValue: 1,
            duration: 100,
            useNativeDriver: true,
            }),
            Animated.spring(scale, {
            toValue: 1.3,
            tension: 100,
            friction: 6,
            useNativeDriver: true,
            }),
        ]),
        Animated.parallel([
            Animated.timing(opacity, {
            toValue: 0,
            duration: 200,
            useNativeDriver: true,
            }),
            Animated.timing(scale, {
            toValue: 0,
            duration: 200,
            useNativeDriver: true,
            }),
        ]),
        ]).start();
    };

    const pan = React.useRef(
        PanResponder.create({
        onStartShouldSetPanResponder: (evt: GestureResponderEvent) => {
            if (!enabled) return false;
            const isLeftEdge = evt.nativeEvent.pageX <= leftEdgeWidth;
            const isRightEdge = evt.nativeEvent.pageX >= width - rightEdgeWidth;
            
            if (isLeftEdge || isRightEdge) {
            activeEdgeRef.current = isLeftEdge ? 'left' : 'right';
            if (showVisualFeedback) {
                animateEdgeIn(activeEdgeRef.current);
            }
            return true;
            }
            return false;
        },
        onMoveShouldSetPanResponder: (evt: GestureResponderEvent, gestureState: PanResponderGestureState) => {
            if (!enabled) return false;
            // Only activate if horizontal movement is significant
            return Math.abs(gestureState.dx) > 6 && Math.abs(gestureState.dx) > Math.abs(gestureState.dy);
        },
        onPanResponderGrant: () => {
            triggeredRef.current.left = false;
            triggeredRef.current.right = false;
        },
        onPanResponderMove: (evt: GestureResponderEvent, gestureState: PanResponderGestureState) => {
            const startX = evt.nativeEvent.pageX - gestureState.dx;
            const dx = gestureState.dx;

            // Left-edge swipe: started near left and moved right
            if (startX <= leftEdgeWidth && dx > 0) {
            const progress = Math.min(dx / activationDistance, 1);
            
            if (showVisualFeedback && activeEdgeRef.current === 'left') {
                animateEdgeProgress('left', progress);
            }
            
            if (dx > activationDistance && !triggeredRef.current.left) {
                triggeredRef.current.left = true;
                if (showVisualFeedback) {
                animateEdgeActivation('left');
                }
                onOpenLeft?.();
            }
            }

            // Right-edge swipe: started near right and moved left
            if (startX >= width - rightEdgeWidth && dx < 0) {
            const progress = Math.min(Math.abs(dx) / activationDistance, 1);
            
            if (showVisualFeedback && activeEdgeRef.current === 'right') {
                animateEdgeProgress('right', progress);
            }
            
            if (dx < -activationDistance && !triggeredRef.current.right) {
                triggeredRef.current.right = true;
                if (showVisualFeedback) {
                animateEdgeActivation('right');
                }
                onOpenRight?.();
            }
            }
        },
        onPanResponderTerminationRequest: () => true,
        onPanResponderRelease: () => {
            // Animate out if not triggered
            if (showVisualFeedback && activeEdgeRef.current) {
            if (!triggeredRef.current.left && !triggeredRef.current.right) {
                animateEdgeOut(activeEdgeRef.current);
            }
            }
            
            // Reset
            triggeredRef.current.left = false;
            triggeredRef.current.right = false;
            activeEdgeRef.current = null;
        },
        onPanResponderTerminate: () => {
            if (showVisualFeedback && activeEdgeRef.current) {
            animateEdgeOut(activeEdgeRef.current);
            }
            
            triggeredRef.current.left = false;
            triggeredRef.current.right = false;
            activeEdgeRef.current = null;
        },
        })
    ).current;

    return (
        <View style={styles.container} pointerEvents="box-none" {...pan.panHandlers}>
        {showVisualFeedback && (
            <>
            {/* Left edge indicator */}
            <Animated.View
                style={[
                styles.edgeIndicator,
                styles.leftEdge,
                {
                    opacity: leftEdgeOpacity,
                    transform: [{ scaleY: leftEdgeScale }],
                },
                ]}
                pointerEvents="none"
            />
            
            {/* Right edge indicator */}
            <Animated.View
                style={[
                styles.edgeIndicator,
                styles.rightEdge,
                {
                    opacity: rightEdgeOpacity,
                    transform: [{ scaleY: rightEdgeScale }],
                },
                ]}
                pointerEvents="none"
            />
            </>
        )}
        
        {children}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    edgeIndicator: {
        position: 'absolute',
        top: 0,
        bottom: 0,
        width: 4,
        backgroundColor: '#007AFF',
        borderRadius: 2,
        shadowColor: '#007AFF',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.5,
        shadowRadius: 8,
        elevation: 5,
    },
    leftEdge: {
        left: 0,
    },
    rightEdge: {
        right: 0,
    },
});
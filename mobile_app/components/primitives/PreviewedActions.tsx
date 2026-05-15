import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Animated,
  Pressable,
  StyleProp,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from "react-native";
import * as Haptics from "expo-haptics";

import { useTheme } from "@/theme";

const HINT_TIMEOUT_MS = 1600;

interface PreviewedActionsProps {
  /** Children rendered inside a `pointerEvents="none"` wrapper at reduced opacity. */
  children: React.ReactNode;
  /** Hint label shown briefly when the outer surface is tapped. */
  hint?: string;
  /** Outer surface opacity. Defaults to 0.5. */
  opacity?: number;
  style?: StyleProp<ViewStyle>;
}

/**
 * Wraps roadmap-preview CTAs so they look real but cannot fire. Children are
 * rendered behind a `pointerEvents="none"` shield; tapping the outer surface
 * surfaces a transient "not yet active" hint and a light haptic.
 */
export function PreviewedActions({
  children,
  hint = "not yet active",
  opacity = 0.5,
  style,
}: PreviewedActionsProps) {
  const { colors, fontFamily, fontSize, radii, spacing } = useTheme();
  const [hintVisible, setHintVisible] = useState(false);
  const hintOpacity = useRef(new Animated.Value(0)).current;
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
  }, []);

  const handlePress = useCallback(() => {
    Haptics.selectionAsync().catch(() => {});
    setHintVisible(true);
    Animated.timing(hintOpacity, {
      toValue: 1,
      duration: 120,
      useNativeDriver: true,
    }).start();
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      Animated.timing(hintOpacity, {
        toValue: 0,
        duration: 240,
        useNativeDriver: true,
      }).start(() => setHintVisible(false));
    }, HINT_TIMEOUT_MS);
  }, [hintOpacity]);

  return (
    <View style={[styles.wrapper, style]}>
      <Pressable
        onPress={handlePress}
        accessibilityRole="button"
        accessibilityLabel={hint}
        accessibilityState={{ disabled: true }}
        style={styles.pressable}
      >
        <View pointerEvents="none" style={{ opacity }}>
          {children}
        </View>
      </Pressable>
      {hintVisible && (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.hint,
            {
              backgroundColor: colors.surface0,
              borderColor: colors.border,
              borderRadius: radii.full,
              paddingHorizontal: spacing[3],
              paddingVertical: spacing[1],
              opacity: hintOpacity,
            },
          ]}
        >
          <Text
            style={{
              color: colors.textSecondary,
              fontFamily: fontFamily.sansMd,
              fontSize: fontSize.xs,
              letterSpacing: 0.6,
              textTransform: "uppercase",
            }}
          >
            {hint}
          </Text>
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: "relative",
  },
  pressable: {
    width: "100%",
  },
  hint: {
    alignSelf: "center",
    borderWidth: 1,
    bottom: -28,
    position: "absolute",
  },
});

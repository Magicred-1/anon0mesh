import React, { useEffect, useState } from "react";
import { LayoutChangeEvent, StyleSheet, Text, View } from "react-native";
import { Pressable } from "react-native-gesture-handler";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

import * as haptics from "@/src/design-system/haptics";
import { appMotion } from "@/src/design-system/motion";
import { useTheme } from "@/theme";

interface Segment {
  id: string;
  label: string;
}

export type SegmentedControlTone = "cyan" | "purple";

interface SegmentedControlProps {
  segments: Segment[];
  selected: string;
  onSelect: (id: string) => void;
  tone?: SegmentedControlTone;
}

export function SegmentedControl({
  segments,
  selected,
  onSelect,
  tone = "cyan",
}: SegmentedControlProps) {
  const { colors, radii, spacing, fontFamily, fontSize } = useTheme();
  const [containerWidth, setContainerWidth] = useState(0);
  const segmentWidth = containerWidth > 0 ? containerWidth / segments.length : 0;
  const selectedIndex = segments.findIndex((s) => s.id === selected);
  const translateX = useSharedValue(0);

  const toneActive: Record<SegmentedControlTone, string> = {
    cyan:   colors.primary,
    purple: colors.accent,
  };
  const toneBorder: Record<SegmentedControlTone, string> = {
    cyan:   "rgba(0,229,255,0.32)",
    purple: "rgba(92,255,59,0.32)",
  };

  function handleLayout(e: LayoutChangeEvent) {
    setContainerWidth(e.nativeEvent.layout.width);
  }

  function handleSelect(id: string, index: number) {
    haptics.tap();
    translateX.value = withTiming(index * segmentWidth, {
      duration: appMotion.duration.standard,
      easing: appMotion.easing.standard,
    });
    onSelect(id);
  }

  useEffect(() => {
    translateX.value = withTiming(selectedIndex * segmentWidth, {
      duration: appMotion.duration.standard,
      easing: appMotion.easing.standard,
    });
  }, [segmentWidth, selectedIndex, translateX]);

  const thumbStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value + spacing[2] }],
    width: Math.max(segmentWidth - spacing[3], 0),
  }));

  const activeColor = toneActive[tone];
  const thumbBorderColor = toneBorder[tone];

  return (
    <View
      style={[
        styles.track,
        {
          backgroundColor: colors.surface0,
          borderColor: colors.border,
          borderRadius: radii.md,
          padding: spacing[2],
        },
      ]}
      onLayout={handleLayout}
    >
      <Animated.View
        style={[
          styles.thumb,
          {
            backgroundColor: colors.surface1,
            borderColor: thumbBorderColor,
            borderRadius: radii.sm,
            bottom: spacing[2],
            top: spacing[2],
          },
          thumbStyle,
        ]}
      />
      {segments.map(({ id, label }, index) => {
        const isActive = id === selected;
        return (
          <Pressable
            key={id}
            onPress={() => handleSelect(id, index)}
            style={styles.segment}
          >
            <Text
              style={[
                styles.label,
                {
                  color: colors.textSecondary,
                  fontFamily: fontFamily.sansMd,
                  fontSize: fontSize.md,
                },
                isActive && { color: activeColor, fontFamily: fontFamily.sansBold },
              ]}
            >
              {label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    borderWidth: 1,
    flexDirection: "row",
    height: 52,
    overflow: "hidden",
    position: "relative",
  },
  thumb: {
    borderWidth: 1,
    left: 0,
    position: "absolute",
  },
  segment: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
    zIndex: 1,
  },
  label: {
    letterSpacing: 0.3,
  },
});

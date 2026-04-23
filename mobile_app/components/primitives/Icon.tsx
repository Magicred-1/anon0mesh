import { Feather } from "@expo/vector-icons";
import type { ComponentProps } from "react";
import React from "react";
import { View } from "react-native";
import Svg, { Circle, Line, Path, Rect } from "react-native-svg";

type FeatherName = ComponentProps<typeof Feather>["name"];

type CustomIconName =
  | "mesh-nodes"
  | "signal"
  | "identity-chip"
  | "beacon"
  | "lock-mesh"
  | "stealth";

type IconName = FeatherName | CustomIconName;

const CUSTOM_ICONS: Set<CustomIconName> = new Set([
  "mesh-nodes",
  "signal",
  "identity-chip",
  "beacon",
  "lock-mesh",
  "stealth",
]);

interface IconProps {
  name: IconName;
  size?: number;
  color?: string;
}

function CustomIcon({ name, size, color }: { name: CustomIconName; size: number; color: string }) {
  switch (name) {
    case "mesh-nodes":
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <Circle cx="12" cy="12" r="3" stroke={color} strokeWidth={1.5} />
          <Circle cx="4" cy="7" r="2" stroke={color} strokeWidth={1.5} />
          <Circle cx="20" cy="7" r="2" stroke={color} strokeWidth={1.5} />
          <Circle cx="4" cy="17" r="2" stroke={color} strokeWidth={1.5} />
          <Circle cx="20" cy="17" r="2" stroke={color} strokeWidth={1.5} />
          <Line x1="9.5" y1="10.5" x2="5.5" y2="8.5" stroke={color} strokeWidth={1.2} />
          <Line x1="14.5" y1="10.5" x2="18.5" y2="8.5" stroke={color} strokeWidth={1.2} />
          <Line x1="9.5" y1="13.5" x2="5.5" y2="15.5" stroke={color} strokeWidth={1.2} />
          <Line x1="14.5" y1="13.5" x2="18.5" y2="15.5" stroke={color} strokeWidth={1.2} />
        </Svg>
      );
    case "signal":
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <Path d="M2 20 C 6 14, 10 10, 12 8" stroke={color} strokeWidth={1.5} strokeLinecap="round" fill="none" opacity={0.4} />
          <Path d="M5 20 C 8 15, 10.5 12, 12 10" stroke={color} strokeWidth={1.5} strokeLinecap="round" fill="none" opacity={0.65} />
          <Path d="M8 20 C 10 16, 11 14, 12 12" stroke={color} strokeWidth={1.5} strokeLinecap="round" fill="none" opacity={0.85} />
          <Path d="M11 20 L 12 15" stroke={color} strokeWidth={1.8} strokeLinecap="round" />
          <Circle cx="12" cy="21" r="1.2" fill={color} />
        </Svg>
      );
    case "identity-chip":
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <Rect x="6" y="8" width="12" height="8" rx="2" stroke={color} strokeWidth={1.5} />
          <Circle cx="12" cy="12" r="2" stroke={color} strokeWidth={1.2} />
          <Line x1="9" y1="5" x2="9" y2="8" stroke={color} strokeWidth={1.2} />
          <Line x1="12" y1="5" x2="12" y2="8" stroke={color} strokeWidth={1.2} />
          <Line x1="15" y1="5" x2="15" y2="8" stroke={color} strokeWidth={1.2} />
          <Line x1="9" y1="16" x2="9" y2="19" stroke={color} strokeWidth={1.2} />
          <Line x1="12" y1="16" x2="12" y2="19" stroke={color} strokeWidth={1.2} />
          <Line x1="15" y1="16" x2="15" y2="19" stroke={color} strokeWidth={1.2} />
        </Svg>
      );
    case "beacon":
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <Circle cx="12" cy="12" r="3" fill={color} />
          <Circle cx="12" cy="12" r="6" stroke={color} strokeWidth={1.2} opacity={0.5} />
          <Circle cx="12" cy="12" r="9" stroke={color} strokeWidth={1} opacity={0.25} />
        </Svg>
      );
    case "lock-mesh":
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <Rect x="5" y="11" width="14" height="10" rx="2" stroke={color} strokeWidth={1.5} />
          <Path d="M8 11V7a4 4 0 0 1 8 0v4" stroke={color} strokeWidth={1.5} strokeLinecap="round" />
          <Circle cx="12" cy="16" r="1.5" fill={color} />
        </Svg>
      );
    case "stealth":
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <Path d="M12 4 C 6 4 2 12 2 12 C 2 12 6 20 12 20 C 18 20 22 12 22 12 C 22 12 18 4 12 4Z" stroke={color} strokeWidth={1.5} fill="none" />
          <Circle cx="12" cy="12" r="3" fill={color} opacity={0.2} />
          <Path d="M3 3 L 21 21" stroke={color} strokeWidth={1.5} strokeLinecap="round" />
        </Svg>
      );
    default:
      return <View style={{ width: size, height: size }} />;
  }
}

export function Icon({ name, size = 20, color = "#ffffff" }: IconProps) {
  if (CUSTOM_ICONS.has(name as CustomIconName)) {
    return <CustomIcon name={name as CustomIconName} size={size} color={color} />;
  }
  return <Feather name={name as FeatherName} size={size} color={color} />;
}

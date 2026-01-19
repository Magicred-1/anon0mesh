import React from "react";
import { View } from "react-native";
import Svg, { Path } from "react-native-svg";

interface SolanaLogoProps {
  size?: number;
  color?: string;
}

export default function SolanaLogo({
  size = 120,
  color = "#26C6DA",
}: SolanaLogoProps) {
  return (
    <View style={{ width: size, height: size }}>
      <Svg
        width={size}
        height={size}
        viewBox="0 0 397.7 311.7"
        onLayout={() => {}}
      >
        <Path
          d="M64.6,237.9c2.4-2.4,5.7-3.8,9.2-3.8h317.4c5.8,0,8.7,7,4.6,11.1l-62.7,62.7c-2.4,2.4-5.7,3.8-9.2,3.8H6.5c-5.8,0-8.7-7-4.6-11.1L64.6,237.9z"
          fill={color}
        />
        <Path
          d="M64.6,3.8C67.1,1.4,70.4,0,73.8,0h317.4c5.8,0,8.7,7,4.6,11.1l-62.7,62.7c-2.4,2.4-5.7,3.8-9.2,3.8H6.5c-5.8,0-8.7-7-4.6-11.1L64.6,3.8z"
          fill={color}
        />
        <Path
          d="M333.1,120.1c-2.4-2.4-5.7-3.8-9.2-3.8H6.5c-5.8,0-8.7,7-4.6,11.1l62.7,62.7c2.4,2.4,5.7,3.8,9.2,3.8h317.4c5.8,0,8.7-7,4.6-11.1L333.1,120.1z"
          fill={color}
        />
      </Svg>
    </View>
  );
}

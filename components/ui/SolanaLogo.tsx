import React from 'react';
import { View } from 'react-native';
import Svg, { Defs, LinearGradient, Stop, Path } from 'react-native-svg';

interface SolanaLogoProps {
  size?: number;
  color?: string;
}

const SolanaLogo: React.FC<SolanaLogoProps> = ({ size = 24, color }) => {
  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size} viewBox="0 0 397.7 311.7">
        <Defs>
          <LinearGradient
            id="solanaGradient"
            x1="360.8791"
            y1="351.4553"
            x2="141.213"
            y2="-69.2936"
            gradientUnits="userSpaceOnUse"
          >
            <Stop offset="0" stopColor="#00FFA3" />
            <Stop offset="1" stopColor="#DC1FFF" />
          </LinearGradient>
        </Defs>
        <Path
          d="M64.6,237.9c2.4-2.4,5.7-3.8,9.2-3.8h317.4c5.8,0,8.7,7,4.6,11.1l-62.7,62.7c-2.4,2.4-5.7,3.8-9.2,3.8H6.5
          c-5.8,0-8.7-7-4.6-11.1L64.6,237.9z"
          fill={color || "url(#solanaGradient)"}
        />
        <Path
          d="M64.6,3.8C67.1,1.4,70.4,0,73.8,0h317.4c5.8,0,8.7,7,4.6,11.1l-62.7,62.7c-2.4,2.4-5.7,3.8-9.2,3.8H6.5
          c-5.8,0-8.7-7-4.6-11.1L64.6,3.8z"
          fill={color || "url(#solanaGradient)"}
        />
        <Path
          d="M333.1,120.1c-2.4-2.4-5.7-3.8-9.2-3.8H6.5c-5.8,0-8.7,7-4.6,11.1l62.7,62.7c2.4,2.4,5.7,3.8,9.2,3.8h317.4
          c5.8,0,8.7-7,4.6-11.1L333.1,120.1z"
          fill={color || "url(#solanaGradient)"}
        />
      </Svg>
    </View>
  );
};

export default SolanaLogo;
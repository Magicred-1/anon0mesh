import React from 'react';
import { View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

interface ReceiveIconProps {
  size?: number;
  color?: string;
}

const ReceiveIcon: React.FC<ReceiveIconProps> = ({ size = 24, color = "#FFFFFF" }) => {
  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size} viewBox="0 0 24 24">
        {/* Simple downward arrow */}
        <Path
          d="M12 3v14m-6-6l6 6 6-6"
          stroke={color}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
        
        {/* Base line */}
        <Path
          d="M4 21h16"
          stroke={color}
          strokeWidth="2"
          strokeLinecap="round"
        />
      </Svg>
    </View>
  );
};

export default ReceiveIcon;
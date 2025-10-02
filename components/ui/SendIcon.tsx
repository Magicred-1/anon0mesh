import React from 'react';
import { View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

interface SendIconProps {
  size?: number;
  color?: string;
}

const SendIcon: React.FC<SendIconProps> = ({ size = 24, color = "#FFFFFF" }) => {
  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size} viewBox="0 0 24 24">
        {/* Simple upward arrow */}
        <Path
          d="M12 21V7m6 6l-6-6-6 6"
          stroke={color}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
        
        {/* Base line */}
        <Path
          d="M4 3h16"
          stroke={color}
          strokeWidth="2"
          strokeLinecap="round"
        />
      </Svg>
    </View>
  );
};

export default SendIcon;
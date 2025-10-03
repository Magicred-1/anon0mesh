import React from 'react';
import { View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

interface PenIconProps {
  size?: number;
  color?: string;
}

const PenIcon: React.FC<PenIconProps> = ({ size = 16, color = "#888888" }) => {
  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size} viewBox="0 0 24 24">
        {/* Pen/Edit icon */}
        <Path
          d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"
          fill={color}
        />
      </Svg>
    </View>
  );
};

export default PenIcon;
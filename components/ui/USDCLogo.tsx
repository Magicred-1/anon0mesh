import React from 'react';
import { View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

interface USDCLogoProps {
  size?: number;
  color?: string;
}

const USDCLogo: React.FC<USDCLogoProps> = ({ size = 24, color = "#2775CA" }) => {
  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size} viewBox="0 0 32 32">
        {/* Main circle background */}
        <Circle
          cx="16"
          cy="16"
          r="16"
          fill={color}
        />
        
        {/* Inner circles pattern */}
        <Circle
          cx="16"
          cy="16"
          r="13"
          fill="none"
          stroke="#FFFFFF"
          strokeWidth="0.8"
        />
        
        <Circle
          cx="16"
          cy="16"
          r="10.5"
          fill="none"
          stroke="#FFFFFF"
          strokeWidth="0.8"
        />
        
        {/* USD text */}
        <Path
          d="M9.5 12.5 L9.5 11.8 L12.2 11.8 L12.2 9.5 L13.2 9.5 L13.2 11.8 L14.5 11.8 
             C15.6 11.8 16.5 12.7 16.5 13.8 C16.5 14.9 15.6 15.8 14.5 15.8 L13.2 15.8 
             L13.2 18.5 L14.5 18.5 C15.6 18.5 16.5 19.4 16.5 20.5 C16.5 21.6 15.6 22.5 14.5 22.5 
             L13.2 22.5 L13.2 24.5 L12.2 24.5 L12.2 22.5 L9.5 22.5 L9.5 21.8 L12.2 21.8 
             L12.2 18.5 L9.5 18.5 L9.5 17.8 L12.2 17.8 L12.2 15.8 L9.5 15.8 L9.5 15.1 
             L12.2 15.1 L12.2 12.5 L9.5 12.5 Z M13.2 12.5 L13.2 15.1 L14.5 15.1 
             C15.2 15.1 15.8 14.5 15.8 13.8 C15.8 13.1 15.2 12.5 14.5 12.5 L13.2 12.5 Z 
             M13.2 18.5 L13.2 21.8 L14.5 21.8 C15.2 21.8 15.8 21.2 15.8 20.5 
             C15.8 19.8 15.2 19.2 14.5 19.2 L13.2 19.2 L13.2 18.5 Z"
          fill="#FFFFFF"
        />
        
        {/* C letter */}
        <Path
          d="M19.5 13.5 C20.8 13.5 21.8 14.5 21.8 15.8 L21.8 16.2 L23.5 16.2 L23.5 15.8 
             C23.5 13.6 21.9 12 19.7 12 C17.5 12 15.9 13.6 15.9 15.8 L15.9 18.2 
             C15.9 20.4 17.5 22 19.7 22 C21.9 22 23.5 20.4 23.5 18.2 L23.5 17.8 
             L21.8 17.8 L21.8 18.2 C21.8 19.5 20.8 20.5 19.5 20.5 C18.2 20.5 17.2 19.5 17.2 18.2 
             L17.2 15.8 C17.2 14.5 18.2 13.5 19.5 13.5 Z"
          fill="#FFFFFF"
        />
      </Svg>
    </View>
  );
};

export default USDCLogo;
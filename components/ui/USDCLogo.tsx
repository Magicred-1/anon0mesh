import React from 'react';
import { View } from 'react-native';
import Svg, { Circle, Path, Defs, LinearGradient, Stop } from 'react-native-svg';

interface USDCLogoProps {
  size?: number;
}

/**
 * Official USDC Logo
 * Based on Circle's brand guidelines
 */
const USDCLogo: React.FC<USDCLogoProps> = ({ size = 24 }) => {
  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size} viewBox="0 0 2000 2000">
        <Defs>
          <LinearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <Stop offset="0%" stopColor="#2775CA" />
            <Stop offset="100%" stopColor="#2775CA" />
          </LinearGradient>
        </Defs>
        
        {/* Background Circle */}
        <Circle cx="1000" cy="1000" r="1000" fill="url(#gradient)" />
        
        {/* White Circle Border */}
        <Circle 
          cx="1000" 
          cy="1000" 
          r="835" 
          fill="none" 
          stroke="#FFFFFF" 
          strokeWidth="110"
        />
        
        {/* USD Text */}
        <Path
          d="M650,750 L650,700 L750,700 L750,550 L850,550 L850,700 L950,700 
             C1050,700 1150,800 1150,900 C1150,1000 1050,1100 950,1100 L850,1100 
             L850,1300 L950,1300 C1050,1300 1150,1400 1150,1500 C1150,1600 1050,1700 950,1700 
             L850,1700 L850,1850 L750,1850 L750,1700 L650,1700 L650,1650 L750,1650 
             L750,1300 L650,1300 L650,1250 L750,1250 L750,1100 L650,1100 L650,1050 
             L750,1050 L750,750 L650,750 Z M850,750 L850,1050 L950,1050 
             C1000,1050 1050,1000 1050,950 C1050,900 1000,850 950,850 L850,850 Z 
             M850,1300 L850,1650 L950,1650 C1000,1650 1050,1600 1050,1550 
             C1050,1500 1000,1450 950,1450 L850,1450 L850,1300 Z"
          fill="#FFFFFF"
        />
        
        {/* C Letter */}
        <Path
          d="M1300,800 C1450,800 1550,900 1550,1050 L1550,1100 L1700,1100 L1700,1050 
             C1700,800 1500,600 1250,600 C1000,600 800,800 800,1050 L800,1350 
             C800,1600 1000,1800 1250,1800 C1500,1800 1700,1600 1700,1350 L1700,1300 
             L1550,1300 L1550,1350 C1550,1500 1450,1600 1300,1600 C1150,1600 1050,1500 1050,1350 
             L1050,1050 C1050,900 1150,800 1300,800 Z"
          fill="#FFFFFF"
        />
      </Svg>
    </View>
  );
};

export default USDCLogo;
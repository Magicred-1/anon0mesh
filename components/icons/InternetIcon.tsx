import React from 'react';
import { View } from 'react-native';
// @ts-ignore
import InternetSvg from '../../assets/images/icons/internet_icon.svg';

const InternetIcon = ({ size = 32, color = "#ffff" }: { size?: number, color?: string }) => {
  return (
    <View style={{ width: size, height: size, justifyContent: 'center', alignItems: 'center' }}>
      <InternetSvg width={size} height={size} fill={color} />
    </View>
  );
};

export default InternetIcon;


import { WifiHigh } from 'phosphor-react-native';
import React from 'react';

const InternetIcon = ({ size = 32, color = '#ffff' }: { size?: number; color?: string }) => {
  return <WifiHigh size={size} color={color} weight="regular" />;
};

export default InternetIcon;


import { Globe } from 'phosphor-react-native';
import React from 'react';

const GlobeIcon = ({ size = 32, color = "#fff" }: { size?: number; color?: string }) => {
  return <Globe size={size} color={color} weight="regular" />;
};

export default GlobeIcon;

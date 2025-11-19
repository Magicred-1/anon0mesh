import { ArrowsLeftRight } from 'phosphor-react-native';
import React from 'react';

const SwapIcon = ({ size = 32, color = '#000000' }: { size?: number; color?: string }) => {
  return <ArrowsLeftRight size={size} color={color} weight="regular" />;
};

export default SwapIcon;

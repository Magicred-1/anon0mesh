import { ArrowDown } from 'phosphor-react-native';
import React from 'react';

const ReceiveIcon = ({ size = 32, color }: { size?: number; color?: string }) => {
  return <ArrowDown size={size} color={color} weight="regular" />;
};

export default ReceiveIcon;

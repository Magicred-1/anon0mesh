import { Lock } from 'phosphor-react-native';
import React from 'react';

const LockIcon = ({ size = 32, color = "#fff" }: { size?: number; color?: string }) => {
  return <Lock size={size} color={color} weight="regular" />;
};

export default LockIcon;

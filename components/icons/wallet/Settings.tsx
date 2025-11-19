import { Gear } from 'phosphor-react-native';
import React from 'react';

const SettingsIcon = ({ size = 32, color }: { size?: number; color?: string }) => {
  return <Gear size={size} color={color} weight="regular" />;
};

export default SettingsIcon;

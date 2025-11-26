import { Ghost } from 'phosphor-react-native';
import React from 'react';

const GhostIcon = ({ size = 32, color = "#fff" }: { size?: number; color?: string }) => {
  return <Ghost size={size} color={color} weight="regular" />;
};

export default GhostIcon;

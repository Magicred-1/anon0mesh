import { Network } from 'phosphor-react-native';
import React from 'react';

interface MeshZoneIconProps {
  size?: number;
  color?: string;
}

export default function MeshZoneIcon({ size = 32, color = '#22D3EE' }: MeshZoneIconProps) {
  return <Network size={size} color={color} weight="regular" />;
}

import { User } from 'phosphor-react-native';
import React from 'react';

interface ProfileIconProps {
  size?: number;
  color?: string;
}

export default function ProfileIcon({ size = 32, color = '#22D3EE' }: ProfileIconProps) {
  return <User size={size} color={color} weight="regular" />;
}

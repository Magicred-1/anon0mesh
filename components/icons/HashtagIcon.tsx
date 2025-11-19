import { Hash } from 'phosphor-react-native';
import React from 'react';

interface HashtagIconProps {
  width?: number;
  height?: number;
  color?: string;
}

export default function HashtagIcon({ width = 24, height = 24, color = '#FFFFFF' }: HashtagIconProps) {
  return <Hash size={width} color={color} weight="regular" />;
}

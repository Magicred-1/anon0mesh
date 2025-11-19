import { PaperPlaneTilt } from 'phosphor-react-native';
import React from 'react';

interface SendIconProps {
  width?: number;
  height?: number;
  color?: string;
}

export default function SendIcon({ width = 24, height = 24, color = '#FFFFFF' }: SendIconProps) {
  return <PaperPlaneTilt size={width} color={color} weight="regular" />;
}

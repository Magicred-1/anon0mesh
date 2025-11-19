import { ClockClockwise } from 'phosphor-react-native';
import React from 'react';

interface HistoryIconProps {
  size?: number;
  color?: string;
}

export default function HistoryIcon({ size = 32, color = '#22D3EE' }: HistoryIconProps) {
  return <ClockClockwise size={size} color={color} weight="regular" />;
}

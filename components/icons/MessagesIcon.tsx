import { ChatCircle } from 'phosphor-react-native';
import React from 'react';

interface MessagesIconProps {
  size?: number;
  color?: string;
}

export default function MessagesIcon({ size = 32, color = '#22D3EE' }: MessagesIconProps) {
  return <ChatCircle size={size} color={color} weight="regular" />;
}

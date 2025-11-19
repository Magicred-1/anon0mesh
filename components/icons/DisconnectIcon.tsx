import { Plugs } from 'phosphor-react-native';
import React from 'react';

interface DisconnectIconProps {
  size?: number;
  color?: string;
}

export default function DisconnectIcon({ size = 32, color = '#22D3EE' }: DisconnectIconProps) {
  return <Plugs size={size} color={color} weight="regular" />;
}

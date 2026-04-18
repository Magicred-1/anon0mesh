import React, { memo } from 'react';
import Svg, { Path } from 'react-native-svg';

interface Props { size?: number; color?: string }

export const SolanaIcon = memo(function SolanaIcon({ size = 28, color = '#00e5ff' }: Props) {
  // viewBox 397.7 x 311.7 → landscape, keep aspect ratio
  const h = size * (311.7 / 397.7);
  return (
    <Svg width={size} height={h} viewBox="0 0 397.7 311.7">
      <Path fill={color} d="M64.6,237.9c2.4-2.4,5.7-3.8,9.2-3.8h317.4c5.8,0,8.7,7,4.6,11.1l-62.7,62.7c-2.4,2.4-5.7,3.8-9.2,3.8H6.5c-5.8,0-8.7-7-4.6-11.1L64.6,237.9z" />
      <Path fill={color} d="M64.6,3.8C67.1,1.4,70.4,0,73.8,0h317.4c5.8,0,8.7,7,4.6,11.1l-62.7,62.7c-2.4,2.4-5.7,3.8-9.2,3.8H6.5c-5.8,0-8.7-7-4.6-11.1L64.6,3.8z" />
      <Path fill={color} d="M333.1,120.1c-2.4-2.4-5.7-3.8-9.2-3.8H6.5c-5.8,0-8.7,7-4.6,11.1l62.7,62.7c2.4,2.4,5.7,3.8,9.2,3.8h317.4c5.8,0,8.7-7,4.6-11.1L333.1,120.1z" />
    </Svg>
  );
});

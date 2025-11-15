import React from 'react';
// @ts-ignore
import HashtagSvg from '../../assets/images/hashtag_region.svg';

interface HashtagIconProps {
  width?: number;
  height?: number;
  color?: string;
}

export default function HashtagIcon({ width = 24, height = 24, color = '#FFFFFF' }: HashtagIconProps) {
  return (
    <HashtagSvg width={width} height={height} viewBox="0 0 24 24" fill={color} />
  );
}

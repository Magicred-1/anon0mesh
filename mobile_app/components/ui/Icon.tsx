import React from 'react';
import Svg, { Path, Circle, Rect } from 'react-native-svg';

type IconName =
  | 'lock' | 'send' | 'plus' | 'chevron' | 'chevron-left'
  | 'chat' | 'bolt' | 'nodes' | 'id' | 'search' | 'qr' | 'scan'
  | 'copy' | 'check' | 'refresh' | 'export' | 'arrow-right'
  | 'arrow-up' | 'x' | 'dot' | 'beacon' | 'filter' | 'eye-off'
  | 'menu' | 'wallet' | 'sliders';

type Props = {
  name: IconName;
  size?: number;
  color?: string;
  strokeWidth?: number;
};

export function Icon({ name, size = 18, color = 'currentColor', strokeWidth = 1.5 }: Props) {
  const sw = strokeWidth;
  const stroke = { fill: 'none', stroke: color, strokeWidth: sw, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };

  switch (name) {
    case 'lock':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24">
          <Rect x="5" y="11" width="14" height="10" rx="1.5" {...stroke} />
          <Path d="M8 11V8a4 4 0 018 0v3" {...stroke} />
        </Svg>
      );

    case 'send':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24">
          <Path d="M4 12L20 4L14 20L11 13L4 12Z" {...stroke} />
        </Svg>
      );

    case 'plus':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24">
          <Path d="M12 5v14M5 12h14" {...stroke} />
        </Svg>
      );

    case 'chevron':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24">
          <Path d="M9 6l6 6-6 6" {...stroke} />
        </Svg>
      );

    case 'chevron-left':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24">
          <Path d="M15 6l-6 6 6 6" {...stroke} />
        </Svg>
      );

    case 'chat':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24">
          <Path d="M4 5h16v11H9l-4 4v-4H4V5z" {...stroke} />
        </Svg>
      );

    case 'bolt':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24">
          <Path d="M13 3L5 14h6l-1 7 8-11h-6l1-7z" {...stroke} />
        </Svg>
      );

    case 'nodes':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24">
          <Circle cx="12" cy="5" r="2" {...stroke} />
          <Circle cx="5"  cy="18" r="2" {...stroke} />
          <Circle cx="19" cy="18" r="2" {...stroke} />
          <Path d="M12 7l-6 10M12 7l6 10M6 18h12" {...stroke} />
        </Svg>
      );

    case 'id':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24">
          <Rect x="4" y="5" width="16" height="14" rx="1" {...stroke} />
          <Circle cx="10" cy="11" r="2" {...stroke} />
          <Path d="M6 17c.8-1.5 2.2-2.5 4-2.5s3.2 1 4 2.5M15 10h3M15 13h3" {...stroke} />
        </Svg>
      );

    case 'search':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24">
          <Circle cx="11" cy="11" r="6" {...stroke} />
          <Path d="M16 16l4 4" {...stroke} />
        </Svg>
      );

    case 'qr':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24">
          <Rect x="3"  y="3"  width="7" height="7" {...stroke} />
          <Rect x="14" y="3"  width="7" height="7" {...stroke} />
          <Rect x="3"  y="14" width="7" height="7" {...stroke} />
          <Path d="M14 14h3v3h-3zM20 14v3M14 20h3M20 20h1" {...stroke} />
        </Svg>
      );

    case 'scan':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24">
          <Path d="M4 8V5a1 1 0 011-1h3M20 8V5a1 1 0 00-1-1h-3M4 16v3a1 1 0 001 1h3M20 16v3a1 1 0 01-1 1h-3" {...stroke} />
        </Svg>
      );

    case 'copy':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24">
          <Rect x="8" y="8" width="12" height="12" rx="1" {...stroke} />
          <Path d="M16 8V5a1 1 0 00-1-1H5a1 1 0 00-1 1v10a1 1 0 001 1h3" {...stroke} />
        </Svg>
      );

    case 'check':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24">
          <Path d="M5 12l4 4L19 6" {...stroke} />
        </Svg>
      );

    case 'refresh':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24">
          <Path d="M20 12a8 8 0 10-2.34 5.66M20 6v6h-6" {...stroke} />
        </Svg>
      );

    case 'export':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24">
          <Path d="M12 4v12M7 9l5-5 5 5M5 20h14" {...stroke} />
        </Svg>
      );

    case 'arrow-right':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24">
          <Path d="M5 12h14M13 6l6 6-6 6" {...stroke} />
        </Svg>
      );

    case 'arrow-up':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24">
          <Path d="M12 19V5M6 11l6-6 6 6" {...stroke} />
        </Svg>
      );

    case 'x':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24">
          <Path d="M6 6l12 12M18 6L6 18" {...stroke} />
        </Svg>
      );

    case 'dot':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24">
          <Circle cx="12" cy="12" r="3" fill={color} stroke="none" />
        </Svg>
      );

    case 'beacon':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24">
          <Circle cx="12" cy="12" r="2"   fill={color} stroke="none" />
          <Circle cx="12" cy="12" r="5"   {...stroke} opacity={0.5} />
          <Circle cx="12" cy="12" r="8.5" {...stroke} opacity={0.25} />
        </Svg>
      );

    case 'filter':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24">
          <Path d="M4 5h16M7 12h10M10 19h4" {...stroke} />
        </Svg>
      );

    case 'eye-off':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24">
          <Path d="M3 3l18 18M10.58 10.58a2 2 0 002.83 2.83M6.5 6.5C4.5 8 3 10 2 12c2 4 6 7 10 7a10.5 10.5 0 005-1.3M11 5c4.5 0 8.5 3 10.5 7-.5 1-1.3 2-2.2 3" {...stroke} />
        </Svg>
      );

    case 'menu':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24">
          <Path d="M4 7h16M4 12h10M4 17h16" {...stroke} />
        </Svg>
      );

    case 'wallet':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24">
          <Rect x="2" y="6" width="20" height="14" rx="2" {...stroke} />
          <Path d="M2 10h20" {...stroke} />
          <Circle cx="17" cy="15" r="1.2" fill={color} stroke="none" />
        </Svg>
      );

    case 'sliders':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24">
          <Path d="M4 6h16M4 12h16M4 18h16" {...stroke} />
          <Circle cx="8"  cy="6"  r="2" fill="none" stroke={color} strokeWidth={sw} />
          <Circle cx="16" cy="12" r="2" fill="none" stroke={color} strokeWidth={sw} />
          <Circle cx="10" cy="18" r="2" fill="none" stroke={color} strokeWidth={sw} />
        </Svg>
      );

    default:
      return null;
  }
}

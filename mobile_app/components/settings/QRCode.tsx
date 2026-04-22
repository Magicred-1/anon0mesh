import React, { useMemo } from 'react';
import { View } from 'react-native';
import { useTheme } from '@/theme';

const CELLS = 25;
const BG    = '#0B0C10';
const FG    = '#EEEEF0';

function isFinder(x: number, y: number) {
  const inBox = (cx: number, cy: number) => x >= cx && x < cx + 7 && y >= cy && y < cy + 7;
  return inBox(0, 0) || inBox(CELLS - 7, 0) || inBox(0, CELLS - 7);
}

function isCenterZone(x: number, y: number, cells: number) {
  const mid = Math.floor(cells / 2);
  return x >= mid - 2 && x <= mid + 2 && y >= mid - 2 && y <= mid + 2;
}

export function QRCode({ size = 180, data = 'ed25519_sol_7xKq9hF2p' }: Readonly<{ size?: number; data?: string }>) {
  const { colors } = useTheme();
  const cs = size / CELLS;

  const bits = useMemo(() => {
    let h = 0;
    for (let i = 0; i < data.length; i++) h = (h * 31 + data.charCodeAt(i)) | 0;
    const arr: boolean[][] = [];
    for (let y = 0; y < CELLS; y++) {
      const row: boolean[] = [];
      for (let x = 0; x < CELLS; x++) {
        h = (h * 1103515245 + 12345) | 0;
        row.push(((h >>> 16) & 1) === 1);
      }
      arr.push(row);
    }
    return arr;
  }, [data]);

  const fr = cs * 1.2; // finder border radius

  return (
    <View style={{ width: size, height: size, backgroundColor: BG, position: 'relative' }}>
      {/* Data bits — skip finder zones and center logo zone */}
      {bits.map((row, y) => (
        <View key={y} style={{ flexDirection: 'row', height: cs }}>
          {row.map((on, x) => {
            const skip  = isFinder(x, y) || isCenterZone(x, y, CELLS);
            const color = !skip && on ? FG : 'transparent';
            return <View key={x} style={{ width: cs, height: cs, backgroundColor: color }} />;
          })}
        </View>
      ))}

      {/* Finder patterns — rounded modern style */}
      {([[0, 0], [CELLS - 7, 0], [0, CELLS - 7]] as [number, number][]).map(([cx, cy]) => (
        <View key={`${cx}-${cy}`} style={{ position: 'absolute', left: cx * cs, top: cy * cs, width: 7 * cs, height: 7 * cs }}>
          <View style={{
            position: 'absolute', top: 0, left: 0, width: 7 * cs, height: 7 * cs,
            backgroundColor: FG, borderRadius: fr,
          }} />
          <View style={{
            position: 'absolute', top: cs, left: cs, width: 5 * cs, height: 5 * cs,
            backgroundColor: BG, borderRadius: fr * 0.65,
          }} />
          <View style={{
            position: 'absolute', top: 2 * cs, left: 2 * cs, width: 3 * cs, height: 3 * cs,
            backgroundColor: FG, borderRadius: fr * 0.4,
          }} />
        </View>
      ))}

      {/* Center logo mark */}
      {(() => {
        const logoSize  = cs * 5;
        const logoOff   = (size - logoSize) / 2;
        const innerSize = cs * 3.6;
        const innerOff  = (logoSize - innerSize) / 2;
        const dotSize   = cs * 1.4;
        const dotOff    = (innerSize - dotSize) / 2;
        return (
          <View style={{
            position: 'absolute', left: logoOff, top: logoOff,
            width: logoSize, height: logoSize,
            backgroundColor: BG, borderRadius: cs * 1.1,
            alignItems: 'center', justifyContent: 'center',
          }}>
            {/* Primary rounded square */}
            <View style={{
              position: 'absolute', left: innerOff, top: innerOff,
              width: innerSize, height: innerSize,
              backgroundColor: colors.primary, borderRadius: cs * 0.9,
            }} />
            {/* Dark center dot — creates ring/eye look */}
            <View style={{
              position: 'absolute',
              left: innerOff + dotOff, top: innerOff + dotOff,
              width: dotSize, height: dotSize,
              backgroundColor: BG, borderRadius: cs * 0.4,
            }} />
          </View>
        );
      })()}
    </View>
  );
}

import React, { useMemo } from 'react';
import { View } from 'react-native';
import { useTheme } from '@/theme';

const CELLS = 25;
const FINDER_ORIGINS: [number, number][] = [[0, 0], [CELLS - 7, 0], [0, CELLS - 7]];

function isFinder(x: number, y: number) {
  const inBox = (cx: number, cy: number) => x >= cx && x < cx + 7 && y >= cy && y < cy + 7;
  return inBox(0, 0) || inBox(CELLS - 7, 0) || inBox(0, CELLS - 7);
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

  return (
    <View style={{ width: size, height: size, backgroundColor: '#0E0E12', overflow: 'hidden', position: 'relative' }}>
      {bits.map((row, y) => (
        <View key={y} style={{ flexDirection: 'row', height: cs }}>
          {row.map((on, x) => (
            <View
              key={x}
              style={{ width: cs, height: cs, backgroundColor: isFinder(x, y) ? 'transparent' : on ? '#E8E8EA' : 'transparent' }}
            />
          ))}
        </View>
      ))}

      {FINDER_ORIGINS.map(([cx, cy], i) => (
        <View key={i} style={{ position: 'absolute', left: cx * cs, top: cy * cs, width: 7 * cs, height: 7 * cs }}>
          <View style={{ width: 7 * cs, height: 7 * cs, backgroundColor: '#E8E8EA' }} />
          <View style={{ position: 'absolute', left: cs, top: cs, width: 5 * cs, height: 5 * cs, backgroundColor: '#0E0E12' }} />
          <View style={{ position: 'absolute', left: 2 * cs, top: 2 * cs, width: 3 * cs, height: 3 * cs, backgroundColor: '#E8E8EA' }} />
        </View>
      ))}

      <View style={{
        position: 'absolute',
        left: size / 2 - cs * 2, top: size / 2 - cs * 2,
        width: cs * 4, height: cs * 4,
        backgroundColor: '#0E0E12',
        alignItems: 'center', justifyContent: 'center',
      }}>
        <View style={{ width: cs * 3, height: cs * 3, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' }}>
          <View style={{ width: cs * 1.6, height: cs * 1.6, backgroundColor: '#0E0E12' }} />
        </View>
      </View>
    </View>
  );
}

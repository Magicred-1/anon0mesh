import React, { memo, useMemo, useState, useCallback } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { fontFamily, useTheme } from '@/theme';
import { useGlass } from '@/hooks/useGlass';
import { useWallet } from '@/context/WalletContext';

// Deterministic pseudo-QR from address string
function QRDisplay({ data, size = 180 }: { data: string; size?: number }) {
  const { colors } = useTheme();
  const CELLS = 21;
  const cs = size / CELLS;

  const bits = useMemo(() => {
    let h = 0;
    for (let i = 0; i < data.length; i++) h = (h * 31 + data.charCodeAt(i)) | 0;
    return Array.from({ length: CELLS }, (_, y) =>
      Array.from({ length: CELLS }, (_, x) => {
        h = (h * 1103515245 + 12345) | 0;
        return ((h >>> 16) & 1) === 1;
      })
    );
  }, [data]);

  const isFinder = (x: number, y: number) => {
    const inBox = (cx: number, cy: number) => x >= cx && x < cx + 7 && y >= cy && y < cy + 7;
    return inBox(0, 0) || inBox(CELLS - 7, 0) || inBox(0, CELLS - 7);
  };

  const FINDER_ORIGINS: [number, number][] = [[0, 0], [CELLS - 7, 0], [0, CELLS - 7]];

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
        backgroundColor: '#0E0E12', alignItems: 'center', justifyContent: 'center',
      }}>
        <View style={{ width: cs * 3, height: cs * 3, backgroundColor: '#00e5ff', alignItems: 'center', justifyContent: 'center' }}>
          <View style={{ width: cs * 1.6, height: cs * 1.6, backgroundColor: '#0E0E12' }} />
        </View>
      </View>
    </View>
  );
}

export const ReceivePanel = memo(function ReceivePanel() {
  const { colors }   = useTheme();
  const glass        = useGlass();
  const softGlass    = useGlass('soft');
  const accentGlass  = useGlass('accent');
  const { publicKey } = useWallet();
  const [copied, setCopied] = useState(false);

  const address = publicKey?.toBase58() ?? 'no wallet connected';
  const short   = address.length > 12
    ? address.slice(0, 8) + '····' + address.slice(-6)
    : address;

  const copy = useCallback(async () => {
    try {
      const Clipboard = await import('expo-clipboard');
      await Clipboard.setStringAsync(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    } catch {
      setCopied(false);
    }
  }, [address]);

  return (
    <View style={S.panel}>
      <View style={[S.qrCard, glass, { alignItems: 'center' }]}>
        <Text style={[S.cardLabel, { color: colors.textTertiary, marginBottom: 16 }]}>SOLANA ADDRESS</Text>
        <View style={[S.qrWrap, { borderColor: colors.border }]}>
          <QRDisplay data={address} size={180} />
        </View>
        <Text style={[S.address, { color: colors.textPrimary }]}>{short}</Text>
        <Text style={[S.hint, { color: colors.textTertiary }]}>SOL · SPL TOKENS</Text>
      </View>

      <View style={[S.infoCard, accentGlass]}>
        <Feather name="lock" size={12} color={colors.primary} />
        <Text style={[S.infoText, { color: colors.primary }]}>CONFIDENTIAL · MPC-SHIELDED RECEIVE</Text>
      </View>

      <Pressable onPress={copy} style={[S.copyBtn, softGlass]}>
        <Feather name={copied ? 'check' : 'copy'} size={14} color={copied ? colors.primary : colors.textSecondary} />
        <Text style={[S.copyLabel, { color: copied ? colors.primary : colors.textSecondary }]}>
          {copied ? 'COPIED' : 'COPY ADDRESS'}
        </Text>
      </Pressable>
    </View>
  );
});

const S = StyleSheet.create({
  panel:     { paddingHorizontal: 20, paddingTop: 14, paddingBottom: 16, gap: 12 },
  cardLabel: { fontFamily: fontFamily.sansMd, fontSize: 9.5, letterSpacing: 2.5, textTransform: 'uppercase' },
  qrCard:    { borderRadius: 16, padding: 20, gap: 14 },
  qrWrap:    { padding: 10, borderRadius: 12, borderWidth: 0.5, overflow: 'hidden' },
  address:   { fontFamily: fontFamily.mono, fontSize: 13, letterSpacing: 0.5 },
  hint:      { fontFamily: fontFamily.sansMd, fontSize: 9, letterSpacing: 2.5, textTransform: 'uppercase' },
  infoCard:  { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, borderRadius: 12 },
  infoText:  { fontFamily: fontFamily.sansMd, fontSize: 9.5, letterSpacing: 2, textTransform: 'uppercase' },
  copyBtn:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 14, borderRadius: 14 },
  copyLabel: { fontFamily: fontFamily.sansMd, fontSize: 11, fontWeight: '600', letterSpacing: 3, textTransform: 'uppercase' },
});

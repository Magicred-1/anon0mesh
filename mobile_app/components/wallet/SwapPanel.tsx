import React, { memo, useState, useEffect } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { fontFamily, useTheme } from '@/theme';
import { useGlass } from '@/hooks/useGlass';
import { ASSETS } from './constants';
import { SwapRow } from './SwapRow';
import type { Asset } from './types';

export const SwapPanel = memo(function SwapPanel() {
  const { colors }  = useTheme();
  const softGlass   = useGlass('soft');
  const strongGlass = useGlass('strong');
  const accentGlass = useGlass('accent');

  const [from, setFrom] = useState<Asset>(ASSETS[1]);
  const [to,   setTo]   = useState<Asset>(ASSETS[0]);
  const [amt,  setAmt]  = useState('500');
  const [phase, setPhase] = useState(0);

  const rate = 189.32;
  const out  = (parseFloat(amt || '0') / rate).toFixed(4);

  useEffect(() => {
    if (phase === 0 || phase === 3) return;
    const t = setTimeout(() => setPhase(p => p + 1), 900);
    return () => clearTimeout(t);
  }, [phase]);

  const flip = () => { setFrom(to); setTo(from); };

  return (
    <View style={S.panel}>
      <SwapRow label="you pay" asset={from} value={amt} onValue={setAmt} readOnly={false} editable={phase === 0} />

      <View style={S.flipWrap}>
        <Pressable onPress={flip} style={[S.flipBtn, strongGlass, { elevation: 4 }]}>
          <Feather name="repeat" size={14} color={colors.primary} />
        </Pressable>
      </View>

      <SwapRow label="you get" asset={to} value={out} onValue={null} readOnly editable={false} />

      <View style={[S.card, softGlass]}>
        {([
          ['rate',        `1 ${to.sym} = ${rate} ${from.sym}`],
          ['route',       'jupiter · confidential'],
          ['network fee', '~0.00025 SOL'],
        ] as [string, string][]).map(([k, v], i) => (
          <View key={k} style={[S.rateRow, i > 0 && { marginTop: 4 }]}>
            <Text style={[S.rateKey, { color: colors.textSecondary }]}>{k}</Text>
            <Text style={[S.rateVal, { color: i === 1 ? colors.textPrimary : colors.textSecondary }]}>{v}</Text>
          </View>
        ))}
      </View>

      <View style={[S.card, accentGlass, S.row, { alignItems: 'center', gap: 10 }]}>
        <Feather name="lock" size={12} color={colors.primary} />
        <Text style={[S.privLabel, { color: colors.primary, flex: 1 }]}>CONFIDENTIAL SWAP · ZERO SLIPPAGE LEAK</Text>
      </View>

      {phase === 0 && (
        <Pressable onPress={() => setPhase(1)} style={[S.actionBtn, { backgroundColor: colors.primary, marginTop: 2 }]}>
          <Text style={[S.actionLabel, { color: '#08080A' }]}>SWAP</Text>
        </Pressable>
      )}
      {phase > 0 && phase < 3 && (
        <View style={[S.actionBtn, softGlass]}>
          <Text style={[S.actionLabel, { color: colors.textSecondary }]}>
            {['', 'ROUTING', 'SHARDING', 'SETTLING'][phase]}…
          </Text>
        </View>
      )}
      {phase === 3 && (
        <Pressable onPress={() => setPhase(0)} style={[S.actionBtn, accentGlass]}>
          <Text style={[S.actionLabel, { color: colors.primary }]}>✓ SWAPPED · NEW ORDER</Text>
        </Pressable>
      )}
    </View>
  );
});

const S = StyleSheet.create({
  panel:     { paddingHorizontal: 20, paddingTop: 14, paddingBottom: 16, gap: 12 },
  row:       { flexDirection: 'row', alignItems: 'center' },
  card:      { borderRadius: 16, padding: 12 },
  privLabel: { fontFamily: fontFamily.sansMd, fontSize: 9.5, letterSpacing: 2, textTransform: 'uppercase' },
  flipWrap:  { alignItems: 'center', marginVertical: -20, zIndex: 2 },
  flipBtn:   { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  rateRow:   { flexDirection: 'row', justifyContent: 'space-between' },
  rateKey:   { fontFamily: fontFamily.sansMd, fontSize: 11 },
  rateVal:   { fontFamily: fontFamily.sansMd, fontSize: 11 },
  actionBtn: { padding: 15, borderRadius: 14, alignItems: 'center' },
  actionLabel:{ fontFamily: fontFamily.sansMd, fontSize: 12, letterSpacing: 3.5, textTransform: 'uppercase', fontWeight: '600' },
});

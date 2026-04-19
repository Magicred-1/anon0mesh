import React, { useState, useRef, useEffect } from 'react';
import { View, Text, Pressable, Modal, StyleSheet, Animated } from 'react-native';
import Reanimated, { FadeIn } from 'react-native-reanimated';
import { Feather } from '@expo/vector-icons';
import { fontFamily, useTheme } from '@/theme';
import { useGlass } from '@/hooks/useGlass';
import { RadarScan } from './RadarScan';
import { SignalBars } from './SignalBars';
import { DEVICES, HANDSHAKE_LINES, type PairedDevice } from './constants';

export function RNodePairModal({
  onClose,
  onPaired,
}: {
  onClose: () => void;
  onPaired: (d: NonNullable<PairedDevice>) => void;
}) {
  const { colors } = useTheme();
  const baseGlass   = useGlass();
  const accentGlass = useGlass('accent');
  const softGlass   = useGlass('soft');

  const [phase,    setPhase]    = useState(0);
  const [selected, setSelected] = useState<typeof DEVICES[number] | null>(null);
  const sheetAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(sheetAnim, { toValue: 1, useNativeDriver: true, bounciness: 4 }).start();
  }, [sheetAnim]);

  useEffect(() => {
    if (phase === 0) {
      const t = setTimeout(() => setPhase(1), 1600);
      return () => clearTimeout(t);
    }
    if (phase === 2) {
      const t = setTimeout(() => setPhase(3), 1800);
      return () => clearTimeout(t);
    }
  }, [phase]);

  const pick = (d: typeof DEVICES[number]) => { setSelected(d); setPhase(2); };

  const dismiss = () => {
    Animated.timing(sheetAnim, { toValue: 0, duration: 220, useNativeDriver: true }).start(onClose);
  };

  const sheetY    = sheetAnim.interpolate({ inputRange: [0, 1], outputRange: [600, 0], extrapolate: 'clamp' });
  const overlayOp = sheetAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 1],   extrapolate: 'clamp' });
  const phaseTitle = ['scanning nearby…', 'select a device', 'handshaking…', 'paired'][phase];

  return (
    <Modal transparent animationType="none" onRequestClose={dismiss}>
      <View style={StyleSheet.absoluteFill}>
        <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(4,4,6,0.72)', opacity: overlayOp }]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={dismiss} />
        </Animated.View>

        <Animated.View style={[S.sheet, { backgroundColor: colors.glass, borderColor: colors.border, transform: [{ translateY: sheetY }] }]}>
          <View style={[S.grab, { backgroundColor: 'rgba(255,255,255,0.18)' }]} />

          <View style={S.header}>
            <View>
              <Text style={[S.tag,   { color: colors.textTertiary }]}>PAIR RNODE</Text>
              <Text style={[S.title, { color: colors.textPrimary }]}>{phaseTitle}</Text>
            </View>
            <Pressable onPress={dismiss} style={[S.closeBtn, softGlass]}>
              <Feather name="x" size={14} color={colors.textSecondary} />
            </Pressable>
          </View>

          {phase === 0 && (
            <View style={S.center}>
              <RadarScan />
              <Text style={[S.scanSub, { color: colors.textSecondary }]}>BLE · LoRa · SERIAL</Text>
            </View>
          )}

          {phase === 1 && (
            <View style={{ gap: 8 }}>
              {DEVICES.map(d => (
                <Pressable
                  key={d.id}
                  onPress={() => pick(d)}
                  style={({ pressed }) => [S.deviceRow, baseGlass, { opacity: pressed ? 0.75 : 1 }]}
                >
                  <View style={[S.deviceIcon, accentGlass]}>
                    <Feather name="radio" size={18} color={colors.primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[S.deviceName,   { color: colors.textPrimary }]}>{d.name}</Text>
                    <Text style={[S.deviceSerial, { color: colors.textTertiary }]}>{d.serial} · {d.rssi}dBm</Text>
                  </View>
                  <SignalBars value={d.rssi > -50 ? 4 : d.rssi > -65 ? 3 : 2} size={10} />
                </Pressable>
              ))}
            </View>
          )}

          {phase === 2 && (
            <View style={{ padding: 20, gap: 10 }}>
              {HANDSHAKE_LINES.map((line, i) => (
                <Reanimated.View key={i} entering={FadeIn.delay(i * 320).duration(300)}>
                  <Text style={[S.handshake, { color: colors.textSecondary }]}>
                    <Text style={{ color: colors.primary }}>{i === 0 ? '✓' : i === 1 ? '›' : '·'}{'  '}</Text>
                    {line}
                  </Text>
                </Reanimated.View>
              ))}
            </View>
          )}

          {phase === 3 && (
            <View style={S.center}>
              <View style={[S.iconCircle, accentGlass]}>
                <Feather name="check" size={30} color={colors.primary} />
              </View>
              <View style={{ alignItems: 'center' }}>
                <Text style={[S.successTitle, { color: colors.textPrimary }]}>{selected?.name} paired</Text>
                <Text style={[S.successSub,   { color: colors.textTertiary }]}>{selected?.serial} · ACTIVE CO-INTERFACE</Text>
              </View>
              <Pressable
                onPress={() => { if (selected) onPaired(selected); dismiss(); }}
                style={[S.doneBtn, { backgroundColor: colors.primary }]}
              >
                <Text style={[S.doneBtnText, { color: colors.background }]}>DONE</Text>
              </Pressable>
            </View>
          )}
        </Animated.View>
      </View>
    </Modal>
  );
}

const S = StyleSheet.create({
  sheet:       { position: 'absolute', bottom: 0, left: 0, right: 0, borderRadius: 20, borderBottomLeftRadius: 0, borderBottomRightRadius: 0, padding: 14, paddingBottom: 28, borderWidth: 0.5 },
  grab:        { width: 36, height: 4, borderRadius: 99, alignSelf: 'center', marginBottom: 14 },
  header:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  tag:         { fontFamily: fontFamily.sansMd, fontSize: 9.5, letterSpacing: 2, textTransform: 'uppercase' },
  title:       { fontSize: 18, marginTop: 4, letterSpacing: -0.3 },
  closeBtn:    { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  center:      { paddingVertical: 24, alignItems: 'center', gap: 16 },
  scanSub:     { fontFamily: fontFamily.sansMd, fontSize: 10, letterSpacing: 2, textTransform: 'uppercase' },
  deviceRow:   { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, paddingHorizontal: 14, borderRadius: 14 },
  deviceIcon:  { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  deviceName:  { fontSize: 14, letterSpacing: -0.2 },
  deviceSerial:{ fontFamily: fontFamily.sansMd, fontSize: 9.5, letterSpacing: 1, textTransform: 'uppercase', marginTop: 3 },
  handshake:   { fontFamily: fontFamily.sansMd, fontSize: 11.5, letterSpacing: 0.3 },
  iconCircle:  { width: 64, height: 64, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  successTitle:{ fontSize: 17, letterSpacing: -0.3, textAlign: 'center' },
  successSub:  { fontFamily: fontFamily.sansMd, fontSize: 9.5, letterSpacing: 1.5, textTransform: 'uppercase', marginTop: 6 },
  doneBtn:     { width: '100%', padding: 13, borderRadius: 12, alignItems: 'center', marginTop: 4 },
  doneBtnText: { fontFamily: fontFamily.sansMd, fontSize: 11, fontWeight: '600', letterSpacing: 3, textTransform: 'uppercase' },
});

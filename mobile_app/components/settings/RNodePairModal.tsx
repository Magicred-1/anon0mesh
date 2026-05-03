import React, { useState, useRef, useEffect, useCallback } from 'react';
import { View, Text, Pressable, Modal, StyleSheet, Animated, Linking, Platform } from 'react-native';
import Reanimated, { FadeIn } from 'react-native-reanimated';
import { Feather } from '@expo/vector-icons';
import { fontFamily, useTheme } from '@/theme';
import { useGlass } from '@/hooks/useGlass';
import { useLxmfContext } from '@/context/LxmfContext';
import { RadarScan } from './RadarScan';
import { SignalBars } from './SignalBars';
import type { PairedDevice } from './constants';

export const HANDSHAKE_LINES = [
  'connecting over ble…',
  'negotiating keys…',
  'verifying reticulum identity…',
];

// phase 0 — instruct user to pair in OS BT settings + polling
// phase 1 — RNode(s) detected, show connect button
// phase 2 — handshaking animation
// phase 3 — success

interface Props {
  readonly onClose:  () => void;
  readonly onPaired: (d: NonNullable<PairedDevice>) => void;
}

export function RNodePairModal({ onClose, onPaired }: Props) {
  const { colors } = useTheme();
  const baseGlass   = useGlass();
  const accentGlass = useGlass('accent');
  const softGlass   = useGlass('soft');

  const { startBLE, getNusUnpairedRNodes, pairNusRNode, bleActive } = useLxmfContext();

  const [phase,       setPhase]       = useState(0);
  const [devices,     setDevices]     = useState<{ mac: string; name: string }[]>([]);
  const [pairedMac,   setPairedMac]   = useState<string | null>(null);
  const [pairError,   setPairError]   = useState<string | null>(null);
  const sheetAnim = useRef(new Animated.Value(0)).current;
  const pollRef   = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    Animated.spring(sheetAnim, { toValue: 1, useNativeDriver: true, bounciness: 4 }).start();
  }, [sheetAnim]);

  // Poll getNusUnpairedRNodes while in phase 0
  useEffect(() => {
    if (phase !== 0) {
      if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
      return;
    }
    const tick = () => {
      try {
        const found = getNusUnpairedRNodes();
        setDevices(found);
        if (found.length > 0) setPhase(1);
      } catch { /* native not ready */ }
    };
    tick();
    pollRef.current = setInterval(tick, 1000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [phase, getNusUnpairedRNodes]);

  // Phase 2: poll until pairedMac disappears from unpaired list (= bonded+connected)
  useEffect(() => {
    if (phase !== 2 || !pairedMac) return;
    const deadline = Date.now() + 15_000;
    const id = setInterval(() => {
      if (Date.now() > deadline) {
        clearInterval(id);
        setPairError('Pairing timed out — try again');
        setPhase(1);
        return;
      }
      try {
        const still = getNusUnpairedRNodes();
        if (!still.some(d => d.mac === pairedMac)) {
          clearInterval(id);
          setPhase(3);
        }
      } catch { /* native not ready */ }
    }, 500);
    return () => clearInterval(id);
  }, [phase, pairedMac, getNusUnpairedRNodes]);

  const openBTSettings = useCallback(() => {
    if (Platform.OS === 'android') {
      Linking.sendIntent('android.settings.BLUETOOTH_SETTINGS').catch(() => {});
    } else {
      Linking.openURL('App-Prefs:Bluetooth').catch(() => Linking.openSettings());
    }
  }, []);

  const connect = useCallback(async (mac: string) => {
    setPairError(null);
    setPairedMac(mac);
    if (!bleActive) await startBLE();
    try {
      const ok = pairNusRNode(mac);
      if (!ok) { setPairError('Device not found — re-scan and try again'); return; }
    } catch { setPairError('Pairing failed — BLE not ready'); return; }
    setPhase(2);
  }, [bleActive, startBLE, pairNusRNode]);

  const dismiss = useCallback(() => {
    Animated.timing(sheetAnim, { toValue: 0, duration: 220, useNativeDriver: true }).start(onClose);
  }, [sheetAnim, onClose]);

  const sheetY    = sheetAnim.interpolate({ inputRange: [0, 1], outputRange: [600, 0], extrapolate: 'clamp' });
  const overlayOp = sheetAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 1],   extrapolate: 'clamp' });

  const rnodePlural = devices.length === 1 ? 'rnode' : 'rnodes';
  const phaseTitles = ['pair via bluetooth', `${devices.length} ${rnodePlural} detected`, 'handshaking…', 'paired'];
  const phaseTitle  = phaseTitles[phase] ?? phaseTitles[0];
  const pairedDevice = devices.find(d => d.mac === pairedMac) ?? devices[0];

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
              <Text style={[S.hint, { color: colors.textTertiary }]}>
                Open OS Bluetooth settings and pair your RNode first, then return here.
              </Text>
              <Pressable onPress={openBTSettings} style={[S.settingsBtn, { borderColor: colors.border }]}>
                <Feather name="bluetooth" size={13} color={colors.textSecondary} />
                <Text style={[S.settingsBtnText, { color: colors.textSecondary }]}>OPEN BT SETTINGS</Text>
              </Pressable>
            </View>
          )}

          {phase === 1 && (
            <View style={{ gap: 8 }}>
              {devices.map(d => (
                <Pressable
                  key={d.mac}
                  onPress={() => connect(d.mac)}
                  style={({ pressed }) => [S.deviceRow, baseGlass, { opacity: pressed ? 0.75 : 1 }]}
                >
                  <View style={[S.deviceIcon, accentGlass]}>
                    <Feather name="radio" size={18} color={colors.primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[S.deviceName,   { color: colors.textPrimary }]}>{d.name || d.mac}</Text>
                    <Text style={[S.deviceSerial, { color: colors.textTertiary }]}>{d.mac} · NUS</Text>
                  </View>
                  <SignalBars value={3} size={10} />
                </Pressable>
              ))}
              {pairError
                ? <Text style={[S.hint, { color: colors.error ?? '#ff4444', textAlign: 'center', marginTop: 4 }]}>{pairError}</Text>
                : <Text style={[S.hint, { color: colors.textTertiary, textAlign: 'center', marginTop: 4 }]}>Tap a device to activate it as a co-interface</Text>
              }
            </View>
          )}

          {phase === 2 && (
            <View style={{ padding: 20, gap: 10 }}>
              {HANDSHAKE_LINES.map((line, i) => {
                const icons = ['✓', '›', '·'];
                const icon  = icons[i] ?? '·';
                return (
                  <Reanimated.View key={line} entering={FadeIn.delay(i * 320).duration(300)}>
                    <Text style={[S.handshake, { color: colors.textSecondary }]}>
                      <Text style={{ color: colors.primary }}>{icon}{'  '}</Text>
                      {line}
                    </Text>
                  </Reanimated.View>
                );
              })}
            </View>
          )}

          {phase === 3 && (
            <View style={S.center}>
              <View style={[S.iconCircle, accentGlass]}>
                <Feather name="check" size={30} color={colors.primary} />
              </View>
              <View style={{ alignItems: 'center' }}>
                <Text style={[S.successTitle, { color: colors.textPrimary }]}>{pairedDevice?.name ?? 'RNode'} paired</Text>
                <Text style={[S.successSub, { color: colors.textTertiary }]}>ACTIVE CO-INTERFACE · NUS</Text>
              </View>
              <Pressable
                onPress={() => {
                  onPaired({ id: pairedDevice?.mac ?? 'rnode_live', name: pairedDevice?.name ?? 'RNode', rssi: -55, serial: pairedDevice?.mac ?? 'NUS' });
                  dismiss();
                }}
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
  sheet:        { position: 'absolute', bottom: 0, left: 0, right: 0, borderRadius: 20, borderBottomLeftRadius: 0, borderBottomRightRadius: 0, padding: 14, paddingBottom: 28, borderWidth: 0.5 },
  grab:         { width: 36, height: 4, borderRadius: 99, alignSelf: 'center', marginBottom: 14 },
  header:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  tag:          { fontFamily: fontFamily.sansMd, fontSize: 9.5, letterSpacing: 2, textTransform: 'uppercase' },
  title:        { fontSize: 18, marginTop: 4, letterSpacing: -0.3 },
  closeBtn:     { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  center:       { paddingVertical: 24, alignItems: 'center', gap: 16 },
  scanSub:      { fontFamily: fontFamily.sansMd, fontSize: 10, letterSpacing: 2, textTransform: 'uppercase' },
  hint:         { fontFamily: fontFamily.sansMd, fontSize: 11, letterSpacing: 0.2, textAlign: 'center', paddingHorizontal: 12 },
  settingsBtn:  { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 16, paddingVertical: 9, borderRadius: 10, borderWidth: 0.5 },
  settingsBtnText: { fontFamily: fontFamily.sansMd, fontSize: 10, letterSpacing: 1.5, textTransform: 'uppercase' },
  deviceRow:    { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, paddingHorizontal: 14, borderRadius: 14 },
  deviceIcon:   { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  deviceName:   { fontSize: 14, letterSpacing: -0.2 },
  deviceSerial: { fontFamily: fontFamily.sansMd, fontSize: 9.5, letterSpacing: 1, textTransform: 'uppercase', marginTop: 3 },
  handshake:    { fontFamily: fontFamily.sansMd, fontSize: 11.5, letterSpacing: 0.3 },
  iconCircle:   { width: 64, height: 64, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  successTitle: { fontSize: 17, letterSpacing: -0.3, textAlign: 'center' },
  successSub:   { fontFamily: fontFamily.sansMd, fontSize: 9.5, letterSpacing: 1.5, textTransform: 'uppercase', marginTop: 6 },
  doneBtn:      { width: '100%', padding: 13, borderRadius: 12, alignItems: 'center', marginTop: 4 },
  doneBtnText:  { fontFamily: fontFamily.sansMd, fontSize: 11, fontWeight: '600', letterSpacing: 3, textTransform: 'uppercase' },
});

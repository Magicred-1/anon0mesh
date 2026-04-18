import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  View, Text, ScrollView, Pressable, Modal, StyleSheet, Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Reanimated, {
  useSharedValue, useAnimatedStyle,
  withRepeat, withTiming, withSequence, Easing, FadeIn,
} from 'react-native-reanimated';
import { Feather } from '@expo/vector-icons';
import { fontFamily, useTheme } from '@/theme';
import { Pill } from '@/components/ui/Pill';
import { useWallet } from '@/context/WalletContext';
import { useRouter } from 'expo-router';

// ── Types ─────────────────────────────────────────────────────────────────────

type PairedDevice = { id: string; name: string; rssi: number; serial: string } | null;

// ── Constants ─────────────────────────────────────────────────────────────────

const DEVICES = [
  { id: 'rnode_001', name: 'RNode · 410MHz', rssi: -42, serial: 'RN-914-4f2a' },
  { id: 'rnode_002', name: 'RNode · 868MHz', rssi: -61, serial: 'RN-868-9c1b' },
  { id: 'rnode_003', name: 'LilyGO T-Beam',  rssi: -74, serial: 'TB-2c1d-7f09' },
];

// ── Glass style helper (shared with theme) ────────────────────────────────────

function useGlass(variant: 'base' | 'soft' | 'accent' | 'strong' = 'base') {
  const { colors } = useTheme();
  switch (variant) {
    case 'soft':   return { backgroundColor: colors.surface0,      borderWidth: 0.5 as const, borderColor: colors.borderSubtle };
    case 'accent': return { backgroundColor: colors.primarySubtle, borderWidth: 0.5 as const, borderColor: colors.primary + '40' };
    case 'strong': return { backgroundColor: colors.glass,         borderWidth: 0.5 as const, borderColor: colors.border };
    default:       return { backgroundColor: colors.surface1,      borderWidth: 0.5 as const, borderColor: colors.border };
  }
}

// ── QRCode ────────────────────────────────────────────────────────────────────

function QRCode({ size = 180, data = 'ed25519_sol_7xKq9hF2p' }: Readonly<{ size?: number; data?: string }>) {
  const { colors } = useTheme();
  const CELLS = 25;
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

  const isFinder = (x: number, y: number) => {
    const inBox = (cx: number, cy: number) => x >= cx && x < cx + 7 && y >= cy && y < cy + 7;
    return inBox(0, 0) || inBox(CELLS - 7, 0) || inBox(0, CELLS - 7);
  };

  const FINDER_ORIGINS: [number, number][] = [[0, 0], [CELLS - 7, 0], [0, CELLS - 7]];

  return (
    <View style={{ width: size, height: size, backgroundColor: '#0E0E12', overflow: 'hidden', position: 'relative' }}>
      {/* Data cells */}
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

      {/* Finder patterns */}
      {FINDER_ORIGINS.map(([cx, cy], i) => (
        <View key={i} style={{ position: 'absolute', left: cx * cs, top: cy * cs, width: 7 * cs, height: 7 * cs }}>
          <View style={{ width: 7 * cs, height: 7 * cs, backgroundColor: '#E8E8EA' }} />
          <View style={{ position: 'absolute', left: cs, top: cs, width: 5 * cs, height: 5 * cs, backgroundColor: '#0E0E12' }} />
          <View style={{ position: 'absolute', left: 2 * cs, top: 2 * cs, width: 3 * cs, height: 3 * cs, backgroundColor: '#E8E8EA' }} />
        </View>
      ))}

      {/* Center logo */}
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

// ── SignalBars ─────────────────────────────────────────────────────────────────

function SignalBars({ value, size = 10 }: { value: number; size?: number }) {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 2 }}>
      {[1, 2, 3, 4].map(b => (
        <View key={b} style={{
          width: size * 0.55,
          height: size * 0.35 * b,
          borderRadius: 1,
          backgroundColor: b <= value ? colors.primary : colors.surface3,
        }} />
      ))}
    </View>
  );
}

// ── Toggle ────────────────────────────────────────────────────────────────────

function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  const { colors } = useTheme();
  const thumb = useRef(new Animated.Value(on ? 1 : 0)).current;

  useEffect(() => {
    Animated.timing(thumb, { toValue: on ? 1 : 0, duration: 160, useNativeDriver: true }).start();
  }, [on, thumb]);

  const thumbX = thumb.interpolate({ inputRange: [0, 1], outputRange: [2, 18] });

  return (
    <Pressable
      onPress={() => onChange(!on)}
      style={[S.toggleTrack, { backgroundColor: on ? colors.primary : 'rgba(255,255,255,0.08)', borderColor: on ? 'transparent' : 'rgba(255,255,255,0.10)' }]}
    >
      <Animated.View style={[S.toggleThumb, { backgroundColor: on ? '#08080A' : '#E8E8EA', transform: [{ translateX: thumbX }] }]} />
    </Pressable>
  );
}

// ── RadarScan ─────────────────────────────────────────────────────────────────

function RadarScan() {
  const { colors } = useTheme();
  const rotation  = useSharedValue(0);
  const pulseScale = useSharedValue(1);

  useEffect(() => {
    rotation.value = withRepeat(withTiming(360, { duration: 2000, easing: Easing.linear }), -1, false);
    pulseScale.value = withRepeat(
      withSequence(
        withTiming(1.35, { duration: 650, easing: Easing.out(Easing.ease) }),
        withTiming(1,    { duration: 650, easing: Easing.in(Easing.ease) }),
      ),
      -1, false,
    );
  }, [rotation, pulseScale]);

  const rotStyle   = useAnimatedStyle(() => ({ transform: [{ rotate: `${rotation.value}deg` }] }));
  const pulseStyle = useAnimatedStyle(() => ({ transform: [{ scale: pulseScale.value }] }));

  return (
    <View style={{ width: 140, height: 140, alignItems: 'center', justifyContent: 'center' }}>
      {[0.38, 0.65, 1.0].map((s, i) => (
        <View key={i} style={{
          position: 'absolute',
          width: 140 * s, height: 140 * s,
          borderRadius: 70 * s,
          borderWidth: 0.5, borderColor: colors.primary + (i === 0 ? 'CC' : i === 1 ? '80' : '40'),
        }} />
      ))}
      <Reanimated.View style={[{ position: 'absolute', width: 140, height: 140 }, rotStyle]}>
        <View style={{
          width: 140, height: 140, borderRadius: 70,
          borderWidth: 2,
          borderTopColor: colors.primary,
          borderRightColor: colors.primary + '50',
          borderBottomColor: 'transparent',
          borderLeftColor: 'transparent',
        }} />
      </Reanimated.View>
      <Reanimated.View style={[{
        width: 12, height: 12, borderRadius: 6,
        backgroundColor: colors.primary,
        shadowColor: colors.primary, shadowRadius: 10, shadowOpacity: 0.8, shadowOffset: { width: 0, height: 0 },
      }, pulseStyle]} />
    </View>
  );
}

// ── QRModal ───────────────────────────────────────────────────────────────────

type QRTab = 'wallet' | 'anonmesh';

const ANONMESH_HASH = '7xKq9hF2p3aL8m';
const ANONMESH_HANDLE = '@node_7f3a';

function QRModal({ onClose }: { onClose: () => void }) {
  const { colors } = useTheme();
  const softGlass   = useGlass('soft');
  const baseGlass   = useGlass();
  const accentGlass = useGlass('accent');
  const { publicKey } = useWallet();
  const [tab, setTab] = useState<QRTab>('anonmesh');
  const scaleAnim   = useRef(new Animated.Value(0.85)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(scaleAnim,   { toValue: 1, useNativeDriver: true, bounciness: 6 }),
      Animated.timing(opacityAnim, { toValue: 1, duration: 180, useNativeDriver: true }),
    ]).start();
  }, [scaleAnim, opacityAnim]);

  const dismiss = () => {
    Animated.parallel([
      Animated.timing(scaleAnim,   { toValue: 0.88, duration: 160, useNativeDriver: true }),
      Animated.timing(opacityAnim, { toValue: 0,    duration: 160, useNativeDriver: true }),
    ]).start(onClose);
  };

  const walletPubkey = publicKey?.toBase58() ?? null;
  const walletLabel  = walletPubkey ? walletPubkey.slice(0, 8) + '..' + walletPubkey.slice(-6) : 'not connected';
  const qrData   = tab === 'wallet' ? (walletPubkey ?? 'no-wallet') : ANONMESH_HASH;
  const label    = tab === 'wallet' ? walletLabel : ANONMESH_HANDLE;
  const sublabel = tab === 'wallet' ? (walletPubkey ?? '—') : ANONMESH_HASH;

  return (
    <Modal transparent animationType="none" onRequestClose={dismiss}>
      <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(4,4,6,0.86)', opacity: opacityAnim, alignItems: 'center', justifyContent: 'center' }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={dismiss} />

        <Animated.View style={[S.qrCard, baseGlass, { transform: [{ scale: scaleAnim }] }]}>
          {/* Header */}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', width: '100%', marginBottom: 16 }}>
            {/* Tab switcher */}
            <View style={[S.qrTabRow, softGlass]}>
              {(['anonmesh', 'wallet'] as QRTab[]).map(t => (
                <Pressable
                  key={t}
                  onPress={() => setTab(t)}
                  style={[S.qrTabBtn, tab === t && accentGlass, tab === t && { borderRadius: 8 }]}
                >
                  <Text style={[S.qrTabText, { color: tab === t ? colors.primary : colors.textTertiary }]}>
                    {t.toUpperCase()}
                  </Text>
                </Pressable>
              ))}
            </View>
            <Pressable onPress={dismiss} style={[S.closeBtn, softGlass]}>
              <Feather name="x" size={14} color={colors.textSecondary} />
            </Pressable>
          </View>

          {/* QR */}
          <View style={[S.qrLargeWrap, { backgroundColor: colors.surface2, borderColor: tab === 'wallet' ? colors.primary + '40' : colors.border }]}>
            <QRCode size={220} data={qrData} />
          </View>

          {/* Identity info */}
          <View style={{ alignItems: 'center', marginTop: 16, gap: 4, width: '100%' }}>
            <Text style={[S.qrModalHandle, { color: colors.textPrimary }]}>{label}</Text>
            {/* <Text style={[S.qrModalHash, { color: colors.textTertiary }]} numberOfLines={1}>{sublabel}</Text> */}
          </View>

          <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
            {tab === 'anonmesh'
              ? <Pill label="anonmesh" variant="default" dot />
              : <Pill label="solana" variant="primary" dot />
            }
          </View>

          <Text style={[S.qrModalHint, { color: colors.textTertiary, marginTop: 14 }]}>
            TAP OUTSIDE TO CLOSE
          </Text>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

// ── ExportWalletModal ─────────────────────────────────────────────────────────

function ExportWalletModal({ onClose }: { onClose: () => void }) {
  const { colors } = useTheme();
  const softGlass   = useGlass('soft');
  const { walletMode, exportPrivateKey } = useWallet();
  const [secretKey, setSecretKey] = useState<string | null>(null);
  const [revealed,  setRevealed]  = useState(false);
  const [loading,   setLoading]   = useState(false);
  const sheetAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(sheetAnim, { toValue: 1, useNativeDriver: true, bounciness: 4 }).start();
    if (walletMode === 'local') {
      setLoading(true);
      exportPrivateKey().then(key => { setSecretKey(key); setLoading(false); }).catch(() => setLoading(false));
    }
  }, [sheetAnim, walletMode, exportPrivateKey]);

  const dismiss = () => {
    Animated.timing(sheetAnim, { toValue: 0, duration: 220, useNativeDriver: true }).start(onClose);
  };

  const sheetY        = sheetAnim.interpolate({ inputRange: [0, 1], outputRange: [600, 0], extrapolate: 'clamp' });
  const overlayOp     = sheetAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 1],   extrapolate: 'clamp' });
  const masked        = secretKey ? '·'.repeat(secretKey.length) : '';

  return (
    <Modal transparent animationType="none" onRequestClose={dismiss}>
      <View style={StyleSheet.absoluteFill}>
        <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(4,4,6,0.72)', opacity: overlayOp }]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={dismiss} />
        </Animated.View>

        <Animated.View style={[S.sheet, { backgroundColor: colors.glass, borderColor: colors.border, transform: [{ translateY: sheetY }] }]}>
          <View style={[S.grabHandle, { backgroundColor: 'rgba(255,255,255,0.18)' }]} />

          <View style={S.sheetHeader}>
            <View>
              <Text style={[S.sheetTag,  { color: colors.textTertiary }]}>EXPORT WALLET</Text>
              <Text style={[S.sheetTitle, { color: colors.textPrimary }]}>
                {walletMode === 'mwa' ? 'not available' : 'secret key'}
              </Text>
            </View>
            <Pressable onPress={dismiss} style={[S.closeBtn, softGlass]}>
              <Feather name="x" size={14} color={colors.textSecondary} />
            </Pressable>
          </View>

          {walletMode === 'mwa' ? (
            <View style={S.phaseCenter}>
              <View style={[S.successIcon, { backgroundColor: colors.surface1, borderWidth: 0.5, borderColor: colors.border }]}>
                <Feather name="lock" size={28} color={colors.textSecondary} />
              </View>
              <View style={{ alignItems: 'center', gap: 6 }}>
                <Text style={[S.successTitle, { color: colors.textPrimary }]}>MWA wallet</Text>
                <Text style={[S.exportSubText, { color: colors.textSecondary }]}>
                  Keys are secured by your Solana Mobile device.{'\n'}Private key export is not available.
                </Text>
              </View>
              <Pressable onPress={dismiss} style={[S.doneBtn, softGlass]}>
                <Text style={[S.doneBtnText, { color: colors.textSecondary }]}>CLOSE</Text>
              </Pressable>
            </View>
          ) : (
            <View style={{ gap: 14 }}>
              <View style={[S.exportWarn, { backgroundColor: colors.error + '14', borderColor: colors.error + '38' }]}>
                <Feather name="alert-triangle" size={14} color={colors.error} style={{ marginTop: 1 }} />
                <Text style={[S.exportWarnText, { color: colors.error }]}>
                  Never share this key. Store offline only. Anyone with this key controls your wallet.
                </Text>
              </View>

              {loading ? (
                <View style={[S.keyBox, { backgroundColor: colors.surface0, borderColor: colors.border }]}>
                  <Text style={[S.exportHint, { color: colors.textTertiary }]}>LOADING…</Text>
                </View>
              ) : secretKey ? (
                <Pressable
                  onPressIn={() => setRevealed(true)}
                  onPressOut={() => setRevealed(false)}
                  style={[S.keyBox, { backgroundColor: colors.surface0, borderColor: revealed ? colors.primary + '60' : colors.border }]}
                >
                  <Text style={[S.keyText, { color: revealed ? colors.textPrimary : colors.textTertiary, letterSpacing: revealed ? 0 : 2 }]}>
                    {revealed ? secretKey : masked.slice(0, 44) + '\n' + masked.slice(44)}
                  </Text>
                </Pressable>
              ) : (
                <View style={[S.keyBox, { backgroundColor: colors.surface0, borderColor: colors.border }]}>
                  <Text style={[S.exportHint, { color: colors.error }]}>FAILED TO LOAD KEY</Text>
                </View>
              )}

              <Text style={[S.exportHint, { color: colors.textTertiary, textAlign: 'center' }]}>
                HOLD TO REVEAL · BASE58 ENCODED
              </Text>

              <Pressable onPress={dismiss} style={[S.doneBtn, softGlass]}>
                <Text style={[S.doneBtnText, { color: colors.textSecondary }]}>DONE</Text>
              </Pressable>
            </View>
          )}
        </Animated.View>
      </View>
    </Modal>
  );
}

// ── RNodePairModal ─────────────────────────────────────────────────────────────

const HANDSHAKE_LINES = ['connecting over ble…', 'negotiating keys…', 'verifying reticulum identity…'];

function RNodePairModal({ onClose, onPaired }: { onClose: () => void; onPaired: (d: NonNullable<PairedDevice>) => void }) {
  const { colors } = useTheme();
  const baseGlass   = useGlass();
  const accentGlass = useGlass('accent');
  const softGlass   = useGlass('soft');
  const [phase, setPhase] = useState(0);
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

  const sheetY = sheetAnim.interpolate({ inputRange: [0, 1], outputRange: [600, 0], extrapolate: 'clamp' });
  const overlayOpacity = sheetAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 1], extrapolate: 'clamp' });

  const phaseTitle = ['scanning nearby…', 'select a device', 'handshaking…', 'paired'][phase];

  return (
    <Modal transparent animationType="none" onRequestClose={dismiss}>
      <View style={StyleSheet.absoluteFill}>
        <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(4,4,6,0.72)', opacity: overlayOpacity }]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={dismiss} />
        </Animated.View>

        <Animated.View style={[
          S.sheet,
          { backgroundColor: colors.glass, borderColor: colors.border },
          { transform: [{ translateY: sheetY }] },
        ]}>
          {/* Grab handle */}
          <View style={[S.grabHandle, { backgroundColor: 'rgba(255,255,255,0.18)' }]} />

          {/* Header */}
          <View style={S.sheetHeader}>
            <View>
              <Text style={[S.sheetTag, { color: colors.textTertiary }]}>PAIR RNODE</Text>
              <Text style={[S.sheetTitle, { color: colors.textPrimary }]}>{phaseTitle}</Text>
            </View>
            <Pressable onPress={dismiss} style={[S.closeBtn, softGlass]}>
              <Feather name="x" size={14} color={colors.textSecondary} />
            </Pressable>
          </View>

          {/* Phase 0 — scanning */}
          {phase === 0 && (
            <View style={S.phaseCenter}>
              <RadarScan />
              <Text style={[S.scanSubText, { color: colors.textSecondary }]}>BLE · LoRa · SERIAL</Text>
            </View>
          )}

          {/* Phase 1 — device list */}
          {phase === 1 && (
            <View style={{ gap: 8 }}>
              {DEVICES.map(d => (
                <Pressable key={d.id} onPress={() => pick(d)} style={({ pressed }) => [S.deviceRow, baseGlass, { opacity: pressed ? 0.75 : 1 }]}>
                  <View style={[S.deviceIcon, accentGlass]}>
                    <Feather name="radio" size={18} color={colors.primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[S.deviceName, { color: colors.textPrimary }]}>{d.name}</Text>
                    <Text style={[S.deviceSerial, { color: colors.textTertiary }]}>{d.serial} · {d.rssi}dBm</Text>
                  </View>
                  <SignalBars value={d.rssi > -50 ? 4 : d.rssi > -65 ? 3 : 2} size={10} />
                </Pressable>
              ))}
            </View>
          )}

          {/* Phase 2 — handshake */}
          {phase === 2 && (
            <View style={{ padding: 20, gap: 10 }}>
              {HANDSHAKE_LINES.map((line, i) => (
                <Reanimated.View key={i} entering={FadeIn.delay(i * 320).duration(300)}>
                  <Text style={[S.handshakeLine, { color: colors.textSecondary }]}>
                    <Text style={{ color: colors.primary }}>{i === 0 ? '✓' : i === 1 ? '›' : '·'}{'  '}</Text>
                    {line}
                  </Text>
                </Reanimated.View>
              ))}
            </View>
          )}

          {/* Phase 3 — success */}
          {phase === 3 && (
            <View style={S.phaseCenter}>
              <View style={[S.successIcon, accentGlass]}>
                <Feather name="check" size={30} color={colors.primary} />
              </View>
              <View style={{ alignItems: 'center' }}>
                <Text style={[S.successTitle, { color: colors.textPrimary }]}>{selected?.name} paired</Text>
                <Text style={[S.successSub, { color: colors.textTertiary }]}>{selected?.serial} · ACTIVE CO-INTERFACE</Text>
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

// ── SectionLabel ──────────────────────────────────────────────────────────────

function SectionLabel({ children, right }: { children: React.ReactNode; right?: React.ReactNode }) {
  const { colors } = useTheme();
  return (
    <View style={S.sectionRow}>
      <Text style={[S.sectionText, { color: colors.textTertiary }]}>{String(children).toUpperCase()}</Text>
      {right}
    </View>
  );
}

// ── SettingsRow ───────────────────────────────────────────────────────────────

type RowProps = Readonly<{
  icon?: string;
  label: string;
  sub?: string;
  right?: React.ReactNode;
  onPress?: () => void;
  danger?: boolean;
  last?: boolean;
}>;

function SettingsRow({ icon, label, sub, right, onPress, danger, last }: RowProps) {
  const { colors } = useTheme();
  const softGlass = useGlass('soft');
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        S.rowBase,
        !last && { borderBottomWidth: 0.5, borderBottomColor: 'rgba(255,255,255,0.04)' },
        { opacity: pressed && !!onPress ? 0.7 : 1 },
      ]}
    >
      {!!icon && (
        <View style={[S.rowIconBox, softGlass]}>
          <Feather name={icon as any} size={15} color={danger ? colors.error : colors.textSecondary} />
        </View>
      )}
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={[S.rowLabel, { color: danger ? colors.error : colors.textPrimary }]}>{label}</Text>
        {sub && <Text style={[S.rowSub, { color: colors.textTertiary }]}>{sub}</Text>}
      </View>
      {right}
    </Pressable>
  );
}

// ── SettingsScreen ─────────────────────────────────────────────────────────────

export default function SettingsScreen() {
  const { colors } = useTheme();
  const baseGlass   = useGlass();
  const accentGlass = useGlass('accent');
  const softGlass   = useGlass('soft');

  const [pairOpen,       setPairOpen]       = useState(false);
  const [exportOpen,     setExportOpen]     = useState(false);
  const [qrOpen,         setQrOpen]         = useState(false);
  const [copied,         setCopied]         = useState(false);
  const [paired,         setPaired]         = useState<PairedDevice>({ id: 'rnode_001', name: 'RNode · 410MHz', rssi: -42, serial: 'RN-914-4f2a' });
  const [notifications,  setNotifications]  = useState(true);
  const [meshOnCell,     setMeshOnCell]     = useState(false);
  const [biometric,      setBiometric]      = useState(true);

  const router = useRouter();
  const { disconnect, isLoading: walletLoading } = useWallet();

  const handleSignOut = useCallback(async () => {
    await disconnect();
    router.replace('/onboarding');
  }, [disconnect, router]);

  const copyHandle = useCallback(() => {
    setCopied(true);
    setTimeout(() => setCopied(false), 1400);
  }, []);

  const onPaired = useCallback((d: NonNullable<PairedDevice>) => setPaired(d), []);

  return (
    <View style={[S.root, { backgroundColor: colors.background }]}>
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>

          {/* ── Identity card ── */}
          <View style={{ padding: 16, paddingBottom: 8 }}>
            <View style={[S.identityCard, baseGlass]}>
              <Pressable onPress={() => setQrOpen(true)} style={[S.qrWrap, { backgroundColor: colors.surface2, borderColor: colors.border }]}>
                <QRCode size={72} />
              </Pressable>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={[S.idLabel, { color: colors.textTertiary }]}>YOUR IDENTITY</Text>
                <Text style={[S.idHandle, { color: colors.textPrimary }]}>@node_7f3a</Text>
                <Text style={[S.idHash, { color: colors.textSecondary }]}>7xKq9h..F2p3aL8m</Text>
                <View style={{ flexDirection: 'row', gap: 6, marginTop: 8, alignItems: 'center' }}>
                  <Pressable onPress={copyHandle} style={[S.copyBtn, softGlass]}>
                    <Text style={[S.copyBtnText, { color: copied ? colors.primary : colors.textSecondary }]}>
                      {copied ? '✓ copied' : 'copy'}
                    </Text>
                  </Pressable>
                </View>
              </View>
            </View>
          </View>

          {/* ── Paired hardware ── */}
          <SectionLabel right={
            <Pressable onPress={() => setPairOpen(true)} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Feather name="plus" size={11} color={colors.primary} />
              <Text style={[S.sectionActionText, { color: colors.primary }]}>ADD</Text>
            </Pressable>
          }>
            paired hardware
          </SectionLabel>

          <View style={{ paddingHorizontal: 16 }}>
            {paired ? (
              <View style={[S.hardwareCard, baseGlass]}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  <View style={[S.hwIcon, accentGlass]}>
                    <Feather name="radio" size={22} color={colors.primary} />
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={[S.hwName, { color: colors.textPrimary }]}>{paired.name}</Text>
                    <Text style={[S.hwSerial, { color: colors.textTertiary }]}>{paired.serial}</Text>
                    <View style={{ flexDirection: 'row', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
                      <Pill label="CONNECTED" variant="success" dot />
                      <Pill label="LoRa"      variant="default" />
                      <Pill label="78% BATT"  variant="default" />
                    </View>
                  </View>
                </View>
                <View style={S.hwActions}>
                  {(['configure', 'update fw'] as const).map(a => (
                    <Pressable key={a} style={[S.hwActionBtn, softGlass]}>
                      <Text style={[S.hwActionText, { color: colors.textSecondary }]}>{a.toUpperCase()}</Text>
                    </Pressable>
                  ))}
                  <Pressable onPress={() => setPaired(null)} style={[S.hwActionBtn, softGlass]}>
                    <Text style={[S.hwActionText, { color: colors.error }]}>UNPAIR</Text>
                  </Pressable>
                </View>
              </View>
            ) : (
              <Pressable onPress={() => setPairOpen(true)} style={[S.addHwBtn, baseGlass, { borderStyle: 'dashed' }]}>
                <View style={[S.addHwIcon, softGlass]}>
                  <Feather name="plus" size={18} color={colors.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[S.hwName, { color: colors.textPrimary }]}>pair an rnode</Text>
                  <Text style={[S.hwSerial, { color: colors.textTertiary }]}>EXTEND RANGE WITH LoRa HARDWARE</Text>
                </View>
                <Feather name="chevron-right" size={13} color={colors.textTertiary} />
              </Pressable>
            )}
          </View>

          {/* ── Privacy & security ── */}
          <SectionLabel>privacy & security</SectionLabel>
          <View style={{ paddingHorizontal: 16 }}>
            <View style={[S.section, baseGlass]}>
              <SettingsRow icon="lock"      label="biometric unlock" sub="face id · required for transactions" right={<Toggle on={biometric}  onChange={setBiometric}  />} />
              <SettingsRow icon="refresh-cw"label="rotate keypair"   sub="generate new ed25519 · keeps handle" right={<Feather name="chevron-right" size={12} color={colors.textTertiary} />} onPress={() => {}} />
              <SettingsRow icon="upload"    label="export secret key"  sub="bs58 · ed25519 · offline only"     right={<Feather name="chevron-right" size={12} color={colors.textTertiary} />} onPress={() => setExportOpen(true)} last/>
            </View>
          </View>

          {/* ── Network ── */}
          <SectionLabel>network</SectionLabel>
          <View style={{ paddingHorizontal: 16 }}>
            <View style={[S.section, baseGlass]}>
              <SettingsRow icon="share-2"      label="mesh over cellular"   sub="fall back to 4g/5g when mesh is sparse"  right={<Toggle on={meshOnCell}    onChange={setMeshOnCell}    />} />
              <SettingsRow icon="message-circle" label="notifications"      sub="encrypted · mesh-delivered"               right={<Toggle on={notifications} onChange={setNotifications} />} />
              <SettingsRow icon="zap"           label="preferred interface" sub="auto · prioritizes lora when paired"       right={<Text style={[S.valueText, { color: colors.textSecondary }]}>AUTO</Text>} last />
            </View>
          </View>

          {/* ── About ── */}
          <SectionLabel>about</SectionLabel>
          <View style={{ paddingHorizontal: 16 }}>
            <View style={[S.section, baseGlass]}>
              <SettingsRow label="app version"    right={<Text style={[S.valueText, { color: colors.textSecondary }]}>0.4.1 · build 2026.04</Text>} last/>
            </View>

            <Pressable
              onPress={handleSignOut}
              disabled={walletLoading}
              style={[S.signOutBtn, { borderColor: colors.error + '38', opacity: walletLoading ? 0.5 : 1 }]}
            >
              <Text style={[S.signOutText, { color: colors.error }]}>
                {walletLoading ? 'DISCONNECTING…' : 'SIGN OUT · BURN SESSION'}
              </Text>
            </Pressable>
          </View>
        </ScrollView>
      </SafeAreaView>

      {qrOpen     && <QRModal           onClose={() => setQrOpen(false)} />}
      {pairOpen   && <RNodePairModal   onClose={() => setPairOpen(false)}   onPaired={onPaired} />}
      {exportOpen && <ExportWalletModal onClose={() => setExportOpen(false)} />}
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const S = StyleSheet.create({
  root: { flex: 1 },

  // Identity card
  identityCard: { borderRadius: 18, padding: 16, flexDirection: 'row', gap: 14, alignItems: 'center' },
  qrWrap:       { padding: 6, borderRadius: 10, borderWidth: 0.5, overflow: 'hidden' },
  idLabel:      { fontFamily: fontFamily.sansMd, fontSize: 9.5, letterSpacing: 2.5, textTransform: 'uppercase' },
  idHandle:     { fontFamily: fontFamily.sansMd, fontSize: 13, marginTop: 4, letterSpacing: 0.5 },
  idHash:       { fontFamily: fontFamily.sansMd, fontSize: 10.5, marginTop: 3 },
  copyBtn:      { paddingHorizontal: 9, paddingVertical: 4, borderRadius: 99 },
  copyBtnText:  { fontFamily: fontFamily.sansMd, fontSize: 9, letterSpacing: 1.5, textTransform: 'uppercase' },

  // Section label
  sectionRow:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 20, paddingBottom: 8 },
  sectionText:      { fontFamily: fontFamily.sansMd, fontSize: 10, letterSpacing: 2, textTransform: 'uppercase' },
  sectionActionText:{ fontFamily: fontFamily.sansMd, fontSize: 10, letterSpacing: 1.5, textTransform: 'uppercase' },

  // Section card
  section: { borderRadius: 16, overflow: 'hidden' },

  // Settings row
  rowBase:    { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, paddingHorizontal: 14 },
  rowIconBox: { width: 32, height: 32, borderRadius: 9, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  rowLabel:   { fontSize: 13.5, letterSpacing: -0.2 },
  rowSub:     { fontFamily: fontFamily.sansMd, fontSize: 10, letterSpacing: 0.5, marginTop: 2 },
  valueText:  { fontFamily: fontFamily.sansMd, fontSize: 11, letterSpacing: 0.5, textTransform: 'uppercase' },

  // Toggle
  toggleTrack: { width: 40, height: 24, borderRadius: 12, borderWidth: 0.5, overflow: 'hidden', justifyContent: 'center' },
  toggleThumb: { position: 'absolute', width: 20, height: 20, borderRadius: 10 },

  // Hardware card
  hardwareCard: { borderRadius: 16, padding: 14 },
  hwIcon:       { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  hwName:       { fontSize: 14, letterSpacing: -0.2 },
  hwSerial:     { fontFamily: fontFamily.sansMd, fontSize: 9.5, letterSpacing: 1.5, textTransform: 'uppercase', marginTop: 3 },
  hwActions:    { flexDirection: 'row', gap: 6, marginTop: 12 },
  hwActionBtn:  { flex: 1, padding: 9, borderRadius: 10, alignItems: 'center' },
  hwActionText: { fontFamily: fontFamily.sansMd, fontSize: 10, letterSpacing: 1.5, textTransform: 'uppercase' },
  addHwBtn:     { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, borderRadius: 16 },
  addHwIcon:    { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },

  // Sign out
  signOutBtn:  { marginTop: 10, padding: 13, borderRadius: 12, borderWidth: 0.5, alignItems: 'center', backgroundColor: 'transparent' },
  signOutText: { fontFamily: fontFamily.sansMd, fontSize: 11, fontWeight: '500', letterSpacing: 3, textTransform: 'uppercase' },

  // Modal sheet
  sheet:       { position: 'absolute', bottom: 0, left: 0, right: 0, borderRadius: 20, borderBottomLeftRadius: 0, borderBottomRightRadius: 0, padding: 14, paddingBottom: 28, borderWidth: 0.5 },
  grabHandle:  { width: 36, height: 4, borderRadius: 99, alignSelf: 'center', marginBottom: 14 },
  sheetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  sheetTag:    { fontFamily: fontFamily.sansMd, fontSize: 9.5, letterSpacing: 2, textTransform: 'uppercase' },
  sheetTitle:  { fontSize: 18, marginTop: 4, letterSpacing: -0.3 },
  closeBtn:    { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },

  // Modal phases
  phaseCenter:  { paddingVertical: 24, alignItems: 'center', gap: 16 },
  scanSubText:  { fontFamily: fontFamily.sansMd, fontSize: 10, letterSpacing: 2, textTransform: 'uppercase' },
  deviceRow:    { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, paddingHorizontal: 14, borderRadius: 14 },
  deviceIcon:   { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  deviceName:   { fontSize: 14, letterSpacing: -0.2 },
  deviceSerial: { fontFamily: fontFamily.sansMd, fontSize: 9.5, letterSpacing: 1, textTransform: 'uppercase', marginTop: 3 },
  handshakeLine:{ fontFamily: fontFamily.sansMd, fontSize: 11.5, letterSpacing: 0.3 },
  successIcon:  { width: 64, height: 64, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  successTitle: { fontSize: 17, letterSpacing: -0.3, textAlign: 'center' },
  successSub:   { fontFamily: fontFamily.sansMd, fontSize: 9.5, letterSpacing: 1.5, textTransform: 'uppercase', marginTop: 6 },
  doneBtn:      { width: '100%', padding: 13, borderRadius: 12, alignItems: 'center', marginTop: 4 },
  doneBtnText:  { fontFamily: fontFamily.sansMd, fontSize: 11, fontWeight: '600', letterSpacing: 3, textTransform: 'uppercase' },

  // Export wallet modal
  exportWarn:     { flexDirection: 'row', gap: 10, padding: 12, borderRadius: 12, borderWidth: 0.5 },
  exportWarnText: { flex: 1, fontFamily: fontFamily.sansMd, fontSize: 11, lineHeight: 17, letterSpacing: 0.2 },
  exportSubText:  { fontFamily: fontFamily.sansMd, fontSize: 11.5, lineHeight: 18, textAlign: 'center' as const },
  keyBox:         { padding: 14, borderRadius: 14, borderWidth: 0.5, alignItems: 'center' as const },
  keyText:        { fontFamily: fontFamily.mono, fontSize: 11, lineHeight: 20 },
  exportHint:     { fontFamily: fontFamily.sansMd, fontSize: 10, letterSpacing: 1 },

  // QR modal
  qrTabRow:      { flexDirection: 'row' as const, borderRadius: 10, padding: 3, gap: 2 },
  qrTabBtn:      { paddingHorizontal: 12, paddingVertical: 6 },
  qrTabText:     { fontFamily: fontFamily.sansMd, fontSize: 10, letterSpacing: 1.5, textTransform: 'uppercase' as const },
  qrCard:        { borderRadius: 24, padding: 20, alignItems: 'center' as const, marginHorizontal: 32 },
  qrLargeWrap:   { padding: 10, borderRadius: 14, borderWidth: 0.5, overflow: 'hidden' as const },
  qrModalHandle: { fontFamily: fontFamily.sansMd, fontSize: 16, letterSpacing: -0.3 },
  qrModalHash:   { fontFamily: fontFamily.sansMd, fontSize: 11, letterSpacing: 0.5 },
  qrModalHint:   { fontFamily: fontFamily.sansMd, fontSize: 9.5, letterSpacing: 2, textTransform: 'uppercase' as const },
});

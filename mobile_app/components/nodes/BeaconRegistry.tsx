import React, { memo, useState, useRef, useCallback } from 'react';
import { Animated, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import Reanimated, { FadeIn } from 'react-native-reanimated';
import { Feather } from '@expo/vector-icons';
import { fontFamily, useTheme } from '@/theme';
import { useGlass } from '@/hooks/useGlass';
import { Pill } from '@/components/ui/Pill';
import { PulseDot } from '@/components/ui/PulseDot';
import { SolanaIcon } from '@/components/onboarding/SolanaIcon';
import { useLxmfContext } from '@/context/LxmfContext';
import { useNetworkMode } from '@/src/hooks/useNetworkMode';

const BEACON_STALE_MS = 120_000;
const STAKE_SOL       = '0.5';
const NETWORK_FEE     = '~0.000005';

interface Props {
  readonly initialActive?: boolean;
  readonly style?: import('react-native').ViewStyle;
}

export const BeaconRegistry = memo(function BeaconRegistry({ initialActive: _initialActive = false, style }: Props) {
  const { colors } = useTheme();
  const glass       = useGlass();
  const softGlass   = useGlass('soft');
  const accentGlass = useGlass('accent');
  const { isBeacon, setBeaconMode, beacons, peers } = useLxmfContext();
  const reachableCount = beacons.filter(b => Date.now() - b.lastAnnounce < BEACON_STALE_MS).length
    + peers.filter(p => p.online).length;
  const { mode: networkMode } = useNetworkMode();
  const hasInternet = networkMode === 'online';

  const active = isBeacon;
  const [modal, setModal] = useState(false);
  const [cosigns]             = useState(24);
  const [earned]              = useState(0.000312);

  const sheetAnim = useRef(new Animated.Value(0)).current;

  const openModal = useCallback(() => {
    setModal(true);
    Animated.spring(sheetAnim, { toValue: 1, useNativeDriver: true, bounciness: 4 }).start();
  }, [sheetAnim]);

  const dismiss = useCallback(() => {
    Animated.timing(sheetAnim, { toValue: 0, duration: 220, useNativeDriver: true })
      .start(() => setModal(false));
  }, [sheetAnim]);

  const sheetY    = sheetAnim.interpolate({ inputRange: [0, 1], outputRange: [600, 0], extrapolate: 'clamp' });
  const overlayOp = sheetAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 1],   extrapolate: 'clamp' });

  return (
    <>
      {/* ── Card ────────────────────────────────────────────────────────── */}
      <View style={[S.wrap, style]}>
        <View style={S.labelRow}>
          <Text style={[S.sectionLabel, { color: colors.textTertiary }]}>BEACON REGISTRY</Text>
          <Pill label={active ? 'ACTIVE BEACON' : 'INACTIVE'} variant={active ? 'primary' : 'default'} dot={active} />
        </View>

        <View style={[S.card, glass]}>
          {active ? (
            <>
              {/* ── Active hero ── */}
              <View style={[S.activeHero, { borderBottomColor: colors.borderSubtle }]}>
                {/* Earned SOL */}
                <View style={S.earnedBlock}>
                  <View style={S.earnedRow}>
                    <SolanaIcon size={22} color={colors.primary} />
                    <Text style={[S.earnedVal, { color: colors.textPrimary }]}>{earned.toFixed(6)}</Text>
                  </View>
                  <Text style={[S.earnedLabel, { color: colors.textTertiary }]}>SOL EARNED</Text>
                </View>

                {/* Vertical divider */}
                <View style={[S.heroDivider, { backgroundColor: colors.borderSubtle }]} />

                {/* Co-signs */}
                <View style={S.cosignBlock}>
                  <View style={S.earnedRow}>
                    <Text style={[S.cosignVal, { color: colors.textPrimary }]}>{cosigns}</Text>
                  </View>
                  <Text style={[S.earnedLabel, { color: colors.textTertiary }]}>CO-SIGNS</Text>
                </View>
              </View>

              {/* ── Status chips ── */}
              <View style={[S.chipsRow, { borderBottomColor: colors.borderSubtle }]}>
                <View style={[S.chip, softGlass]}>
                  <View style={[S.chipDot, { backgroundColor: colors.primary }]} />
                  <Text style={[S.chipText, { color: colors.textSecondary }]}>Solana Devnet</Text>
                </View>
                <View style={[S.chip, softGlass]}>
                  <Feather name="lock" size={9} color={colors.textTertiary} />
                  <Text style={[S.chipText, { color: colors.textSecondary }]}>{STAKE_SOL} SOL locked</Text>
                </View>
                <View style={[S.chip, softGlass]}>
                  <PulseDot size={5} />
                  <Text style={[S.chipText, { color: colors.primary }]}>{reachableCount} reachable</Text>
                </View>
              </View>

              {/* ── Deregister ── */}
              <Pressable
                onPress={openModal}
                style={({ pressed }) => [S.deregBtn, { borderColor: colors.border, opacity: pressed ? 0.7 : 1 }]}
              >
                <Feather name="radio" size={12} color={colors.textTertiary} />
                <Text style={[S.deregText, { color: colors.textTertiary }]}>DEREGISTER BEACON</Text>
              </Pressable>
            </>
          ) : (
            <>
              {/* ── Inactive stats ── */}
              <View style={[S.statsRow, { borderBottomColor: colors.borderSubtle }]}>
                <View style={S.stat}>
                  <Text style={[S.statVal, { color: colors.textPrimary }]}>{reachableCount}</Text>
                  <Text style={[S.statKey, { color: colors.textTertiary }]}>ACTIVE BEACONS</Text>
                </View>
                <View style={[S.statDivider, { backgroundColor: colors.borderSubtle }]} />
                <View style={S.stat}>
                  <Text style={[S.statVal, { color: colors.textPrimary }]}>{STAKE_SOL} SOL</Text>
                  <Text style={[S.statKey, { color: colors.textTertiary }]}>STAKE REQUIRED</Text>
                </View>
              </View>

              <Text style={[S.desc, { color: colors.textSecondary }]}>
                Beacon nodes are always-on relays that keep the mesh alive. They announce themselves to the network, forward encrypted packets across hops, and co-sign confidential Solana transactions — earning fees from every co-sign.{'\n\n'}
                Unlike regular peers, beacons run 24/7 and are reachable from any transport — BLE, LoRa, TCP. The more beacons online, the stronger and more resilient the mesh becomes.{'\n\n'}
                Stake {STAKE_SOL} SOL to register. Your stake is fully returned when you deregister.
              </Text>

              <Pressable
                onPress={hasInternet ? openModal : undefined}
                style={({ pressed }) => {
                  let opacity = 0.4;
                  if (hasInternet) opacity = pressed ? 0.85 : 1;
                  return [S.regBtn, accentGlass, { opacity }];
                }}
              >
                <Feather name="radio" size={13} color={colors.primary} />
                <Text style={[S.regText, { color: colors.primary }]}>
                  {hasInternet ? 'REGISTER AS BEACON' : 'REQUIRES INTERNET'}
                </Text>
              </Pressable>
            </>
          )}
        </View>
      </View>

      {/* ── Modal ───────────────────────────────────────────────────────── */}
      <Modal visible={modal} transparent animationType="none" onRequestClose={dismiss}>
        <View style={StyleSheet.absoluteFill}>
          <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(4,4,6,0.72)', opacity: overlayOp }]}>
            <Pressable style={StyleSheet.absoluteFill} onPress={dismiss} />
          </Animated.View>

          <Animated.View style={[S.sheet, { backgroundColor: colors.glass, borderColor: colors.border, transform: [{ translateY: sheetY }] }]}>
            <View style={[S.grab, { backgroundColor: 'rgba(255,255,255,0.18)' }]} />

            {/* Header */}
            <View style={S.header}>
              <View>
                <Text style={[S.tag,   { color: colors.textTertiary }]}>ANONMESH NETWORK</Text>
                <Text style={[S.title, { color: colors.textPrimary }]}>
                  {active ? 'Deregister Beacon' : 'Become a Beacon'}
                </Text>
              </View>
              <Pressable onPress={dismiss} style={[S.closeBtn, softGlass]}>
                <Feather name="x" size={14} color={colors.textSecondary} />
              </Pressable>
            </View>

            {/* Fee breakdown — register only */}
            {!active && (
              <View style={{ gap: 8 }}>
                {([
                  { icon: 'lock'   as const, bg: colors.primarySubtle,  iconColor: colors.primary,       label: 'Stake (locked)',  val: `${STAKE_SOL} SOL`,   valColor: colors.textPrimary  },
                  { icon: 'zap'    as const, bg: colors.surface1,        iconColor: colors.textTertiary,  label: 'Network fee',     val: `${NETWORK_FEE} SOL`, valColor: colors.textTertiary },
                  { icon: 'shield' as const, bg: colors.accentSubtle,    iconColor: colors.accent,        label: 'Role assigned',   val: 'Co-signer',          valColor: colors.accent       },
                ] as const).map((row, i) => (
                  <Reanimated.View key={row.label} entering={FadeIn.delay(i * 260).duration(280)}>
                    <Pressable style={[S.feeRow, glass]}>
                      <View style={[S.feeIcon, { backgroundColor: row.bg }]}>
                        <Feather name={row.icon} size={13} color={row.iconColor} />
                      </View>
                      <Text style={[S.feeLabel, { color: colors.textSecondary }]}>{row.label}</Text>
                      <Text style={[S.feeVal, { color: row.valColor }]}>{row.val}</Text>
                    </Pressable>
                  </Reanimated.View>
                ))}
              </View>
            )}

            {/* Deregister warning rows */}
            {active && (
              <View style={{ gap: 8 }}>
                {([
                  { icon: 'trending-up' as const, bg: colors.accentSubtle, iconColor: colors.accent,       label: 'Earnings to date',  val: `◎ ${earned.toFixed(6)}`, valColor: colors.accent       },
                  { icon: 'unlock'      as const, bg: colors.surface1,     iconColor: colors.textTertiary,  label: 'Stake returned',    val: `${STAKE_SOL} SOL`,        valColor: colors.textPrimary  },
                  { icon: 'x-circle'   as const, bg: colors.error + '18', iconColor: colors.error,         label: 'Co-sign role lost', val: 'Immediately',             valColor: colors.error        },
                ] as const).map((row, i) => (
                  <Reanimated.View key={row.label} entering={FadeIn.delay(i * 260).duration(280)}>
                    <View style={[S.feeRow, glass]}>
                      <View style={[S.feeIcon, { backgroundColor: row.bg }]}>
                        <Feather name={row.icon} size={13} color={row.iconColor} />
                      </View>
                      <Text style={[S.feeLabel, { color: colors.textSecondary }]}>{row.label}</Text>
                      <Text style={[S.feeVal, { color: row.valColor }]}>{row.val}</Text>
                    </View>
                  </Reanimated.View>
                ))}
              </View>
            )}

            <Text style={[S.sheetDesc, { color: colors.textSecondary }]}>
              {active
                ? `${STAKE_SOL} SOL stake returns to your wallet. Co-sign fees stop immediately.`
                : `Your wallet will be charged ${STAKE_SOL} SOL as stake. Authenticate to confirm.`}
            </Text>

            {/* Primary action */}
            {active ? (
              <Pressable
                onPress={() => { setBeaconMode(false); dismiss(); }}
                style={({ pressed }) => [S.deregModalBtn, { borderColor: colors.error + '40', opacity: pressed ? 0.7 : 1 }]}
              >
                <Feather name="trash-2" size={13} color={colors.error} />
                <Text style={[S.deregModalText, { color: colors.error }]}>CONFIRM DEREGISTER</Text>
              </Pressable>
            ) : (
              <Pressable
                onPress={() => { setBeaconMode(true); dismiss(); }}
                style={({ pressed }) => [S.signBtn, { backgroundColor: colors.primary, opacity: pressed ? 0.88 : 1 }]}
              >
                <Feather name="lock" size={14} color={colors.textInverse} />
                <Text style={[S.signText, { color: colors.textInverse }]}>SIGN WITH BIOMETRICS</Text>
              </Pressable>
            )}
          </Animated.View>
        </View>
      </Modal>
    </>
  );
});

const S = StyleSheet.create({
  // ── Outer ───────────────────────────────────────────────────────────────────
  wrap:         { paddingHorizontal: 20, marginTop: 16, marginBottom: 16, flex: 1 },
  labelRow:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  sectionLabel: { fontFamily: fontFamily.sansMd, fontSize: 10, letterSpacing: 2, textTransform: 'uppercase' },
  card:         { borderRadius: 16, overflow: 'hidden', flex: 1 },

  // ── Active state ────────────────────────────────────────────────────────────
  activeHero:   { flexDirection: 'row', borderBottomWidth: 0.5, paddingVertical: 20, paddingHorizontal: 18 },
  earnedBlock:  { flex: 1, alignItems: 'center', gap: 4 },
  cosignBlock:  { flex: 1, alignItems: 'center', gap: 4 },
  earnedRow:    { flexDirection: 'row', alignItems: 'center', gap: 6 },
  earnedVal:    { fontFamily: fontFamily.sansBold, fontSize: 22, letterSpacing: -0.5, lineHeight: 30 },
  cosignVal:    { fontFamily: fontFamily.sansBold, fontSize: 28, letterSpacing: -1, lineHeight: 34 },
  earnedLabel:  { fontFamily: fontFamily.sansMd, fontSize: 9, letterSpacing: 2, textTransform: 'uppercase' },
  heroDivider:  { width: 0.5, marginVertical: 4, marginHorizontal: 16 },

  chipsRow:     { flexDirection: 'row', gap: 6, padding: 12, borderBottomWidth: 0.5, justifyContent: 'space-between' },
  chip:         { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 9, paddingVertical: 5, borderRadius: 99 },
  chipDot:      { width: 6, height: 6, borderRadius: 3 },
  chipText:     { fontFamily: fontFamily.sansMd, fontSize: 10, letterSpacing: 0.5 },

  // ── Inactive state ───────────────────────────────────────────────────────────
  statsRow:     { flexDirection: 'row', borderBottomWidth: 0.5, paddingVertical: 14, paddingHorizontal: 16 },
  stat:         { flex: 1, alignItems: 'center', gap: 3 },
  statVal:      { fontFamily: fontFamily.sansMd, fontSize: 15, fontWeight: '600' },
  statKey:      { fontFamily: fontFamily.sansMd, fontSize: 8, letterSpacing: 2, textTransform: 'uppercase' },
  statDivider:  { width: 0.5, marginVertical: 4 },
  desc:         { fontFamily: fontFamily.sansMd, fontSize: 11, lineHeight: 17, padding: 16, paddingTop: 12 },

  regBtn:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
                  margin: 12, marginTop: 0, padding: 12, borderRadius: 12 },
  regText:      { fontFamily: fontFamily.sansMd, fontSize: 10.5, fontWeight: '600', letterSpacing: 2, textTransform: 'uppercase' },
  deregBtn:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
                  margin: 12, marginTop: 0, padding: 11, borderRadius: 12, borderWidth: 0.5 },
  deregText:    { fontFamily: fontFamily.sansMd, fontSize: 10, letterSpacing: 2, textTransform: 'uppercase' },

  // ── Modal ────────────────────────────────────────────────────────────────────
  sheet:        { position: 'absolute', bottom: 0, left: 0, right: 0,
                  borderRadius: 20, borderBottomLeftRadius: 0, borderBottomRightRadius: 0,
                  padding: 14, paddingBottom: 32, borderWidth: 0.5 },
  grab:         { width: 36, height: 4, borderRadius: 99, alignSelf: 'center', marginBottom: 14 },
  header:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  tag:          { fontFamily: fontFamily.sansMd, fontSize: 9.5, letterSpacing: 2, textTransform: 'uppercase' },
  title:        { fontSize: 18, marginTop: 4, letterSpacing: -0.3 },
  closeBtn:     { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },

  feeRow:       { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, paddingHorizontal: 14, borderRadius: 14 },
  feeIcon:      { width: 30, height: 30, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  feeLabel:     { flex: 1, fontFamily: fontFamily.sansMd, fontSize: 12 },
  feeVal:       { fontFamily: fontFamily.sansMd, fontSize: 12, fontWeight: '600' },
  sheetDesc:    { fontFamily: fontFamily.sansMd, fontSize: 12, lineHeight: 18,
                  marginTop: 12, marginBottom: 20, opacity: 0.65 },

  signBtn:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
                  padding: 15, borderRadius: 14 },
  signText:     { fontFamily: fontFamily.sansMd, fontSize: 11, fontWeight: '700', letterSpacing: 2.5, textTransform: 'uppercase' },

  deregModalBtn:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
                    padding: 14, borderRadius: 14, borderWidth: 0.5 },
  deregModalText: { fontFamily: fontFamily.sansMd, fontSize: 11, fontWeight: '600', letterSpacing: 2, textTransform: 'uppercase' },
});

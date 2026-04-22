import React, { memo, useState, useRef, useCallback } from 'react';
import { Animated, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { fontFamily, useTheme } from '@/theme';
import { useGlass } from '@/hooks/useGlass';
import { Pill } from '@/components/ui/Pill';

const ACTIVE_BEACONS = 3;
const STAKE_SOL      = '0.5';
const NETWORK_FEE    = '~0.000005';

interface Props {
  readonly initialActive?: boolean;
}

export const BeaconRegistry = memo(function BeaconRegistry({ initialActive = false }: Props) {
  const { colors } = useTheme();
  const glass       = useGlass();
  const softGlass   = useGlass('soft');
  const accentGlass = useGlass('accent');

  const [active,  setActive]  = useState(initialActive);
  const [modal,   setModal]   = useState(false);
  const [cosigns]             = useState(0);
  const [earned]              = useState(0);

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
      <View style={S.wrap}>
        <View style={S.labelRow}>
          <Text style={[S.sectionLabel, { color: colors.textTertiary }]}>BEACON REGISTRY</Text>
          <Pill label={active ? 'ACTIVE BEACON' : 'INACTIVE'} variant={active ? 'success' : 'default'} dot={active} />
        </View>

        <View style={[S.card, glass]}>
          <View style={[S.statsRow, { borderBottomColor: colors.borderSubtle }]}>
            <View style={S.stat}>
              <Text style={[S.statVal, { color: colors.textPrimary }]}>{ACTIVE_BEACONS}</Text>
              <Text style={[S.statKey, { color: colors.textTertiary }]}>ACTIVE BEACONS</Text>
            </View>
            <View style={[S.statDivider, { backgroundColor: colors.borderSubtle }]} />
            <View style={S.stat}>
              <Text style={[S.statVal, { color: colors.textPrimary }]}>{STAKE_SOL} SOL</Text>
              <Text style={[S.statKey, { color: colors.textTertiary }]}>STAKE REQUIRED</Text>
            </View>
            {active && (
              <>
                <View style={[S.statDivider, { backgroundColor: colors.borderSubtle }]} />
                <View style={S.stat}>
                  <Text style={[S.statVal, { color: colors.accent }]}>{cosigns}</Text>
                  <Text style={[S.statKey, { color: colors.textTertiary }]}>CO-SIGNS</Text>
                </View>
              </>
            )}
          </View>

          <Text style={[S.desc, { color: colors.textSecondary }]}>
            {active
              ? `Earning as beacon co-signer. Stake locked: ${STAKE_SOL} SOL. Accumulated: ${earned.toFixed(6)} SOL.`
              : 'Stake SOL to become a beacon node. Co-sign confidential transactions and earn fees from the network.'}
          </Text>

          {active ? (
            <Pressable
              onPress={openModal}
              style={({ pressed }) => [S.deregBtn, { borderColor: colors.border, opacity: pressed ? 0.7 : 1 }]}
            >
              <Feather name="radio" size={12} color={colors.textTertiary} />
              <Text style={[S.deregText, { color: colors.textTertiary }]}>DEREGISTER BEACON</Text>
            </Pressable>
          ) : (
            <Pressable
              onPress={openModal}
              style={({ pressed }) => [S.regBtn, accentGlass, { opacity: pressed ? 0.85 : 1 }]}
            >
              <Feather name="radio" size={13} color={colors.primary} />
              <Text style={[S.regText, { color: colors.primary }]}>REGISTER AS BEACON</Text>
            </Pressable>
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
              <View style={[S.feeCard, { backgroundColor: colors.surface2 + '80', borderColor: colors.border }]}>
                <View style={S.feeRow}>
                  <View style={[S.feeIcon, { backgroundColor: colors.primarySubtle }]}>
                    <Feather name="lock" size={13} color={colors.primary} />
                  </View>
                  <Text style={[S.feeLabel, { color: colors.textSecondary }]}>Stake (locked)</Text>
                  <Text style={[S.feeVal, { color: colors.textPrimary }]}>{STAKE_SOL} SOL</Text>
                </View>
                <View style={[S.feeSep, { backgroundColor: colors.borderSubtle }]} />
                <View style={S.feeRow}>
                  <View style={[S.feeIcon, { backgroundColor: colors.surface1 }]}>
                    <Feather name="zap" size={13} color={colors.textTertiary} />
                  </View>
                  <Text style={[S.feeLabel, { color: colors.textSecondary }]}>Network fee</Text>
                  <Text style={[S.feeVal, { color: colors.textTertiary }]}>{NETWORK_FEE} SOL</Text>
                </View>
                <View style={[S.feeSep, { backgroundColor: colors.borderSubtle }]} />
                <View style={S.feeRow}>
                  <View style={[S.feeIcon, { backgroundColor: colors.accentSubtle }]}>
                    <Feather name="shield" size={13} color={colors.accent} />
                  </View>
                  <Text style={[S.feeLabel, { color: colors.textSecondary }]}>Role assigned</Text>
                  <Text style={[S.feeVal, { color: colors.accent }]}>Co-signer</Text>
                </View>
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
                onPress={() => { setActive(false); dismiss(); }}
                style={({ pressed }) => [S.deregModalBtn, { borderColor: colors.border, opacity: pressed ? 0.7 : 1 }]}
              >
                <Feather name="trash-2" size={13} color={colors.textSecondary} />
                <Text style={[S.deregModalText, { color: colors.textSecondary }]}>CONFIRM DEREGISTER</Text>
              </Pressable>
            ) : (
              <Pressable
                onPress={() => { setActive(true); dismiss(); }}
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
  // ── Outer card ──────────────────────────────────────────────────────────────
  wrap:         { paddingHorizontal: 20, marginTop: 20 },
  labelRow:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  sectionLabel: { fontFamily: fontFamily.sansMd, fontSize: 10, letterSpacing: 2, textTransform: 'uppercase' },

  card:         { borderRadius: 16, overflow: 'hidden' },
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

  // ── Modal sheet (matches ExportWalletModal pattern) ──────────────────────────
  sheet:        { position: 'absolute', bottom: 0, left: 0, right: 0,
                  borderRadius: 20, borderBottomLeftRadius: 0, borderBottomRightRadius: 0,
                  padding: 14, paddingBottom: 32, borderWidth: 0.5 },
  grab:         { width: 36, height: 4, borderRadius: 99, alignSelf: 'center', marginBottom: 14 },
  header:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  tag:          { fontFamily: fontFamily.sansMd, fontSize: 9.5, letterSpacing: 2, textTransform: 'uppercase' },
  title:        { fontSize: 18, marginTop: 4, letterSpacing: -0.3, color: 'white' },
  closeBtn:     { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },

  feeCard:      { borderRadius: 14, borderWidth: 0.5, marginBottom: 14, overflow: 'hidden' },
  feeRow:       { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12 },
  feeIcon:      { width: 30, height: 30, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  feeLabel:     { flex: 1, fontFamily: fontFamily.sansMd, fontSize: 12 },
  feeVal:       { fontFamily: fontFamily.sansMd, fontSize: 12, fontWeight: '600' },
  feeSep:       { height: 0.5, marginHorizontal: 12 },

  sheetDesc:    { fontFamily: fontFamily.sansMd, fontSize: 12, lineHeight: 18,
                  marginBottom: 20, opacity: 0.65 },

  signBtn:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
                  padding: 15, borderRadius: 14 },
  signText:     { fontFamily: fontFamily.sansMd, fontSize: 11, fontWeight: '700', letterSpacing: 2.5, textTransform: 'uppercase' },

  deregModalBtn:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
                    padding: 14, borderRadius: 14, borderWidth: 0.5 },
  deregModalText: { fontFamily: fontFamily.sansMd, fontSize: 11, fontWeight: '600', letterSpacing: 2, textTransform: 'uppercase' },
});

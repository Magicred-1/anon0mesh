import React, { memo, useState, useRef, useCallback } from 'react';
import { Animated, KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { fontFamily, fontSize, radii, spacing, useTheme } from '@/theme';
import { useGlass } from '@/hooks/useGlass';
import { AppBottomSheet } from '@/components/primitives';
import { Pill } from '@/components/ui/Pill';
import { SolanaIcon } from '@/components/onboarding/SolanaIcon';
import { useLxmfContext } from '@/context/LxmfContext';
import { useNetworkMode } from '@/src/hooks/useNetworkMode';

const BEACON_STALE_MS = 120_000;
const STAKE_SOL       = '0.5';
const NETWORK_FEE     = '~0.000005';
const STAKE_NUM       = 0.5;
const JITO_RATE       = 0.8734;
const JITO_APY        = 0.085;

interface Props {
  readonly initialActive?: boolean;
  readonly style?: import('react-native').ViewStyle;
}

export const BeaconRegistry = memo(function BeaconRegistry({ initialActive: _initialActive = false, style }: Props) {
  const { colors } = useTheme();
  const glass     = useGlass();
  const softGlass = useGlass('soft');
  const { isBeacon, setBeaconMode, beacons, peers } = useLxmfContext();
  const reachableCount = beacons.filter(b => Date.now() - b.lastAnnounce < BEACON_STALE_MS).length
    + peers.filter(p => p.online).length;
  const { mode: networkMode } = useNetworkMode();
  const hasInternet = networkMode === 'online';

  const active          = isBeacon;
  const [cosigns]       = useState(24);
  const [earned]        = useState(0.000312);
  const [modal, setModal]         = useState(false);
  const [stakeModal, setStakeModal] = useState(false);
  const [stakeAmt, setStakeAmt]   = useState(0.5);
  const [rawAmt, setRawAmt]       = useState('0.5');
  const amtInputRef = useRef<TextInput>(null);
  const stakeAnim         = useRef(new Animated.Value(0)).current;

  // Auto-activate on first internet was removed per AUDIT T10 / ROADMAP § 0.B.3:
  // beacon mode carries trust implications (relaying others' traffic) so the
  // user has to opt in via the Register-as-Beacon control. hasInternet is still
  // consumed for UI affordances.
  void hasInternet;

  const openModal = useCallback(() => setModal(true), []);

  // AppBottomSheet owns the slide/dismiss animation; closing is just a state
  // flip now. handleRegister and the in-sheet controls still call this.
  const dismiss = useCallback(() => setModal(false), []);

  const handleRegister = useCallback(() => {
    setBeaconMode(true);
    dismiss();
  }, [setBeaconMode, dismiss]);

  const commitAmt = useCallback((v: number) => {
    const n = Math.max(0.5, Number.parseFloat(Math.max(0.5, v).toFixed(1)));
    setStakeAmt(n);
    setRawAmt(n.toFixed(1));
  }, []);

  const openStake = useCallback(() => {
    setStakeModal(true);
    Animated.spring(stakeAnim, { toValue: 1, useNativeDriver: true, bounciness: 4 }).start();
  }, [stakeAnim]);

  const dismissStake = useCallback(() => {
    Animated.timing(stakeAnim, { toValue: 0, duration: 220, useNativeDriver: true })
      .start(() => setStakeModal(false));
  }, [stakeAnim]);

  const stakeSheetY = stakeAnim.interpolate({ inputRange: [0, 1], outputRange: [500, 0], extrapolate: 'clamp' });
  const stakeOvOp   = stakeAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 1],   extrapolate: 'clamp' });

  const jitoAmt   = (STAKE_NUM * JITO_RATE).toFixed(3);
  const yieldAmt  = (STAKE_NUM * JITO_APY).toFixed(4);
  const repScore  = Math.round(STAKE_NUM * 200);

  const previewAmt = Math.max(0.5, Number.parseFloat(rawAmt) || stakeAmt);
  const newTotal = STAKE_NUM + previewAmt;
  const newYield = (newTotal * JITO_APY).toFixed(4);
  const newRep   = Math.round(newTotal * 200);

  return (
    <>
      <View style={[S.wrap, style]}>
        <View style={S.labelRow}>
          <Text accessibilityRole="header" style={[S.sectionLabel, { color: colors.textTertiary }]}>BEACON REGISTRY</Text>
          <Pill label={active ? 'ACTIVE' : 'INACTIVE'} variant={active ? 'primary' : 'default'} dot={active} />
        </View>

        <View style={[S.card, glass, { borderColor: active ? colors.borderStrong : colors.border }]}>
          {active && <View style={[S.accentBar, { backgroundColor: colors.primary }]} />}

          {active ? (
            <>
              <View style={S.hero}>
                <View style={S.heroAmt}>
                  <SolanaIcon size={26} color={colors.primary} />
                  <Text style={[S.heroNum, { color: colors.textPrimary }]}>{earned.toFixed(6)}</Text>
                </View>
                <Text style={[S.heroLabel, { color: colors.textTertiary }]}>SOL EARNED</Text>
              </View>

              <View style={[S.repRow, { borderTopColor: colors.borderSubtle, borderBottomColor: colors.borderSubtle }]}>
                <View style={S.repCell}>
                  <Text style={[S.repNum, { color: colors.textPrimary }]}>{repScore}</Text>
                  <Text style={[S.repLabel, { color: colors.textTertiary }]}>REP SCORE</Text>
                </View>
                <View style={[S.repDivider, { backgroundColor: colors.borderSubtle }]} />
                <View style={S.repCell}>
                  <Text style={[S.repNum, { color: colors.textPrimary }]}>{jitoAmt}</Text>
                  <Text style={[S.repLabel, { color: colors.textTertiary }]}>JITOSOL</Text>
                  <Pressable
                    onPress={openStake}
                    style={({ pressed }) => [S.stakeChip, { borderColor: colors.primary + '60', backgroundColor: colors.primary + '18', opacity: pressed ? 0.7 : 1 }]}
                  >
                    <Feather name="plus" size={9} color={colors.primary} />
                    <Text style={[S.stakeChipText, { color: colors.primary }]}>Stake</Text>
                  </Pressable>
                </View>
                <View style={[S.repDivider, { backgroundColor: colors.borderSubtle }]} />
                <View style={S.repCell}>
                  <Text style={[S.repNum, { color: colors.primary }]}>+{yieldAmt}</Text>
                  <Text style={[S.repLabel, { color: colors.textTertiary }]}>SOL / YR</Text>
                </View>
              </View>

              <View style={S.footer}>
                <Text style={[S.footerStat, { color: colors.textSecondary }]}>
                  <Text style={[S.footerNum, { color: colors.textPrimary }]}>{cosigns}</Text>{'  '}co-signs
                </Text>
                <View style={[S.footerDot, { backgroundColor: colors.borderSubtle }]} />
                <Text style={[S.footerStat, { color: colors.textSecondary }]}>
                  <Text style={[S.footerNum, { color: colors.primary }]}>{reachableCount}</Text>{'  '}reachable
                </Text>
              </View>
            </>
          ) : (
            <>
              <Text style={[S.desc, { color: colors.textSecondary }]}>
                Relay traffic across the mesh, co-sign Solana transactions, earn fees. Stake {STAKE_SOL} SOL — fully returned on exit.
              </Text>
              <Pressable
                onPress={hasInternet ? openModal : undefined}
                style={({ pressed }) => {
                  let opacity = 0.35;
                  if (hasInternet) opacity = pressed ? 0.75 : 1;
                  return [S.regBtn, { backgroundColor: colors.primary, opacity }];
                }}
              >
                <Text style={[S.regText, { color: colors.textInverse }]}>
                  {hasInternet ? 'Register as Beacon' : 'Requires Internet'}
                </Text>
                {hasInternet && <Feather name="arrow-right" size={14} color={colors.textInverse} />}
              </Pressable>
            </>
          )}
        </View>
      </View>

      <AppBottomSheet visible={modal} onClose={dismiss} backgroundColor={colors.glass}>
        <View style={S.sheetHeader}>
          <Text style={[S.sheetTitle, { color: colors.textPrimary }]}>Become a Beacon</Text>
          <Pressable onPress={dismiss} style={[S.closeBtn, softGlass]} hitSlop={8}>
            <Feather name="x" size={14} color={colors.textSecondary} />
          </Pressable>
        </View>

        <View style={S.feeList}>
          {[
            { icon: 'lock'        as const, label: 'Stake (returned on exit)', value: `${STAKE_SOL} SOL`,   dim: false },
            { icon: 'zap'         as const, label: 'Network fee',              value: `${NETWORK_FEE} SOL`, dim: true  },
            { icon: 'trending-up' as const, label: 'Earn from co-signs',       value: 'ongoing',            dim: false },
          ].map(row => (
            <View key={row.label} style={[S.feeRow, { borderBottomColor: colors.borderSubtle }]}>
              <Feather name={row.icon} size={13} color={row.dim ? colors.textTertiary : colors.primary} />
              <Text style={[S.feeLabel, { color: colors.textSecondary }]}>{row.label}</Text>
              <Text style={[S.feeVal, { color: row.dim ? colors.textTertiary : colors.textPrimary }]}>{row.value}</Text>
            </View>
          ))}
        </View>

        {/* CTA flips the local beacon-mode flag. Stake + biometric co-sign
            flow remains future work; the JS-side opt-in is the consent gate
            today. */}
        <Pressable
          onPress={handleRegister}
          accessibilityRole="button"
          accessibilityLabel="Enable beacon mode"
          style={({ pressed }) => [
            S.actionBtn,
            {
              backgroundColor: colors.primary,
              opacity: pressed ? 0.8 : 1,
            },
          ]}
        >
          <Text style={[S.actionText, { color: colors.textInverse }]}>Enable Beacon Mode</Text>
        </Pressable>
      </AppBottomSheet>

      {/* ── Stake Modal ── */}
      <Modal visible={stakeModal} transparent animationType="none" onRequestClose={dismissStake}>
        <KeyboardAvoidingView style={StyleSheet.absoluteFill} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: colors.overlay, opacity: stakeOvOp }]}>
            <Pressable style={StyleSheet.absoluteFill} onPress={dismissStake} />
          </Animated.View>

          <Animated.View style={[S.sheet, { backgroundColor: colors.glass, borderColor: colors.border, transform: [{ translateY: stakeSheetY }] }]}>
            <View style={[S.grab, { backgroundColor: colors.border }]} />

            <View style={S.sheetHeader}>
              <Text style={[S.sheetTitle, { color: colors.textPrimary }]}>Stake More SOL</Text>
              <Pressable onPress={dismissStake} style={[S.closeBtn, softGlass]} hitSlop={8}>
                <Feather name="x" size={14} color={colors.textSecondary} />
              </Pressable>
            </View>

            {/* Stepper */}
            <View style={[S.stepper, { backgroundColor: colors.surface2, borderColor: colors.border }]}>
              <Pressable
                onPress={() => setStakeAmt(a => Math.max(0.5, Number.parseFloat((a - 0.5).toFixed(1))))}
                hitSlop={16}
                style={({ pressed }) => [S.stepBtn, { opacity: pressed || stakeAmt <= 0.5 ? 0.35 : 1 }]}
              >
                <Feather name="minus" size={20} color={colors.textPrimary} />
              </Pressable>
              <View style={S.stepCenter}>
                <SolanaIcon size={28} color={colors.primary} />
                <TextInput
                  ref={amtInputRef}
                  style={[S.stepAmt, { color: colors.textPrimary }]}
                  value={rawAmt}
                  onChangeText={setRawAmt}
                  onBlur={() => commitAmt(Number.parseFloat(rawAmt) || 0.5)}
                  onSubmitEditing={() => commitAmt(Number.parseFloat(rawAmt) || 0.5)}
                  keyboardType="decimal-pad"
                  returnKeyType="done"
                  selectTextOnFocus
                />
                <Text style={[S.stepUnit, { color: colors.textTertiary }]}>SOL</Text>
              </View>
              <Pressable
                onPress={() => commitAmt(stakeAmt + 0.5)}
                hitSlop={16}
                style={({ pressed }) => [S.stepBtn, { opacity: pressed ? 0.35 : 1 }]}
              >
                <Feather name="plus" size={20} color={colors.textPrimary} />
              </Pressable>
            </View>

            {/* Impact rows */}
            <View style={[S.impactBox, { backgroundColor: colors.surface2, borderColor: colors.border }]}>
              <View style={[S.impactRow, { borderBottomColor: colors.borderSubtle }]}>
                <Feather name="shield" size={14} color={colors.primary} />
                <Text style={[S.impactRowLabel, { color: colors.textSecondary }]}>Rep score</Text>
                <Text style={[S.impactRowBefore, { color: colors.textTertiary }]}>{repScore}</Text>
                <Feather name="arrow-right" size={10} color={colors.textTertiary} />
                <Text style={[S.impactRowAfter, { color: colors.primary }]}>{newRep}</Text>
              </View>
              <View style={S.impactRow}>
                <Feather name="trending-up" size={14} color={colors.primary} />
                <Text style={[S.impactRowLabel, { color: colors.textSecondary }]}>Yield / yr</Text>
                <Text style={[S.impactRowBefore, { color: colors.textTertiary }]}>+{yieldAmt}</Text>
                <Feather name="arrow-right" size={10} color={colors.textTertiary} />
                <Text style={[S.impactRowAfter, { color: colors.primary }]}>+{newYield} SOL</Text>
              </View>
            </View>

            <View
              style={[S.actionBtn, { backgroundColor: colors.surface2, borderWidth: 0.5, borderColor: colors.border, opacity: 0.6 }]}
              pointerEvents="none"
            >
              <Text style={[S.actionText, { color: colors.textTertiary }]}>Preview — not yet active</Text>
            </View>
          </Animated.View>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
});

const S = StyleSheet.create({
  wrap:        { paddingHorizontal: spacing[6], marginTop: spacing[5], marginBottom: spacing[5] },
  labelRow:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing[3] },
  sectionLabel:{ fontFamily: fontFamily.sansMd, fontSize: fontSize.xs, letterSpacing: 2, textTransform: 'uppercase' },

  card:        { borderRadius: radii.xl, overflow: 'hidden', borderWidth: 0.5 },
  accentBar:   { height: 2 },

  hero:        { alignItems: 'center', paddingVertical: 28, gap: 6 },
  heroAmt:     { flexDirection: 'row', alignItems: 'center', gap: 5 },
  heroNum:     { fontFamily: fontFamily.sansBold, fontSize: fontSize['3xl'], letterSpacing: -1 },
  heroLabel:   { fontFamily: fontFamily.sansMd, fontSize: fontSize.xs, letterSpacing: 2.5, textTransform: 'uppercase' },

  repRow:      { flexDirection: 'row', borderTopWidth: 0.5, borderBottomWidth: 0.5, paddingVertical: 14 },
  repCell:     { flex: 1, alignItems: 'center', gap: spacing[2] },
  repNum:      { fontFamily: fontFamily.sansBold, fontSize: fontSize.md, letterSpacing: -0.5 },
  repLabel:    { fontFamily: fontFamily.sansMd, fontSize: fontSize.xs, letterSpacing: 2, textTransform: 'uppercase' },
  repDivider:  { width: 0.5, marginVertical: spacing[2] },
  stakeChip:     { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: spacing[3], paddingVertical: 3, borderRadius: radii.md, borderWidth: 0.5, marginTop: 2 },
  stakeChipText: { fontFamily: fontFamily.sansMd, fontSize: fontSize.xs, letterSpacing: 0.5 },

  footer:      { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: spacing[5], paddingVertical: spacing[4] },
  footerStat:  { fontFamily: fontFamily.sansMd, fontSize: fontSize.sm },
  footerNum:   { fontFamily: fontFamily.sansBold, fontSize: fontSize.md },
  footerDot:   { width: 3, height: 3, borderRadius: 2 },

  desc:        { fontFamily: fontFamily.sansMd, fontSize: fontSize.sm, lineHeight: 19, padding: 18, paddingBottom: 14 },
  regBtn:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7,
                 margin: 14, marginTop: 0, paddingVertical: 14, borderRadius: radii.md },
  regText:     { fontFamily: fontFamily.sansMd, fontSize: fontSize.sm, fontWeight: '600', letterSpacing: 0.3 },

  sheet:       { position: 'absolute', bottom: 0, left: 0, right: 0,
                 borderTopLeftRadius: radii.xl, borderTopRightRadius: radii.xl,
                 paddingHorizontal: spacing[6], paddingBottom: spacing[9], paddingTop: spacing[4], borderWidth: 0.5 },
  grab:        { width: 32, height: 3.5, borderRadius: radii.full, alignSelf: 'center', marginBottom: spacing[6] },
  sheetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing[6] },
  sheetTitle:  { fontFamily: fontFamily.sansBold, fontSize: fontSize.xl, letterSpacing: -0.4 },
  closeBtn:    { width: 30, height: 30, borderRadius: radii.full, alignItems: 'center', justifyContent: 'center' },
  feeList:     { gap: 0, marginBottom: spacing[7] },
  feeRow:      { flexDirection: 'row', alignItems: 'center', gap: spacing[4], paddingVertical: 14, borderBottomWidth: 0.5 },
  feeLabel:    { flex: 1, fontFamily: fontFamily.sansMd, fontSize: fontSize.sm },
  feeVal:      { fontFamily: fontFamily.sansMd, fontSize: fontSize.sm, fontWeight: '600' },
  actionBtn:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing[3],
                 paddingVertical: 15, borderRadius: radii.lg },
  actionText:  { fontFamily: fontFamily.sansMd, fontSize: fontSize.md, fontWeight: '600', letterSpacing: 0.2 },

  stepper:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
                borderRadius: radii.xl, borderWidth: 0.5, paddingHorizontal: spacing[6], paddingVertical: 18, marginBottom: 14 },
  stepBtn:    { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  stepCenter: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  stepAmt:    { fontFamily: fontFamily.sansBold, fontSize: fontSize['4xl'], letterSpacing: -1.5 },
  stepUnit:   { fontFamily: fontFamily.sansMd, fontSize: fontSize.md, letterSpacing: 0.5, marginBottom: 2 },

  impactBox:      { borderRadius: radii.lg, borderWidth: 0.5, overflow: 'hidden', marginBottom: spacing[6] },
  impactRow:      { flexDirection: 'row', alignItems: 'center', gap: spacing[3],
                    paddingHorizontal: 14, paddingVertical: 14, borderBottomWidth: 0.5 },
  impactRowLabel: { flex: 1, fontFamily: fontFamily.sansMd, fontSize: fontSize.sm },
  impactRowBefore:{ fontFamily: fontFamily.sansMd, fontSize: fontSize.sm },
  impactRowAfter: { fontFamily: fontFamily.sansMd, fontSize: fontSize.sm, fontWeight: '600' },
});

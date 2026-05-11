import React, { memo, useState, useRef, useCallback, useEffect } from 'react';
import { Animated, KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { fontFamily, useTheme } from '@/theme';
import { useGlass } from '@/hooks/useGlass';
import { Pill } from '@/components/ui/Pill';
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
  const glass     = useGlass();
  const softGlass = useGlass('soft');
  const { isBeacon, setBeaconMode, beacons, peers } = useLxmfContext();
  const reachableCount = beacons.filter(b => Date.now() - b.lastAnnounce < BEACON_STALE_MS).length
    + peers.filter(p => p.online).length;
  const { mode: networkMode } = useNetworkMode();
  const hasInternet = networkMode === 'online';

  const active          = isBeacon;
  const [modal, setModal]         = useState(false);
  const [stakeModal, setStakeModal] = useState(false);
  const [stakeAmt, setStakeAmt]   = useState(0.5);
  const [rawAmt, setRawAmt]       = useState('0.5');
  const amtInputRef = useRef<TextInput>(null);
  const autoActivatedRef  = useRef(false);
  const sheetAnim         = useRef(new Animated.Value(0)).current;
  const stakeAnim         = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!hasInternet || active || autoActivatedRef.current) return;
    autoActivatedRef.current = true;
    setBeaconMode(true);
  }, [hasInternet, active, setBeaconMode]);

  const openModal = useCallback(() => {
    setModal(true);
    Animated.spring(sheetAnim, { toValue: 1, useNativeDriver: true, bounciness: 4 }).start();
  }, [sheetAnim]);

  const dismiss = useCallback(() => {
    Animated.timing(sheetAnim, { toValue: 0, duration: 220, useNativeDriver: true })
      .start(() => setModal(false));
  }, [sheetAnim]);

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

  const sheetY      = sheetAnim.interpolate({ inputRange: [0, 1], outputRange: [500, 0], extrapolate: 'clamp' });
  const overlayOp   = sheetAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 1],   extrapolate: 'clamp' });
  const stakeSheetY = stakeAnim.interpolate({ inputRange: [0, 1], outputRange: [500, 0], extrapolate: 'clamp' });
  const stakeOvOp   = stakeAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 1],   extrapolate: 'clamp' });

  return (
    <>
      <View style={[S.wrap, style]}>
        <View style={S.labelRow}>
          <Text style={[S.sectionLabel, { color: colors.textTertiary }]}>BEACON REGISTRY</Text>
          <Pill label={active ? 'ACTIVE' : 'INACTIVE'} variant={active ? 'primary' : 'default'} dot={active} />
        </View>

        <View style={[S.card, glass, { borderColor: active ? colors.borderStrong : colors.border }]}>
          {active && <View style={[S.accentBar, { backgroundColor: colors.primary }]} />}

          {active ? (
            <>
              <View style={S.hero}>
                <View style={S.heroAmt}>
                  <SolanaIcon size={26} color={colors.primary} />
                  <Text style={[S.heroNum, { color: colors.textPrimary }]}>{reachableCount}</Text>
                </View>
                <Text style={[S.heroLabel, { color: colors.textTertiary }]}>NODES REACHABLE</Text>
              </View>

              <View style={S.previewNotice}>
                <Feather name="info" size={12} color={colors.textTertiary} />
                <Text style={[S.previewNoticeText, { color: colors.textTertiary }]}>
                  Stake delegation, co-sign rewards, and reputation scoring are in preview.
                </Text>
                <Pressable
                  onPress={openStake}
                  style={({ pressed }) => [S.stakeChip, { borderColor: colors.border, backgroundColor: colors.surface2, opacity: pressed ? 0.7 : 1 }]}
                >
                  <Feather name="eye" size={9} color={colors.textSecondary} />
                  <Text style={[S.stakeChipText, { color: colors.textSecondary }]}>Preview</Text>
                </Pressable>
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

      <Modal visible={modal} transparent animationType="none" onRequestClose={dismiss}>
        <View style={StyleSheet.absoluteFill}>
          <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(4,4,6,0.75)', opacity: overlayOp }]}>
            <Pressable style={StyleSheet.absoluteFill} onPress={dismiss} />
          </Animated.View>

          <Animated.View style={[S.sheet, { backgroundColor: colors.glass, borderColor: colors.border, transform: [{ translateY: sheetY }] }]}>
            <View style={[S.grab, { backgroundColor: colors.border }]} />

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

            <View
              style={[S.actionBtn, { backgroundColor: colors.surface2, borderWidth: 0.5, borderColor: colors.border, opacity: 0.6 }]}
              pointerEvents="none"
            >
              <Text style={[S.actionText, { color: colors.textTertiary }]}>Preview — not yet active</Text>
            </View>
          </Animated.View>
        </View>
      </Modal>

      {/* ── Stake Modal ── */}
      <Modal visible={stakeModal} transparent animationType="none" onRequestClose={dismissStake}>
        <KeyboardAvoidingView style={StyleSheet.absoluteFill} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(4,4,6,0.75)', opacity: stakeOvOp }]}>
            <Pressable style={StyleSheet.absoluteFill} onPress={dismissStake} />
          </Animated.View>

          <Animated.View style={[S.sheet, { backgroundColor: colors.glass, borderColor: colors.border, transform: [{ translateY: stakeSheetY }] }]}>
            <View style={[S.grab, { backgroundColor: colors.border }]} />

            <View style={S.sheetHeader}>
              <View style={S.sheetTitleRow}>
                <Text style={[S.sheetTitle, { color: colors.textPrimary }]}>Stake SOL</Text>
                <View style={[S.titleBadge, { backgroundColor: colors.surface2, borderColor: colors.border }]}>
                  <Text style={[S.titleBadgeText, { color: colors.textTertiary }]}>PREVIEW</Text>
                </View>
              </View>
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

            <View style={[S.impactBox, { backgroundColor: colors.surface2, borderColor: colors.border, padding: 14, gap: 6 }]}>
              <Text style={[S.impactRowLabel, { color: colors.textSecondary, flex: 0 }]}>
                Stake delegation is in preview.
              </Text>
              <Text style={[S.impactRowLabel, { color: colors.textTertiary, flex: 0, fontSize: 12, lineHeight: 17 }]}>
                Yield projections, reputation scoring, and JitoSOL conversion are not yet wired to live rates.
              </Text>
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
  wrap:        { paddingHorizontal: 20, marginTop: 16, marginBottom: 16 },
  labelRow:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  sectionLabel:{ fontFamily: fontFamily.sansMd, fontSize: 10, letterSpacing: 2, textTransform: 'uppercase' },

  card:        { borderRadius: 18, overflow: 'hidden', borderWidth: 0.5 },
  accentBar:   { height: 2 },

  hero:        { alignItems: 'center', paddingVertical: 28, gap: 6 },
  heroAmt:     { flexDirection: 'row', alignItems: 'center', gap: 8 },
  heroNum:     { fontFamily: fontFamily.sansBold, fontSize: 28, letterSpacing: -1 },
  heroLabel:   { fontFamily: fontFamily.sansMd, fontSize: 10, letterSpacing: 2.5, textTransform: 'uppercase' },

  previewNotice:     { flexDirection: 'row', alignItems: 'center', gap: 8,
                       paddingHorizontal: 16, paddingVertical: 12,
                       borderTopWidth: 0.5, borderTopColor: 'rgba(255,255,255,0.06)' },
  previewNoticeText: { flex: 1, fontFamily: fontFamily.sansMd, fontSize: 11, lineHeight: 15 },
  stakeChip:         { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10, borderWidth: 0.5 },
  stakeChipText:     { fontFamily: fontFamily.sansMd, fontSize: 9, letterSpacing: 0.5 },

  desc:        { fontFamily: fontFamily.sansMd, fontSize: 12.5, lineHeight: 19, padding: 18, paddingBottom: 14 },
  regBtn:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7,
                 margin: 14, marginTop: 0, paddingVertical: 14, borderRadius: 13 },
  regText:     { fontFamily: fontFamily.sansMd, fontSize: 13, fontWeight: '600', letterSpacing: 0.3 },

  sheet:       { position: 'absolute', bottom: 0, left: 0, right: 0,
                 borderTopLeftRadius: 22, borderTopRightRadius: 22,
                 paddingHorizontal: 20, paddingBottom: 40, paddingTop: 12, borderWidth: 0.5 },
  grab:        { width: 32, height: 3.5, borderRadius: 99, alignSelf: 'center', marginBottom: 20 },
  sheetHeader:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  sheetTitleRow:  { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sheetTitle:     { fontFamily: fontFamily.sansBold, fontSize: 20, letterSpacing: -0.4 },
  titleBadge:     { paddingHorizontal: 7, paddingVertical: 3, borderRadius: 8, borderWidth: 0.5 },
  titleBadgeText: { fontFamily: fontFamily.sansMd, fontSize: 9, letterSpacing: 1.5 },
  closeBtn:    { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  feeList:     { gap: 0, marginBottom: 24 },
  feeRow:      { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, borderBottomWidth: 0.5 },
  feeLabel:    { flex: 1, fontFamily: fontFamily.sansMd, fontSize: 13 },
  feeVal:      { fontFamily: fontFamily.sansMd, fontSize: 13, fontWeight: '600' },
  actionBtn:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
                 paddingVertical: 15, borderRadius: 14 },
  actionText:  { fontFamily: fontFamily.sansMd, fontSize: 14, fontWeight: '600', letterSpacing: 0.2 },

  stepper:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
                borderRadius: 18, borderWidth: 0.5, paddingHorizontal: 20, paddingVertical: 18, marginBottom: 14 },
  stepBtn:    { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  stepCenter: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  stepAmt:    { fontFamily: fontFamily.sansBold, fontSize: 36, letterSpacing: -1.5 },
  stepUnit:   { fontFamily: fontFamily.sansMd, fontSize: 14, letterSpacing: 0.5, marginBottom: 2 },

  impactBox:      { borderRadius: 14, borderWidth: 0.5, overflow: 'hidden', marginBottom: 20 },
  impactRow:      { flexDirection: 'row', alignItems: 'center', gap: 8,
                    paddingHorizontal: 14, paddingVertical: 14, borderBottomWidth: 0.5 },
  impactRowLabel: { flex: 1, fontFamily: fontFamily.sansMd, fontSize: 13 },
  impactRowBefore:{ fontFamily: fontFamily.sansMd, fontSize: 13 },
  impactRowAfter: { fontFamily: fontFamily.sansMd, fontSize: 13, fontWeight: '600' },
});

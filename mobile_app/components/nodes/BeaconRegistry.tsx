import React, { memo, useState, useRef, useCallback } from 'react';
import { Animated, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { fontFamily, useTheme } from '@/theme';
import { useGlass } from '@/hooks/useGlass';
import { Pill } from '@/components/ui/Pill';
import { SolanaIcon } from '@/components/onboarding/SolanaIcon';
import { isPeerReachable, useLxmfContext } from '@/context/LxmfContext';
import { useNetworkMode } from '@/src/hooks/useNetworkMode';


interface Props {
  readonly initialActive?: boolean;
  readonly style?: import('react-native').ViewStyle;
}

export const BeaconRegistry = memo(function BeaconRegistry({ initialActive: _initialActive = false, style }: Props) {
  const { colors } = useTheme();
  const glass     = useGlass();
  const softGlass = useGlass('soft');
  const { isBeacon, setBeaconMode, peers } = useLxmfContext();
  const { mode: networkMode } = useNetworkMode();
  // peers already includes beacon-nodes via mergeBeacon() in LxmfContext —
  // counting lxmf.beacons separately would double-count them (QA-55).
  // isPeerReachable, not p.online: the disclaimer below promises this count is
  // real, and a stale hub announce is not reachable without an internet route.
  const reachableCount = peers.filter(p => isPeerReachable(p, networkMode)).length;
  const hasInternet = networkMode === 'online';

  const active          = isBeacon;
  // Co-sign count and earned SOL are not wired to real data yet — show zeros
  // under the PREVIEW label so users aren't misled by illustrative numbers.
  const cosigns = 0;
  const earned  = 0;
  const [modal, setModal]         = useState(false);
  const sheetAnim         = useRef(new Animated.Value(0)).current;

  // Auto-activate on first internet was removed per AUDIT T10 / ROADMAP § 0.B.3:
  // beacon mode carries trust implications (relaying others' traffic) so the
  // user has to opt in via the Register-as-Beacon control. hasInternet is still
  // consumed for UI affordances.
  void hasInternet;

  const openModal = useCallback(() => {
    setModal(true);
    Animated.spring(sheetAnim, { toValue: 1, useNativeDriver: true, bounciness: 4 }).start();
  }, [sheetAnim]);

  const dismiss = useCallback(() => {
    Animated.timing(sheetAnim, { toValue: 0, duration: 220, useNativeDriver: true })
      .start(() => setModal(false));
  }, [sheetAnim]);

  const handleRegister = useCallback(() => {
    setBeaconMode(true);
    dismiss();
  }, [setBeaconMode, dismiss]);

  const sheetY      = sheetAnim.interpolate({ inputRange: [0, 1], outputRange: [500, 0], extrapolate: 'clamp' });
  const overlayOp   = sheetAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 1],   extrapolate: 'clamp' });

  // These values are not live — show placeholder dashes under PREVIEW label.
  const jitoAmt  = '—';
  const yieldAmt = '—';
  const repScore = '—';

  return (
    <>
      <View style={[S.wrap, style]}>
        <View style={S.labelRow}>
          <Text accessibilityRole="header" style={[S.sectionLabel, { color: colors.textTertiary }]}>BEACON REGISTRY</Text>
          <View style={S.pillRow}>
            <Pill label="PREVIEW" variant="default" />
            <Pill label={active ? 'ACTIVE' : 'INACTIVE'} variant={active ? 'primary' : 'default'} dot={active} />
          </View>
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
                  {/* Staking isn't live yet. A dimmed-out fake button read as
                      broken; the canonical PREVIEW/SOON Pill reads as an
                      intentional roadmap marker instead. No handler — there's
                      nothing real to wire to. */}
                  <Pill label="SOON" variant="default" style={S.stakePill} />
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

              <Text style={[S.previewNote, { color: colors.textTertiary, borderTopColor: colors.borderSubtle }]}>
                Preview — co-sign rewards, staking, and yield are not live yet; the figures above are illustrative. Reachable-peer count is real.
              </Text>
            </>
          ) : (
            <>
              <Text style={[S.desc, { color: colors.textSecondary }]}>
                Relay traffic across the mesh and help route messages to peers. Co-sign earnings and staking are coming in a future update.
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
                { icon: 'radio'       as const, label: 'Relay mesh traffic',       value: 'enabled',            dim: false },
                { icon: 'lock'        as const, label: 'Staking (coming soon)',    value: 'preview',            dim: true  },
                { icon: 'trending-up' as const, label: 'Co-sign earnings',         value: 'coming soon',        dim: true  },
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
              <Text style={[S.actionText, { color: '#08080A' }]}>Enable Beacon Mode</Text>
            </Pressable>
          </Animated.View>
        </View>
      </Modal>
    </>
  );
});

const S = StyleSheet.create({
  wrap:        { paddingHorizontal: 20, marginTop: 16, marginBottom: 16 },
  labelRow:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  pillRow:     { flexDirection: 'row', alignItems: 'center', gap: 6 },
  sectionLabel:{ fontFamily: fontFamily.sansMd, fontSize: 10, letterSpacing: 2, textTransform: 'uppercase' },

  card:        { borderRadius: 18, overflow: 'hidden', borderWidth: 0.5 },
  accentBar:   { height: 2 },

  hero:        { alignItems: 'center', paddingVertical: 28, gap: 6 },
  heroAmt:     { flexDirection: 'row', alignItems: 'center', gap: 5 },
  heroNum:     { fontFamily: fontFamily.sansBold, fontSize: 28, letterSpacing: -1 },
  heroLabel:   { fontFamily: fontFamily.sansMd, fontSize: 10, letterSpacing: 2.5, textTransform: 'uppercase' },

  repRow:      { flexDirection: 'row', borderTopWidth: 0.5, borderBottomWidth: 0.5, paddingVertical: 14 },
  repCell:     { flex: 1, alignItems: 'center', gap: 4 },
  repNum:      { fontFamily: fontFamily.sansBold, fontSize: 16, letterSpacing: -0.5 },
  repLabel:    { fontFamily: fontFamily.sansMd, fontSize: 9, letterSpacing: 2, textTransform: 'uppercase' },
  repDivider:  { width: 0.5, marginVertical: 4 },
  stakePill:   { marginTop: 2 },

  footer:      { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingVertical: 12 },
  footerStat:  { fontFamily: fontFamily.sansMd, fontSize: 12 },
  footerNum:   { fontFamily: fontFamily.sansBold, fontSize: 14 },
  footerDot:   { width: 3, height: 3, borderRadius: 2 },
  previewNote: { fontFamily: fontFamily.sansMd, fontSize: 10.5, lineHeight: 15, paddingHorizontal: 16, paddingBottom: 14, paddingTop: 12, borderTopWidth: 0.5 },

  desc:        { fontFamily: fontFamily.sansMd, fontSize: 12.5, lineHeight: 19, padding: 18, paddingBottom: 14 },
  regBtn:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7,
                 margin: 14, marginTop: 0, paddingVertical: 14, borderRadius: 13 },
  regText:     { fontFamily: fontFamily.sansMd, fontSize: 13, fontWeight: '600', letterSpacing: 0.3 },

  sheet:       { position: 'absolute', bottom: 0, left: 0, right: 0,
                 borderTopLeftRadius: 22, borderTopRightRadius: 22,
                 paddingHorizontal: 20, paddingBottom: 40, paddingTop: 12, borderWidth: 0.5 },
  grab:        { width: 32, height: 3.5, borderRadius: 99, alignSelf: 'center', marginBottom: 20 },
  sheetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  sheetTitle:  { fontFamily: fontFamily.sansBold, fontSize: 20, letterSpacing: -0.4 },
  closeBtn:    { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  feeList:     { gap: 0, marginBottom: 24 },
  feeRow:      { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, borderBottomWidth: 0.5 },
  feeLabel:    { flex: 1, fontFamily: fontFamily.sansMd, fontSize: 13 },
  feeVal:      { fontFamily: fontFamily.sansMd, fontSize: 13, fontWeight: '600' },
  actionBtn:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
                 paddingVertical: 15, borderRadius: 14 },
  actionText:  { fontFamily: fontFamily.sansMd, fontSize: 14, fontWeight: '600', letterSpacing: 0.2 },
});

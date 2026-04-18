import React, { memo, useState } from 'react';
import { View, Text, Pressable, Modal, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { fontFamily, useTheme } from '@/theme';
import { useGlass } from '@/hooks/useGlass';
import { Pill } from '@/components/ui/Pill';

const ACTIVE_BEACONS = 3;
const STAKE_SOL     = '0.5';
const NETWORK_FEE   = '~0.000005';

interface Props {
  readonly initialActive?: boolean;
}

export const BeaconRegistry = memo(function BeaconRegistry({ initialActive = false }: Props) {
  const { colors } = useTheme();
  const glass      = useGlass();
  const softGlass  = useGlass('soft');
  const accentGlass = useGlass('accent');

  const [active,    setActive]    = useState(initialActive);
  const [modal,     setModal]     = useState(false);
  const [cosigns,   setCosigns]   = useState(0);
  const [earned,    setEarned]    = useState(0);

  return (
    <>
      <View style={S.wrap}>
        <View style={S.labelRow}>
          <Text style={[S.sectionLabel, { color: colors.textTertiary }]}>BEACON REGISTRY</Text>
          <Pill label={active ? 'ACTIVE BEACON' : 'INACTIVE'} variant={active ? 'success' : 'default'} dot={active} />
        </View>

        <View style={[S.card, glass]}>
          {/* Network stats row */}
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
                  <Text style={[S.statVal, { color: colors.primary }]}>{cosigns}</Text>
                  <Text style={[S.statKey, { color: colors.textTertiary }]}>CO-SIGNS</Text>
                </View>
              </>
            )}
          </View>

          {/* Description */}
          <Text style={[S.desc, { color: colors.textSecondary }]}>
            {active
              ? `Earning as beacon co-signer. Stake locked: ${STAKE_SOL} SOL. Accumulated: ${earned.toFixed(6)} SOL.`
              : 'Stake SOL to become a beacon node. Co-sign confidential transactions and earn fees from the network.'}
          </Text>

          {/* CTA */}
          {active ? (
            <Pressable
              onPress={() => setModal(true)}
              style={({ pressed }) => [S.deregBtn, pressed && { opacity: 0.7 }, { borderColor: colors.border }]}
            >
              <Feather name="radio" size={12} color={colors.textTertiary} />
              <Text style={[S.deregText, { color: colors.textTertiary }]}>DEREGISTER BEACON</Text>
            </Pressable>
          ) : (
            <Pressable
              onPress={() => setModal(true)}
              style={({ pressed }) => [S.regBtn, accentGlass, pressed && { opacity: 0.85 }]}
            >
              <Feather name="radio" size={13} color={colors.primary} />
              <Text style={[S.regText, { color: colors.primary }]}>REGISTER AS BEACON</Text>
            </Pressable>
          )}
        </View>
      </View>

      {/* Confirmation modal */}
      <Modal visible={modal} transparent animationType="fade" onRequestClose={() => setModal(false)}>
        <Pressable style={S.overlay} onPress={() => setModal(false)}>
          <Pressable style={[S.sheet, softGlass, { backgroundColor: colors.surface1 }]} onPress={() => {}}>
            <View style={[S.sheetHandle, { backgroundColor: colors.borderSubtle }]} />

            <View style={S.sheetHeader}>
              <Feather name="radio" size={18} color={active ? colors.textTertiary : colors.primary} />
              <Text style={[S.sheetTitle, { color: colors.textPrimary }]}>
                {active ? 'Deregister Beacon' : 'Register as Beacon'}
              </Text>
            </View>

            {!active && (
              <View style={[S.feeCard, { backgroundColor: colors.surface2, borderColor: colors.border }]}>
                <View style={S.feeRow}>
                  <Text style={[S.feeLabel, { color: colors.textSecondary }]}>Stake (locked)</Text>
                  <Text style={[S.feeVal,   { color: colors.textPrimary }]}>{STAKE_SOL} SOL</Text>
                </View>
                <View style={[S.feeDivider, { backgroundColor: colors.borderSubtle }]} />
                <View style={S.feeRow}>
                  <Text style={[S.feeLabel, { color: colors.textSecondary }]}>Network fee</Text>
                  <Text style={[S.feeVal,   { color: colors.textTertiary }]}>{NETWORK_FEE} SOL</Text>
                </View>
                <View style={[S.feeDivider, { backgroundColor: colors.borderSubtle }]} />
                <View style={S.feeRow}>
                  <Text style={[S.feeLabel, { color: colors.textSecondary }]}>Role</Text>
                  <Text style={[S.feeVal,   { color: colors.primary }]}>Confidential tx co-signer</Text>
                </View>
              </View>
            )}

            <Text style={[S.sheetDesc, { color: colors.textSecondary }]}>
              {active
                ? `Stake of ${STAKE_SOL} SOL will be returned to your wallet. You will stop receiving co-sign fees.`
                : `Your wallet will be charged ${STAKE_SOL} SOL as stake. Authenticate to confirm.`}
            </Text>

            <Pressable
              onPress={() => { setActive(a => !a); setModal(false); }}
              style={({ pressed }) => [
                S.signBtn,
                { backgroundColor: active ? colors.surface2 : colors.primary, opacity: pressed ? 0.85 : 1 },
              ]}
            >
              <Feather name="lock" size={13} color={active ? colors.textSecondary : '#08080A'} />
              <Text style={[S.signText, { color: active ? colors.textSecondary : '#08080A' }]}>
                {active ? 'CONFIRM DEREGISTER' : 'SIGN WITH BIOMETRICS'}
              </Text>
            </Pressable>

            <Pressable onPress={() => setModal(false)} style={S.cancelBtn}>
              <Text style={[S.cancelText, { color: colors.textTertiary }]}>CANCEL</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
});

const S = StyleSheet.create({
  wrap:        { paddingHorizontal: 20, marginTop: 20 },
  labelRow:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  sectionLabel:{ fontFamily: fontFamily.sansMd, fontSize: 10, letterSpacing: 2, textTransform: 'uppercase' },

  card:        { borderRadius: 16, overflow: 'hidden' },
  statsRow:    { flexDirection: 'row', borderBottomWidth: 0.5, paddingVertical: 14, paddingHorizontal: 16 },
  stat:        { flex: 1, alignItems: 'center', gap: 3 },
  statVal:     { fontFamily: fontFamily.sansMd, fontSize: 15, fontWeight: '600' },
  statKey:     { fontFamily: fontFamily.sansMd, fontSize: 8, letterSpacing: 2, textTransform: 'uppercase' },
  statDivider: { width: 0.5, marginVertical: 4 },

  desc:        { fontFamily: fontFamily.sansMd, fontSize: 11, lineHeight: 17, padding: 16, paddingTop: 12 },

  regBtn:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
                 margin: 12, marginTop: 0, padding: 12, borderRadius: 12 },
  regText:     { fontFamily: fontFamily.sansMd, fontSize: 10.5, fontWeight: '600', letterSpacing: 2, textTransform: 'uppercase' },

  deregBtn:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
                 margin: 12, marginTop: 0, padding: 11, borderRadius: 12, borderWidth: 0.5 },
  deregText:   { fontFamily: fontFamily.sansMd, fontSize: 10, letterSpacing: 2, textTransform: 'uppercase' },

  // Modal
  overlay:     { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  sheet:       { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 36 },
  sheetHandle: { width: 36, height: 3.5, borderRadius: 2, alignSelf: 'center', marginBottom: 20 },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 16 },
  sheetTitle:  { fontSize: 17, fontWeight: '600', letterSpacing: -0.3 },

  feeCard:     { borderRadius: 12, borderWidth: 0.5, marginBottom: 14, overflow: 'hidden' },
  feeRow:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 12 },
  feeDivider:  { height: 0.5, marginHorizontal: 12 },
  feeLabel:    { fontFamily: fontFamily.sansMd, fontSize: 12 },
  feeVal:      { fontFamily: fontFamily.sansMd, fontSize: 12, fontWeight: '600' },

  sheetDesc:   { fontFamily: fontFamily.sansMd, fontSize: 12, lineHeight: 18, marginBottom: 20 },
  signBtn:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
                 padding: 14, borderRadius: 14, marginBottom: 10 },
  signText:    { fontFamily: fontFamily.sansMd, fontSize: 11, fontWeight: '600', letterSpacing: 2, textTransform: 'uppercase' },
  cancelBtn:   { padding: 12, alignItems: 'center' },
  cancelText:  { fontFamily: fontFamily.sansMd, fontSize: 10.5, letterSpacing: 2, textTransform: 'uppercase' },
});

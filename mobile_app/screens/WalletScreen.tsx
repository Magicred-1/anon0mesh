import { Feather, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import React, { useCallback, useState } from 'react';
import {
  Modal, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ActionRow, BalanceCard, RecentActivity } from '@/components/home';
import { ReceivePanel } from '@/components/wallet/ReceivePanel';
import { PendingCosigns, type PendingCosign } from '@/components/nodes/PendingCosigns';
import { useLxmfContext }   from '@/context/LxmfContext';
import { useWallet }        from '@/context/WalletContext';
import { useWalletBalance } from '@/src/hooks/useWalletBalance';
import { useNetworkMode }   from '@/src/hooks/useNetworkMode';
import { fontFamily, useTheme } from '@/theme';

export default function WalletScreen() {
  const { colors }    = useTheme();
  const { refetch }   = useWalletBalance();
  const { publicKey } = useWallet();
  const { peers }     = useLxmfContext();
  const { mode }      = useNetworkMode();
  const [refreshing, setRefreshing] = useState(false);
  const [showReceive, setShowReceive] = useState(false);

  // Multisig co-sign UI is in preview — items are visual placeholders only,
  // signing flow is not yet wired (see PendingCosigns: pointerEvents disabled).
  const pendingCosigns: PendingCosign[] = [
    { id: '1', txHash: 'A3f9c2e8b14d76a0f3c2e9b14d76a0f3c2e9b14d76a0f3c2e9b14d76a0f3',  amountSol: 0.25,  feeSol: 0.000312, fromHash: 'B7d2a1f4c9e8b3a7d2a1f4c9e8b3a7d2', requestedAt: Date.now() - 90_000 },
    { id: '2', txHash: 'C5e1d0b8a34f92c5e1d0b8a34f92c5e1d0b8a34f92c5e1d0b8a34f92c5e1', amountSol: 1.05,  feeSol: 0.000287, fromHash: 'D4b9c3e2a1f8d4b9c3e2a1f8d4b9c3e2', requestedAt: Date.now() - 240_000 },
    { id: '3', txHash: 'E8a7f6c4b2d0e8a7f6c4b2d0e8a7f6c4b2d0e8a7f6c4b2d0e8a7f6c4b2d0', amountSol: 0.005, feeSol: 0.000198, fromHash: 'F2c8a7e4b1d0f2c8a7e4b1d0f2c8a7e4', requestedAt: Date.now() - 15_000 },
  ];

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  const addr        = publicKey?.toBase58();
  const onlinePeers = peers.filter(p => p.online).length;
  const netColor    = mode === 'isolated' ? colors.error : colors.primary;
  let netLabel = 'OFFLINE';
  if (mode === 'online') netLabel = 'ONLINE';
  else if (mode === 'mesh') netLabel = 'MESH';

  return (
    <View style={[S.root, { backgroundColor: colors.background }]}>
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>

        {/* ── Header ── */}
        <View style={S.header}>
          <View>
            <Text style={[S.kicker,      { color: colors.textTertiary }]}>ANONMESH</Text>
            <Text style={[S.screenTitle, { color: colors.textPrimary  }]}>wallet</Text>
          </View>

          <View style={S.headerRight}>
            {/* Network chip */}
            <View style={[S.chip, { backgroundColor: colors.surface2, borderColor: colors.border }]}>
              {(mode === 'online' || mode === 'mesh')
                ? <MaterialCommunityIcons name="bird" size={12} color={netColor} />
                : <View style={[S.chipDot, { backgroundColor: netColor }]} />
              }
              <Text style={[S.chipText, { color: netColor }]}>{netLabel}</Text>
            </View>

            {/* Peers chip */}
            <View style={[S.chip, { backgroundColor: colors.surface2, borderColor: colors.border }]}>
              <Feather name="users" size={10} color={onlinePeers > 0 ? colors.primary : colors.textTertiary} />
              <Text style={[S.chipText, { color: onlinePeers > 0 ? colors.primary : colors.textTertiary }]}>
                {peers.length}
              </Text>
            </View>

            {/* QR button */}
            {addr && (
              <Pressable
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                  setShowReceive(true);
                }}
                accessibilityRole="button"
                accessibilityLabel="Show receive QR"
                style={({ pressed }) => [
                  S.qrBtn,
                  { backgroundColor: colors.surface2, borderColor: colors.border, opacity: pressed ? 0.7 : 1 },
                ]}
              >
                <Ionicons name="qr-code" size={16} color={colors.primary} />
              </Pressable>
            )}
          </View>
        </View>

        <ScrollView
          contentContainerStyle={S.scroll}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={colors.primary}
              colors={[colors.primary]}
              progressBackgroundColor={colors.surface2}
            />
          }
        >
          <BalanceCard />
          <ActionRow />
          <PendingCosigns items={pendingCosigns} />
          <RecentActivity />
        </ScrollView>
      </SafeAreaView>

      <Modal
        visible={showReceive}
        transparent
        animationType="slide"
        onRequestClose={() => setShowReceive(false)}
      >
        <Pressable style={S.modalBackdrop} onPress={() => setShowReceive(false)} />
        <View style={[S.modalSheet, { backgroundColor: colors.surface1 }]}>
          <View style={[S.modalHandle, { backgroundColor: colors.border }]} />
          <ReceivePanel />
        </View>
      </Modal>
    </View>
  );
}

// ── styles ────────────────────────────────────────────────────────────────────

const S = StyleSheet.create({
  root:   { flex: 1 },
  scroll: { paddingBottom: 24, gap: 10 },

  // header
  header:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 16, paddingBottom: 6 },
  kicker:      { fontFamily: fontFamily.sansMd, fontSize: 10, letterSpacing: 2, marginBottom: 2 },
  screenTitle: { fontFamily: fontFamily.sansSb, fontSize: 22, letterSpacing: -0.5 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  chip:        { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 9, paddingVertical: 6, borderRadius: 20, borderWidth: 0.5 },
  chipDot:     { width: 5, height: 5, borderRadius: 3 },
  chipText:    { fontFamily: fontFamily.sansMd, fontSize: 10, letterSpacing: 1 },
  qrBtn:       { width: 32, height: 32, borderRadius: 16, borderWidth: 0.5, alignItems: 'center', justifyContent: 'center' },

  // receive modal
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)' },
  modalSheet:    { borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingTop: 12, paddingBottom: 32 },
  modalHandle:   { width: 36, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 8 },
});

import { Feather, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator, Modal, Pressable, RefreshControl,
  ScrollView, StyleSheet, Text, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ReceivePanel } from '@/components/wallet/ReceivePanel';
import { TxDetailModal } from '@/components/wallet/TxDetailModal';
import { PendingCosigns, type PendingCosign } from '@/components/nodes/PendingCosigns';
import { useLxmfContext }   from '@/context/LxmfContext';
import { useWallet }        from '@/context/WalletContext';
import { useHideBalance }   from '@/src/hooks/useHideBalance';
import { useWalletBalance } from '@/src/hooks/useWalletBalance';
import { useNetworkMode }   from '@/src/hooks/useNetworkMode';
import type { ActivityEntry, TokenBalance } from '@/src/services/walletData';
import { fontFamily, useTheme } from '@/theme';
import { relTime } from '@/src/utils/relTime';

// ── helpers ───────────────────────────────────────────────────────────────────

const HIDDEN = '••••••';

function fmtSol(v: number) {
  if (v === 0) return '0';
  if (v < 0.001) return v.toFixed(6);
  if (v < 1)     return v.toFixed(4);
  if (v < 1000)  return v.toFixed(3);
  return v.toLocaleString('en-US', { maximumFractionDigits: 2 });
}

function fmtAmount(v: number, d: number) {
  if (v === 0) return '0';
  return v.toLocaleString('en-US', { maximumFractionDigits: Math.min(d, v < 1 ? 6 : 4) });
}

const TOKEN_COLOR: Record<string, string> = {
  SOL: '#14F195', USDC: '#2775CA', USDT: '#26A17B',
  JUP: '#C7F284', BONK: '#FFB020',
};

// ── tiles ─────────────────────────────────────────────────────────────────────

function BalanceTile({ hidden, toggle }: { readonly hidden: boolean; readonly toggle: () => void }) {
  const { colors } = useTheme();
  const { isConnected, publicKey } = useWallet();
  const { solBalance, tokens, loading, lastFetched, refetch, balanceStale } = useWalletBalance();

  const hasWallet   = isConnected && Boolean(publicKey);
  const initialLoad = hasWallet && solBalance === null && lastFetched === null;
  const splTokens   = tokens.filter((t: TokenBalance) => t.symbol !== 'SOL');

  let solText: string;
  if (hidden)                   solText = HIDDEN;
  else if (solBalance === null) solText = '—';
  else                          solText = fmtSol(solBalance);

  return (
    <View style={[S.tile, S.balanceTile, { backgroundColor: colors.surface2, borderColor: colors.border }]}>
      <View style={[S.accentBar, { backgroundColor: colors.primary }]} />
      <View style={S.tileHeaderRow}>
        <Text accessibilityRole="header" style={[S.tileLabel, { color: colors.textTertiary }]}>TOTAL BALANCE</Text>
        <View style={S.tileHeaderRight}>
          {loading && !initialLoad && <ActivityIndicator size="small" color={colors.textTertiary} />}
          <Pressable
            onPress={toggle}
            hitSlop={16}
            accessibilityRole="button"
            accessibilityLabel={hidden ? 'Show balance' : 'Hide balance'}
            accessibilityState={{ checked: hidden }}
            style={({ pressed }) => [S.headerIconBtn, pressed && { opacity: 0.55 }]}
          >
            <Feather name={hidden ? 'eye-off' : 'eye'} size={18} color={colors.textSecondary} />
          </Pressable>
          <Pressable
            onPress={refetch}
            hitSlop={16}
            accessibilityRole="button"
            accessibilityLabel="Refresh balance"
            disabled={loading}
            style={({ pressed }) => [S.headerIconBtn, (pressed || loading) && { opacity: 0.55 }]}
          >
            <Feather name="refresh-cw" size={18} color={colors.textSecondary} />
          </Pressable>
        </View>
      </View>
      <View style={S.amountRow}>
        {initialLoad
          ? <ActivityIndicator color={colors.primary} />
          : <Text numberOfLines={1} adjustsFontSizeToFit style={[S.bigNum, { color: colors.textPrimary }]}>{solText}</Text>
        }
        <Text style={[S.unit, { color: colors.primary }]}>SOL</Text>
      </View>
      {balanceStale && !hidden && solBalance !== null && (
        <Text style={{ fontSize: 11, letterSpacing: 0.3, marginTop: 6, color: colors.error }}>
          Balance may be stale — showing last known
        </Text>
      )}
      {splTokens.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={S.splStrip}>
          {splTokens.map((t: TokenBalance) => {
            const c = TOKEN_COLOR[t.symbol] ?? colors.textSecondary;
            return (
              <View key={t.mintAddress ?? t.symbol} style={[S.splChip, { backgroundColor: c + '18', borderColor: c + '40' }]}>
                <View style={[S.splDot, { backgroundColor: c }]} />
                <Text style={[S.splSymbol, { color: c }]}>{t.symbol}</Text>
                <Text style={[S.splAmount, { color: colors.textSecondary }]}>
                  {hidden ? '•••' : fmtAmount(t.uiAmount, t.maxDecimals)}
                </Text>
              </View>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
}

const ACTIONS = [
  { id: 'send',    label: 'Send',    icon: 'arrow-up-right'  as const, primary: true,  route: '/send/recipient' },
  { id: 'receive', label: 'Receive', icon: 'arrow-down-left' as const, primary: false, route: '/receive' },
  { id: 'swap',    label: 'Swap',    icon: 'refresh-cw'      as const, primary: false, soon: true },
  { id: 'yield',   label: 'Yield',   icon: 'trending-up'     as const, primary: false, soon: true },
] as const;

function ActionTiles() {
  const { colors } = useTheme();
  const router = useRouter();
  // Gate the Send tile at render-time so isolated-mode users can't walk three
  // screens deep before the confirm-step error tells them no RPC route exists.
  // ROADMAP § 2.4 / 02-UX P0 #6.
  const { mode } = useNetworkMode();
  const isolated = mode === 'isolated';

  return (
    <View style={S.actionRow}>
      {ACTIONS.map(a => {
        const soon = 'soon' in a && a.soon;
        const sendDisabled = a.id === 'send' && isolated;
        const disabled = soon || sendDisabled;
        return (
          <Pressable
            key={a.id}
            disabled={disabled}
            onPress={() => {
              if (!('route' in a)) return;
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
              router.push(a.route as never);
            }}
            style={({ pressed }) => {
              const pressedOpacity = pressed ? 0.7 : 1;
              const opacity = disabled ? 0.4 : pressedOpacity;
              return [S.tile, S.actionTile, {
                backgroundColor: a.primary ? colors.primary : colors.surface2,
                borderColor:     a.primary ? colors.primary : colors.border,
                opacity,
              }];
            }}
          >
            <View style={[S.actionIconWrap, { backgroundColor: a.primary ? 'rgba(0,0,0,0.15)' : colors.primarySubtle }]}>
              <Feather name={a.icon} size={18} color={a.primary ? '#08080A' : colors.primary} />
            </View>
            <Text style={[S.actionLabel, { color: a.primary ? '#08080A' : colors.textSecondary }]}>
              {a.label}
            </Text>
            {soon && (
              <Text style={[S.soonBadge, { color: colors.textTertiary }]}>SOON</Text>
            )}
            {sendDisabled && (
              <Text style={[S.soonBadge, { color: a.primary ? '#08080A' : colors.textTertiary }]}>
                NO ROUTE
              </Text>
            )}
          </Pressable>
        );
      })}
    </View>
  );
}

function ActivityTile({ refreshing, onRefresh }: { readonly refreshing: boolean; readonly onRefresh: () => void }) {
  const { colors } = useTheme();
  const { hidden } = useHideBalance();
  const { activity, activityLoading, activityError, lastFetched } = useWalletBalance();
  const [selectedTx, setSelectedTx] = useState<ActivityEntry | null>(null);
  const initialLoad = activityLoading && lastFetched === null;

  return (
    <View style={[S.tile, S.activityTile, { backgroundColor: colors.surface2, borderColor: colors.border }]}>
      <Text accessibilityRole="header" style={[S.tileLabel, { color: colors.textTertiary, marginBottom: 14 }]}>RECENT ACTIVITY</Text>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={S.activityScroll}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
            progressBackgroundColor={colors.surface2}
          />
        }
      >
        {initialLoad && (
          <View style={S.center}><ActivityIndicator color={colors.primary} size="small" /></View>
        )}
        {!initialLoad && activityError && (
          <View style={S.center}>
            <Feather name="wifi-off" size={20} color={colors.textTertiary} style={{ marginBottom: 6 }} />
            <Text style={[S.activityLabel, { color: colors.textPrimary, marginBottom: 4 }]}>
              Couldn&apos;t load activity
            </Text>
            <Text style={[S.activityTime, { color: colors.textTertiary, textAlign: 'center', marginBottom: 12 }]} numberOfLines={2}>
              {activityError}
            </Text>
            <Pressable
              onPress={onRefresh}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel="Retry loading activity"
              style={({ pressed }) => [
                S.retryBtn,
                { borderColor: colors.border, backgroundColor: colors.surface1 },
                pressed && { opacity: 0.7 },
              ]}
            >
              <Feather name="refresh-cw" size={12} color={colors.textPrimary} />
              <Text style={[S.activityTime, { color: colors.textPrimary, fontWeight: '600' }]}>Try again</Text>
            </Pressable>
          </View>
        )}
        {!initialLoad && !activityError && activity.length === 0 && (
          <View style={S.center}>
            <MaterialCommunityIcons name="bird" size={26} color={colors.textTertiary} style={{ marginBottom: 6 }} />
            <Text style={[S.activityLabel, { color: colors.textPrimary, marginBottom: 4 }]}>
              No transactions yet
            </Text>
            <Text style={[S.activityTime, { color: colors.textTertiary, textAlign: 'center' }]}>
              Tap Receive above to share your address.
            </Text>
          </View>
        )}
        {!initialLoad && activity.map((tx, i) => {
          const out    = tx.direction === 'send';
          const color  = out ? '#FF6B6B' : '#14F195';
          const sign   = out ? '−' : '+';
          const amount = hidden ? '•••' : `${sign}${fmtAmount(tx.amountSol, tx.decimals)}`;
          const fallback = out ? 'Sent' : 'Received';
          const label  = tx.counterparty
            ? `${tx.counterparty.slice(0, 4)}…${tx.counterparty.slice(-4)}`
            : fallback;
          return (
            <Pressable
              key={tx.signature}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                setSelectedTx(tx);
              }}
              style={({ pressed }) => [
                S.activityRow,
                i < activity.length - 1 && { borderBottomWidth: 0.5, borderBottomColor: colors.borderSubtle },
                pressed && { opacity: 0.6 },
              ]}
              accessibilityRole="button"
              accessibilityLabel={
                hidden
                  ? `${out ? 'Sent' : 'Received'} transaction, amount hidden. Tap for transaction details.`
                  : `${out ? 'Sent' : 'Received'} ${fmtAmount(tx.amountSol, tx.decimals)} ${tx.symbol}. Tap for transaction details.`
              }
            >
              <View style={[S.activityIconWrap, { backgroundColor: color + '18' }]}>
                <Feather name={out ? 'arrow-up-right' : 'arrow-down-left'} size={14} color={color} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[S.activityLabel, { color: colors.textPrimary }]} numberOfLines={1}>{label}</Text>
                <Text style={[S.activityTime,  { color: colors.textTertiary }]}>{relTime(tx.createdAt)}</Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={[S.activityAmount, { color }]}>{amount}</Text>
                <Text style={[S.activityTime, { color: colors.textTertiary }]}>{tx.symbol}</Text>
              </View>
            </Pressable>
          );
        })}
      </ScrollView>
      <TxDetailModal
        tx={selectedTx}
        visible={selectedTx !== null}
        onClose={() => setSelectedTx(null)}
      />
    </View>
  );
}

// ── screen ────────────────────────────────────────────────────────────────────

export default function WalletScreen() {
  const { colors }         = useTheme();
  const { hidden, toggle } = useHideBalance();
  const { refetch }        = useWalletBalance();
  const { publicKey }      = useWallet();
  const { peers }          = useLxmfContext();
  const { mode }           = useNetworkMode();
  const [refreshing, setRefreshing] = useState(false);
  const [showReceive, setShowReceive] = useState(false);
  // Multisig co-sign data source not yet wired — render honest empty state
  // until the real co-sign feed exists (see PendingCosigns component).
  const pendingCosigns: PendingCosign[] = [];

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
        <View style={S.grid}>

          {/* ── Header ── */}
          <View style={S.header}>
            <View>
              <Text accessibilityRole="header" style={[S.kicker,      { color: colors.textTertiary }]}>ANONMESH</Text>
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

          <BalanceTile hidden={hidden} toggle={toggle} />
          <ActionTiles />
          <PendingCosigns items={pendingCosigns} />
          <ActivityTile refreshing={refreshing} onRefresh={handleRefresh} />

        </View>
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

const GAP = 10;

const S = StyleSheet.create({
  root:  { flex: 1 },
  grid:  { flex: 1, paddingHorizontal: 16, paddingTop: 0, gap: GAP, paddingBottom: 16 },

  // header
  header:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 16, paddingBottom: 6 },
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

  tile:      { borderRadius: 18, borderWidth: 0.5, padding: 16, overflow: 'hidden' },
  accentBar: { position: 'absolute', top: 0, left: 0, right: 0, height: 2, borderTopLeftRadius: 18, borderTopRightRadius: 18 },

  // balance
  balanceTile:     { gap: 10 },
  tileHeaderRow:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  tileHeaderRight: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  headerIconBtn:   { padding: 4, alignItems: 'center', justifyContent: 'center' },
  tileLabel:       { fontFamily: fontFamily.sansMd, fontSize: 9.5, letterSpacing: 2, textTransform: 'uppercase' },
  amountRow:       { flexDirection: 'row', alignItems: 'flex-end', gap: 6 },
  bigNum:          { fontFamily: fontFamily.sansBold, fontSize: 52, letterSpacing: -2, lineHeight: 56, flex: 1 },
  unit:            { fontFamily: fontFamily.sansMd, fontSize: 14, letterSpacing: 1, marginBottom: 10 },
  splStrip:        { gap: 8, paddingVertical: 2 },
  splChip:         { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 20, borderWidth: 0.5 },
  splDot:          { width: 6, height: 6, borderRadius: 3 },
  splSymbol:       { fontFamily: fontFamily.sansMd, fontSize: 10, letterSpacing: 1.5, textTransform: 'uppercase' },
  splAmount:       { fontFamily: fontFamily.sansMd, fontSize: 11 },

  // actions
  actionRow:      { flexDirection: 'row', gap: GAP },
  actionTile:     { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 20 },
  actionIconWrap: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  actionLabel:    { fontFamily: fontFamily.sansMd, fontSize: 10, letterSpacing: 1 },
  soonBadge:      { fontFamily: fontFamily.sansMd, fontSize: 8, letterSpacing: 1.5, textTransform: 'uppercase' },

  // activity
  activityTile:    { flex: 1 },
  activityScroll:  { flexGrow: 1 },
  center:          { paddingVertical: 24, alignItems: 'center', gap: 4 },
  retryBtn:        { flexDirection: 'row', alignItems: 'center', gap: 6,
                     paddingHorizontal: 12, paddingVertical: 7, borderRadius: 10, borderWidth: 0.5 },
  activityRow:     { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 11 },
  activityIconWrap:{ width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  activityLabel:   { fontFamily: fontFamily.sansMd, fontSize: 12, marginBottom: 2 },
  activityTime:    { fontFamily: fontFamily.sansMd, fontSize: 10 },
  activityAmount:  { fontFamily: fontFamily.sansSb, fontSize: 13 },
});

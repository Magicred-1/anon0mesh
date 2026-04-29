import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator, Animated, Pressable, RefreshControl,
  ScrollView, StyleSheet, Text, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Circle, Ellipse, Path } from 'react-native-svg';

import { useLxmfContext } from '@/context/LxmfContext';
import { useWallet }      from '@/context/WalletContext';
import { useHideBalance } from '@/src/hooks/useHideBalance';
import { useWalletBalance } from '@/src/hooks/useWalletBalance';
import { useNetworkMode }  from '@/src/hooks/useNetworkMode';
import type { TokenBalance } from '@/src/services/walletData';
import { fontFamily, useTheme } from '@/theme';

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

function relTime(ms: number) {
  const d = Date.now() - ms;
  if (d < 60_000)     return 'just now';
  if (d < 3_600_000)  return `${Math.floor(d / 60_000)}m ago`;
  if (d < 86_400_000) return `${Math.floor(d / 3_600_000)}h ago`;
  return `${Math.floor(d / 86_400_000)}d ago`;
}

const NET_CFG = {
  online:   { label: 'ONLINE',      icon: 'wifi'     as const, color: '#00E5FF' },
  mesh:     { label: 'MESH RELAY',  icon: 'radio'    as const, color: '#00E5FF' },
  isolated: { label: 'ISOLATED',    icon: 'wifi-off' as const, color: '#FF4444' },
};

// ── pigeon ────────────────────────────────────────────────────────────────────

function PigeonIcon() {
  const float   = useRef(new Animated.Value(0)).current;
  const flap    = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(float, { toValue: -3, duration: 1400, useNativeDriver: true }),
        Animated.timing(float, { toValue:  0, duration: 1400, useNativeDriver: true }),
      ]),
    ).start();
    Animated.loop(
      Animated.sequence([
        Animated.timing(flap, { toValue: 0.35, duration: 320, useNativeDriver: true }),
        Animated.timing(flap, { toValue: 1,    duration: 320, useNativeDriver: true }),
      ]),
    ).start();
    return () => { float.stopAnimation(); flap.stopAnimation(); };
  }, [float, flap]);

  return (
    <Animated.View style={{ transform: [{ translateY: float }] }}>
      <View style={{ width: 28, height: 22 }}>
        {/* static body parts */}
        <Svg width={28} height={22} viewBox="0 0 26 20" style={{ position: 'absolute' }}>
          <Path d="M13 12 C9 15, 4 14, 2 11 C5 11, 9 12, 13 13Z" fill="#006880" />
          <Ellipse cx={12} cy={13} rx={5} ry={3} fill="#00c8e0" />
          <Ellipse cx={16.5} cy={11} rx={2.5} ry={2} fill="#00d4f0" />
          <Circle cx={18.5} cy={9.5} r={2.8} fill="#00c8e0" />
          <Circle cx={19.5} cy={8.8} r={0.9} fill="#001a22" />
          <Circle cx={19.8} cy={8.6} r={0.35} fill="#00e5ff" />
          <Path d="M21 9.5 L24.5 9 L21 8.5Z" fill="#00aac0" />
          <Path d="M7 14 L3 17.5 L5.5 14.5 L4 18.5 L7 15 L6.5 19 L8.5 15Z" fill="#00aac0" opacity={0.85} />
        </Svg>
        {/* flapping wing — scaleY on wrapper View */}
        <Animated.View style={{ position: 'absolute', width: 28, height: 22, transform: [{ scaleY: flap }] }}>
          <Svg width={28} height={22} viewBox="0 0 26 20">
            <Path d="M13 11 C10 6, 4 5, 2 9 C6 8, 10 10, 13 12Z" fill="#00e5ff" />
          </Svg>
        </Animated.View>
      </View>
    </Animated.View>
  );
}

// ── tiles ─────────────────────────────────────────────────────────────────────

function BalanceTile({ hidden, toggle }: { readonly hidden: boolean; readonly toggle: () => void }) {
  const { colors } = useTheme();
  const { isConnected, publicKey } = useWallet();
  const { solBalance, tokens, loading, lastFetched, refetch } = useWalletBalance();

  const hasWallet   = isConnected && Boolean(publicKey);
  const initialLoad = hasWallet && solBalance === null && lastFetched === null;
  const splTokens   = tokens.filter((t: TokenBalance) => t.symbol !== 'SOL');
  let solText: string;
  if (hidden)              solText = HIDDEN;
  else if (solBalance === null) solText = '—';
  else                     solText = fmtSol(solBalance);

  return (
    <View style={[S.tile, S.balanceTile, { backgroundColor: colors.surface1, borderColor: colors.borderStrong }]}>
      <View style={S.tileHeaderRow}>
        <Text style={[S.tileLabel, { color: colors.textTertiary }]}>TOTAL BALANCE</Text>
        <View style={S.tileHeaderRight}>
          {loading && !initialLoad && <ActivityIndicator size="small" color={colors.textTertiary} />}
          <Pressable onPress={toggle} hitSlop={8}>
            <Feather name={hidden ? 'eye-off' : 'eye'} size={14} color={colors.textTertiary} />
          </Pressable>
          <Pressable onPress={refetch} hitSlop={8}>
            <Feather name="refresh-cw" size={13} color={colors.textTertiary} />
          </Pressable>
        </View>
      </View>

      <View style={S.amountRow}>
        {initialLoad
          ? <ActivityIndicator color={colors.primary} />
          : (
            <Text numberOfLines={1} adjustsFontSizeToFit style={[S.bigNum, { color: colors.textPrimary }]}>
              {solText}
            </Text>
          )
        }
        <Text style={[S.unit, { color: colors.textTertiary }]}>SOL</Text>
      </View>

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

function NetworkTile() {
  const { colors } = useTheme();
  const { mode, adapter } = useNetworkMode();
  const cfg = NET_CFG[mode];
  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (mode === 'online') { pulse.setValue(1); return; }
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(pulse, { toValue: 0.25, duration: 900, useNativeDriver: true }),
      Animated.timing(pulse, { toValue: 1,    duration: 900, useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [mode, pulse]);

  return (
    <View style={[S.tile, S.halfTile, { backgroundColor: colors.surface1, borderColor: colors.border }]}>
      <Text style={[S.tileLabel, { color: colors.textTertiary }]}>NETWORK</Text>
      <View style={S.statIconRow}>
        {mode === 'online' ? (
          <PigeonIcon />
        ) : (
          <>
            <Animated.View style={[S.netDot, { backgroundColor: cfg.color, opacity: pulse }]} />
            <Feather name={cfg.icon} size={20} color={cfg.color} />
          </>
        )}
      </View>
      <Text style={[S.halfValue, { color: cfg.color }]}>{cfg.label}</Text>
      {mode === 'mesh' && adapter.relayHash
        ? <Text style={[S.tileLabel, { color: colors.textTertiary, marginTop: 2 }]}>
            via {adapter.relayHash.slice(0, 8)}
          </Text>
        : null
      }
    </View>
  );
}

function PeersTile() {
  const { colors } = useTheme();
  const { peers } = useLxmfContext();
  const total  = peers.length;
  const online = peers.filter(p => p.online).length;
  const active = online > 0;

  return (
    <View style={[S.tile, S.halfTile, { backgroundColor: colors.surface1, borderColor: colors.border }]}>
      <Text style={[S.tileLabel, { color: colors.textTertiary }]}>PEERS</Text>
      <View style={S.statIconRow}>
        <Feather name="users" size={20} color={active ? colors.primary : colors.textTertiary} />
      </View>
      <Text style={[S.halfValue, { color: active ? colors.primary : colors.textTertiary }]}>{total}</Text>
      <Text style={[S.tileLabel, { color: colors.textTertiary, marginTop: 2 }]}>
        {online} reachable(s)
      </Text>
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

  return (
    <View style={S.actionRow}>
      {ACTIONS.map(a => (
        <Pressable
          key={a.id}
          disabled={'soon' in a && a.soon}
          onPress={() => {
            if (!('route' in a)) return;
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
            router.push(a.route as never);
          }}
          style={({ pressed }) => [
            S.tile,
            S.actionTile,
            {
              backgroundColor: a.primary ? colors.primary : colors.surface1,
              borderColor:     a.primary ? colors.borderStrong : colors.border,
              opacity:         ('soon' in a && a.soon) ? 0.45 : pressed ? 0.7 : 1,
            },
          ]}
        >
          <Feather name={a.icon} size={20} color={a.primary ? '#08080A' : colors.primary} />
          <Text style={[S.actionLabel, { color: a.primary ? '#08080A' : colors.textSecondary }]}>
            {a.label}
          </Text>
          {'soon' in a && a.soon && (
            <Text style={[S.soonBadge, { color: colors.textTertiary }]}>SOON</Text>
          )}
        </Pressable>
      ))}
    </View>
  );
}

function ActivityTile({ refreshing, onRefresh }: { readonly refreshing: boolean; readonly onRefresh: () => void }) {
  const { colors } = useTheme();
  const { hidden } = useHideBalance();
  const { activity, activityLoading, activityError, lastFetched } = useWalletBalance();
  const initialLoad = activityLoading && lastFetched === null;

  return (
    <View style={[S.tile, S.activityTile, { backgroundColor: colors.surface1, borderColor: colors.border }]}>
      <Text style={[S.tileLabel, { color: colors.textTertiary, marginBottom: 12 }]}>RECENT ACTIVITY</Text>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={S.activityScroll}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
            progressBackgroundColor={colors.surface1}
          />
        }
      >
        {initialLoad && <View style={S.center}><ActivityIndicator color={colors.primary} size="small" /></View>}
        {!initialLoad && activityError && <View style={S.center}><Text style={[S.tileLabel, { color: colors.textTertiary }]}>{activityError}</Text></View>}
        {!initialLoad && !activityError && activity.length === 0 && (
          <View style={S.center}><Text style={[S.tileLabel, { color: colors.textTertiary }]}>no activity yet</Text></View>
        )}
        {!initialLoad && activity.map((tx, i) => {
          const out    = tx.direction === 'send';
          const color  = out ? '#FF4444' : '#14F195';
          const sign   = out ? '−' : '+';
          const amount = hidden ? '•••' : `${sign}${tx.amountSol.toFixed(4)} SOL`;
          const fallback = out ? 'Sent' : 'Received';
          const label    = tx.counterparty
            ? `${tx.counterparty.slice(0, 4)}…${tx.counterparty.slice(-4)}`
            : fallback;
          return (
            <View
              key={tx.signature}
              style={[S.activityRow, i < activity.length - 1 && { borderBottomWidth: 0.5, borderBottomColor: colors.borderSubtle }]}
            >
              <View style={[S.activityIcon, { backgroundColor: color + '18' }]}>
                <Feather name={out ? 'arrow-up-right' : 'arrow-down-left'} size={13} color={color} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[S.activityLabel, { color: colors.textPrimary }]} numberOfLines={1}>{label}</Text>
                <Text style={[S.activityTime, { color: colors.textTertiary }]}>{relTime(tx.createdAt)}</Text>
              </View>
              <Text style={[S.activityAmount, { color }]}>{amount}</Text>
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

// ── screen ────────────────────────────────────────────────────────────────────

export default function WalletScreen() {
  const { colors } = useTheme();
  const { hidden, toggle } = useHideBalance();
  const { refetch } = useWalletBalance();
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  return (
    <View style={[S.root, { backgroundColor: colors.background }]}>
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <View style={S.grid}>
          <View style={S.header}>
            <View>
              <Text style={[S.kicker, { color: colors.textTertiary }]}>ANONMESH</Text>
              <Text style={[S.screenTitle, { color: colors.textPrimary }]}>wallet</Text>
            </View>
          </View>

          <BalanceTile hidden={hidden} toggle={toggle} />

          <View style={S.row}>
            <NetworkTile />
            <PeersTile />
          </View>

          <ActionTiles />
          <ActivityTile refreshing={refreshing} onRefresh={handleRefresh} />
        </View>
      </SafeAreaView>
    </View>
  );
}

// ── styles ────────────────────────────────────────────────────────────────────

const GAP = 10;

const S = StyleSheet.create({
  root:            { flex: 1 },
  grid:            { flex: 1, paddingHorizontal: 16, paddingTop: 0, gap: GAP, paddingBottom: 16 },
  header:          { flexDirection: 'row', alignItems: 'center', paddingTop: 16, paddingBottom: 6 },
  kicker:          { fontFamily: fontFamily.sansMd, fontSize: 10, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 2 },
  screenTitle:     { fontFamily: fontFamily.sansSb, fontSize: 22, letterSpacing: -0.5 },

  tile:            { borderRadius: 20, borderWidth: 0.5, padding: 16, overflow: 'hidden' },

  // balance
  balanceTile:     { gap: 10 },
  tileHeaderRow:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  tileHeaderRight: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  tileLabel:       { fontFamily: fontFamily.sansMd, fontSize: 9.5, letterSpacing: 2, textTransform: 'uppercase' },
  amountRow:       { flexDirection: 'row', alignItems: 'flex-end', gap: 6 },
  bigNum:          { fontFamily: fontFamily.sansBold, fontSize: 52, letterSpacing: -2, lineHeight: 56, flex: 1 },
  unit:            { fontFamily: fontFamily.sansMd, fontSize: 14, letterSpacing: 1, marginBottom: 10 },
  splStrip:        { gap: 8, paddingVertical: 2 },
  splChip:         { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 20, borderWidth: 0.5 },
  splDot:          { width: 6, height: 6, borderRadius: 3 },
  splSymbol:       { fontFamily: fontFamily.sansMd, fontSize: 10, letterSpacing: 1.5, textTransform: 'uppercase' },
  splAmount:       { fontFamily: fontFamily.sansMd, fontSize: 11 },

  // half tiles
  row:             { flexDirection: 'row', gap: GAP },
  halfTile:        { flex: 1, gap: 6, minHeight: 110 },
  statIconRow:     { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 },
  netDot:          { width: 7, height: 7, borderRadius: 4 },
  halfValue:       { fontFamily: fontFamily.sansBold, fontSize: 26, letterSpacing: -0.5 },

  // action tiles
  actionRow:       { flexDirection: 'row', gap: GAP },
  actionTile:      { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 18 },
  actionLabel:     { fontFamily: fontFamily.sansMd, fontSize: 10, letterSpacing: 1 },
  soonBadge:       { fontFamily: fontFamily.sansMd, fontSize: 8, letterSpacing: 1.5, textTransform: 'uppercase' },

  // activity
  activityTile:    { flex: 1 },
  activityScroll:  { flexGrow: 1 },
  center:          { paddingVertical: 20, alignItems: 'center' },
  activityRow:     { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10 },
  activityIcon:    { width: 30, height: 30, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  activityLabel:   { fontFamily: fontFamily.sansMd, fontSize: 12 },
  activityTime:    { fontFamily: fontFamily.sansMd, fontSize: 10, marginTop: 1 },
  activityAmount:  { fontFamily: fontFamily.sansSb, fontSize: 12 },
});

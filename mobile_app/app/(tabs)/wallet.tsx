import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, Pressable, ScrollView, StyleSheet,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '@/theme';
import { Pill } from '@/components/ui';

// ── useGlass ──────────────────────────────────────────────────────────────────

function useGlass(variant: 'base' | 'soft' | 'accent' | 'strong' = 'base') {
  const { colors } = useTheme();
  switch (variant) {
    case 'soft':   return { backgroundColor: colors.surface0,      borderWidth: 0.5 as const, borderColor: colors.borderSubtle };
    case 'accent': return { backgroundColor: colors.primarySubtle, borderWidth: 0.5 as const, borderColor: colors.primary + '40' };
    case 'strong': return { backgroundColor: colors.surface2,      borderWidth: 0.5 as const, borderColor: colors.borderStrong };
    default:       return { backgroundColor: colors.surface1,      borderWidth: 0.5 as const, borderColor: colors.border };
  }
}

// ── Data ──────────────────────────────────────────────────────────────────────

const ASSETS = [
  { sym: 'SOL',  name: 'Solana',     bal: '48.124',   usd: 9128.21, color: '#14F195', priv: true  },
  { sym: 'USDC', name: 'USDC (SPL)', bal: '2,184.50', usd: 2184.50, color: '#2775CA', priv: true  },
  { sym: 'JUP',  name: 'Jupiter',    bal: '1,420.00', usd: 612.60,  color: '#C7F284', priv: false },
  { sym: 'BONK', name: 'Bonk',       bal: '12.4M',    usd: 278.40,  color: '#FFB020', priv: false },
];

const TOTAL_USD = 12203.71;

const VAULTS = [
  { name: 'marinade liquid stake', asset: 'SOL',  apy: 7.24,  tvl: '$1.1B', risk: 'low',    color: '#14F195', deposited: '12.50'    },
  { name: 'kamino usdc lending',   asset: 'USDC', apy: 8.42,  tvl: '$420M', risk: 'low',    color: '#2775CA', deposited: '1,200.00' },
  { name: 'jito restaking',        asset: 'SOL',  apy: 9.18,  tvl: '$680M', risk: 'medium', color: '#14F195', deposited: undefined   },
  { name: 'drift usdc vault',      asset: 'USDC', apy: 12.88, tvl: '$88M',  risk: 'medium', color: '#2775CA', deposited: undefined   },
];

type Asset = typeof ASSETS[number];
type Tab   = 'send' | 'swap' | 'yield';

// ── AssetDot ──────────────────────────────────────────────────────────────────

function AssetDot({ asset, size = 28 }: { asset: Pick<Asset, 'sym' | 'color'>; size?: number }) {
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: asset.color, alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
      <Text style={{ fontFamily: 'monospace', fontSize: size * 0.32, fontWeight: '600', color: '#fff' }}>
        {asset.sym[0]}
      </Text>
    </View>
  );
}

// ── WalletTabs ────────────────────────────────────────────────────────────────

function WalletTabs({ tab, onTab }: { tab: Tab; onTab: (t: Tab) => void }) {
  const { colors } = useTheme();
  const softGlass = useGlass('soft');
  const TABS: { id: Tab; label: string }[] = [
    { id: 'send',  label: 'send'  },
    { id: 'swap',  label: 'swap'  },
    { id: 'yield', label: 'yield' },
  ];
  return (
    <View style={[S.tabBar, softGlass]}>
      {TABS.map(t => {
        const on = tab === t.id;
        return (
          <Pressable key={t.id} onPress={() => onTab(t.id)} style={[S.tabBtn, on && { backgroundColor: colors.primary }]}>
            <Text style={[S.tabLabel, { color: on ? '#08080A' : colors.textTertiary, fontWeight: on ? '600' : '500' }]}>
              {t.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

// ── SendPanel ─────────────────────────────────────────────────────────────────

function SendPanel() {
  const { colors } = useTheme();
  const glass      = useGlass();
  const softGlass  = useGlass('soft');
  const accentGlass = useGlass('accent');

  const [sel, setSel]           = useState(ASSETS[0]);
  const [recipient, setRecipient] = useState('@node_7f3a');
  const [amount, setAmount]     = useState('0.25');
  const [phase, setPhase]       = useState(0);

  useEffect(() => {
    if (phase === 0 || phase === 3) return;
    const t = setTimeout(() => setPhase(p => p + 1), 1100);
    return () => clearTimeout(t);
  }, [phase]);

  const statusLabel = ['ready', 'routing', 'sharding', 'confirmed'][phase];
  const usdValue = (parseFloat(amount || '0') * (sel.usd / parseFloat(sel.bal.replace(/,/g, '')))).toFixed(2);
  const progressLines = ['routing via 3 hops…', 'splitting signature across mpc…', 'broadcast confirmed.'];

  return (
    <View style={S.panel}>
      {/* Asset picker */}
      <View style={[S.card, glass]}>
        <Text style={[S.cardLabel, { color: colors.textTertiary }]}>FROM</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 10 }}>
          <View style={{ flexDirection: 'row', gap: 6 }}>
            {ASSETS.map(a => {
              const on = sel.sym === a.sym;
              return (
                <Pressable
                  key={a.sym}
                  onPress={() => setSel(a)}
                  style={[S.assetBtn, on && { backgroundColor: 'rgba(255,255,255,0.08)', borderColor: 'rgba(255,255,255,0.18)' }]}
                >
                  <AssetDot asset={a} size={22} />
                  <View>
                    <Text style={[S.assetSym, { color: colors.textPrimary }]}>{a.sym}</Text>
                    <Text style={[S.assetBal, { color: colors.textTertiary }]}>{a.bal}</Text>
                  </View>
                  {a.priv && <View style={[S.privDot, { backgroundColor: colors.primary }]} />}
                </Pressable>
              );
            })}
          </View>
        </ScrollView>
      </View>

      {/* Recipient */}
      <View style={[S.card, glass]}>
        <Text style={[S.cardLabel, { color: colors.textTertiary }]}>TO</Text>
        <View style={[S.row, { marginTop: 8 }]}>
          <Feather name="maximize" size={16} color={colors.textSecondary} />
          <TextInput
            style={[S.textField, { color: colors.textPrimary, flex: 1 }]}
            value={recipient}
            onChangeText={setRecipient}
            placeholder="mesh handle or hash"
            placeholderTextColor={colors.textTertiary}
            editable={phase === 0}
          />
          <Text style={[S.resolvedBadge, { color: colors.primary }]}>✓ RESOLVED</Text>
        </View>
      </View>

      {/* Amount */}
      <View style={[S.card, glass]}>
        <View style={S.amountHeader}>
          <Text style={[S.cardLabel, { color: colors.textTertiary }]}>AMOUNT</Text>
          <Pressable onPress={() => setAmount(sel.bal.replace(/,/g, ''))}>
            <Text style={[S.maxBtn, { color: colors.primary }]}>MAX · {sel.bal}</Text>
          </Pressable>
        </View>
        <View style={[S.row, { alignItems: 'baseline', gap: 10, marginTop: 4 }]}>
          <TextInput
            style={[S.amountInput, { color: colors.accent, flex: 1 }]}
            value={amount}
            onChangeText={setAmount}
            keyboardType="decimal-pad"
            editable={phase === 0}
          />
          <Text style={[S.amountSym, { color: colors.textSecondary }]}>{sel.sym}</Text>
        </View>
        <Text style={[S.usdHint, { color: colors.textTertiary }]}>≈ ${usdValue}</Text>
      </View>

      {/* Privacy meter */}
      <View style={[S.card, accentGlass, S.row, { alignItems: 'center', gap: 10 }]}>
        <Feather name="lock" size={14} color={colors.primary} />
        <View style={{ flex: 1 }}>
          <Text style={[S.privLabel, { color: colors.primary }]}>PRIVATE · MPC 3/3</Text>
          <Text style={{ fontSize: 11, color: colors.textSecondary, marginTop: 2 }}>amount + recipient hidden on-chain</Text>
        </View>
        <Pill
          label={statusLabel}
          variant={phase === 3 ? 'success' : phase === 0 ? 'default' : 'warning'}
          dot={phase !== 0}
        />
      </View>

      {/* Progress */}
      {phase > 0 && (
        <View style={[S.card, softGlass]}>
          {progressLines.map((line, i) => {
            const reached = phase > i + 1;
            const active  = phase === i + 1;
            return (
              <View key={i} style={S.progressLine}>
                <Text style={{ color: reached ? colors.primary : colors.textTertiary, width: 14, fontFamily: 'monospace' }}>
                  {reached ? '✓' : active ? '›' : '·'}
                </Text>
                <Text style={[S.progressText, { color: reached ? colors.textPrimary : active ? colors.textSecondary : colors.textTertiary }]}>
                  {line}
                </Text>
              </View>
            );
          })}
        </View>
      )}

      {/* Action */}
      {phase === 0 && (
        <Pressable onPress={() => setPhase(1)} style={[S.actionBtn, { backgroundColor: colors.primary }]}>
          <Text style={[S.actionLabel, { color: '#08080A' }]}>SEND PRIVATELY</Text>
        </Pressable>
      )}
      {phase > 0 && phase < 3 && (
        <View style={[S.actionBtn, softGlass]}>
          <Text style={[S.actionLabel, { color: colors.textSecondary }]}>
            {['', 'ROUTING', 'SHARDING', 'CONFIRMED'][phase]}…
          </Text>
        </View>
      )}
      {phase === 3 && (
        <Pressable onPress={() => setPhase(0)} style={[S.actionBtn, accentGlass]}>
          <Text style={[S.actionLabel, { color: colors.primary }]}>✓ SENT · NEW TRANSFER</Text>
        </Pressable>
      )}
    </View>
  );
}

// ── SwapRow ───────────────────────────────────────────────────────────────────

function SwapRow({ label, asset, value, onValue, readOnly, editable }: {
  label: string; asset: Asset; value: string;
  onValue: ((v: string) => void) | null; readOnly: boolean; editable: boolean;
}) {
  const { colors } = useTheme();
  const glass      = useGlass();
  const softGlass  = useGlass('soft');
  return (
    <View style={[S.card, glass]}>
      <Text style={[S.cardLabel, { color: colors.textTertiary }]}>{label.toUpperCase()}</Text>
      <View style={[S.row, { marginTop: 6 }]}>
        <TextInput
          style={[S.swapInput, { color: readOnly ? colors.textPrimary : colors.accent, flex: 1 }]}
          value={value}
          onChangeText={v => onValue?.(v)}
          keyboardType="decimal-pad"
          editable={!readOnly && editable}
        />
        <View style={[S.assetPill, softGlass]}>
          <AssetDot asset={asset} size={20} />
          <Text style={[S.assetPillLabel, { color: colors.textPrimary }]}>{asset.sym}</Text>
          <Feather name="chevron-right" size={10} color={colors.textSecondary} />
        </View>
      </View>
      <Text style={[S.balHint, { color: colors.textTertiary }]}>balance · {asset.bal} {asset.sym}</Text>
    </View>
  );
}

// ── SwapPanel ─────────────────────────────────────────────────────────────────

function SwapPanel() {
  const { colors }   = useTheme();
  const softGlass    = useGlass('soft');
  const strongGlass  = useGlass('strong');
  const accentGlass  = useGlass('accent');

  const [from, setFrom]   = useState(ASSETS[1]);
  const [to,   setTo]     = useState(ASSETS[0]);
  const [amt,  setAmt]    = useState('500');
  const [phase, setPhase] = useState(0);

  const rate = 189.32;
  const out  = (parseFloat(amt || '0') / rate).toFixed(4);

  useEffect(() => {
    if (phase === 0 || phase === 3) return;
    const t = setTimeout(() => setPhase(p => p + 1), 900);
    return () => clearTimeout(t);
  }, [phase]);

  const flip = () => { setFrom(to); setTo(from); };

  return (
    <View style={S.panel}>
      <SwapRow label="you pay" asset={from} value={amt} onValue={setAmt} readOnly={false} editable={phase === 0} />

      <View style={S.flipWrap}>
        <Pressable onPress={flip} style={[S.flipBtn, strongGlass, { elevation: 4 }]}>
          <Feather name="repeat" size={14} color={colors.primary} />
        </Pressable>
      </View>

      <SwapRow label="you get" asset={to} value={out} onValue={null} readOnly editable={false} />

      {/* Rate card */}
      <View style={[S.card, softGlass]}>
        {([
          ['rate',        `1 ${to.sym} = ${rate} ${from.sym}`],
          ['route',       'jupiter · confidential'],
          ['network fee', '~0.00025 SOL'],
        ] as [string, string][]).map(([k, v], i) => (
          <View key={k} style={[S.rateRow, i > 0 && { marginTop: 4 }]}>
            <Text style={[S.rateKey, { color: colors.textSecondary }]}>{k}</Text>
            <Text style={[S.rateVal, { color: i === 1 ? colors.textPrimary : colors.textSecondary }]}>{v}</Text>
          </View>
        ))}
      </View>

      {/* Privacy chip */}
      <View style={[S.card, accentGlass, S.row, { alignItems: 'center', gap: 10 }]}>
        <Feather name="lock" size={12} color={colors.primary} />
        <Text style={[S.privLabel, { color: colors.primary, flex: 1 }]}>CONFIDENTIAL SWAP · ZERO SLIPPAGE LEAK</Text>
      </View>

      {/* Action */}
      {phase === 0 && (
        <Pressable onPress={() => setPhase(1)} style={[S.actionBtn, { backgroundColor: colors.primary, marginTop: 2 }]}>
          <Text style={[S.actionLabel, { color: '#08080A' }]}>SWAP</Text>
        </Pressable>
      )}
      {phase > 0 && phase < 3 && (
        <View style={[S.actionBtn, softGlass]}>
          <Text style={[S.actionLabel, { color: colors.textSecondary }]}>
            {['', 'ROUTING', 'SHARDING', 'SETTLING'][phase]}…
          </Text>
        </View>
      )}
      {phase === 3 && (
        <Pressable onPress={() => setPhase(0)} style={[S.actionBtn, accentGlass]}>
          <Text style={[S.actionLabel, { color: colors.primary }]}>✓ SWAPPED · NEW ORDER</Text>
        </Pressable>
      )}
    </View>
  );
}

// ── YieldPanel ────────────────────────────────────────────────────────────────

function YieldPanel() {
  const { colors }  = useTheme();
  const glass       = useGlass();
  const softGlass   = useGlass('soft');
  const accentGlass = useGlass('accent');

  const [expanded, setExpanded] = useState<number | null>(null);

  return (
    <View style={S.panel}>
      {/* Earnings summary */}
      <View style={[S.card, glass]}>
        <Text style={[S.cardLabel, { color: colors.textTertiary }]}>LIFETIME EARNINGS</Text>
        <View style={[S.row, { alignItems: 'baseline', gap: 8, marginTop: 6 }]}>
          <Text style={[S.earningsAmt, { color: colors.primary }]}>+$142.88</Text>
          <Text style={[S.cardLabel, { color: colors.textTertiary }]}>· 7.24% AVG APY</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', height: 34, gap: 2, marginTop: 8 }}>
          {[28,24,25,20,22,16,18,14,15,10,12,8,10,6,8,4].map((v, i, arr) => (
            <View
              key={i}
              style={{
                flex: 1,
                height: ((34 - v) / 34) * 34,
                borderRadius: 1,
                backgroundColor: colors.primary,
                opacity: 0.15 + (i / arr.length) * 0.6,
              }}
            />
          ))}
        </View>
      </View>

      <Text style={[S.cardLabel, { color: colors.textTertiary, paddingHorizontal: 2 }]}>VAULTS</Text>

      {VAULTS.map((v, i) => {
        const on = expanded === i;
        return (
          <View key={i} style={[S.card, glass, { padding: 0, overflow: 'hidden' }]}>
            <Pressable onPress={() => setExpanded(on ? null : i)} style={S.vaultHeader}>
              <AssetDot asset={{ sym: v.asset, color: v.color }} size={32} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={[S.vaultName, { color: colors.textPrimary }]}>{v.name}</Text>
                <View style={[S.row, { gap: 6, marginTop: 3 }]}>
                  <Text style={[S.vaultMeta, { color: colors.textTertiary }]}>TVL · {v.tvl}</Text>
                  <Text style={[S.vaultMeta, { color: colors.textTertiary }]}>·</Text>
                  <Text style={[S.vaultMeta, { color: colors.textTertiary }]}>{v.risk} RISK</Text>
                  {v.deposited && (
                    <>
                      <Text style={[S.vaultMeta, { color: colors.textTertiary }]}>·</Text>
                      <Text style={[S.vaultMeta, { color: colors.primary }]}>STAKED</Text>
                    </>
                  )}
                </View>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={[S.vaultApy, { color: colors.primary }]}>{v.apy}%</Text>
                <Text style={[S.cardLabel, { color: colors.textTertiary, marginTop: 2 }]}>APY</Text>
              </View>
            </Pressable>

            {on && (
              <View style={[S.vaultExpanded, { borderTopColor: colors.borderSubtle }]}>
                {v.deposited && (
                  <View style={[S.rateRow, { paddingVertical: 8 }]}>
                    <Text style={[S.rateKey, { color: colors.textSecondary }]}>you&apos;ve deposited</Text>
                    <Text style={[S.rateVal, { color: colors.textPrimary }]}>{v.deposited} {v.asset}</Text>
                  </View>
                )}
                <View style={[S.row, { gap: 8, marginTop: 8 }]}>
                  <Pressable style={[S.vaultBtn, { backgroundColor: colors.primary, flex: 1 }]}>
                    <Text style={[S.vaultBtnLabel, { color: '#08080A' }]}>DEPOSIT</Text>
                  </Pressable>
                  {v.deposited && (
                    <Pressable style={[S.vaultBtn, softGlass, { flex: 1 }]}>
                      <Text style={[S.vaultBtnLabel, { color: colors.textPrimary }]}>WITHDRAW</Text>
                    </Pressable>
                  )}
                </View>
              </View>
            )}
          </View>
        );
      })}
    </View>
  );
}

// ── WalletScreen ──────────────────────────────────────────────────────────────

export default function WalletScreen() {
  const { colors } = useTheme();
  const softGlass  = useGlass('soft');

  const [tab,       setTab]       = useState<Tab>('send');
  const [balHidden, setBalHidden] = useState(false);

  return (
    <View style={[S.root, { backgroundColor: colors.background }]}>
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 32 }}>

            {/* Hero */}
            <View style={S.hero}>
              <View style={S.heroTop}>
                <Text style={[S.totalLabel, { color: colors.textTertiary }]}>TOTAL BALANCE</Text>
                <Pressable onPress={() => setBalHidden(h => !h)} style={[S.hideBtn, softGlass]}>
                  {balHidden
                    ? <Feather name="eye-off" size={12} color={colors.textSecondary} />
                    : <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: colors.textSecondary }} />
                  }
                </Pressable>
              </View>
              <View style={[S.row, { alignItems: 'baseline', gap: 8, marginTop: 6 }]}>
                <Text style={{ fontSize: 11, color: colors.textSecondary }}>$</Text>
                <Text style={[S.balanceAmt, { color: colors.textPrimary }]}>
                  {balHidden
                    ? '• • • • •'
                    : TOTAL_USD.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </Text>
              </View>
              <View style={[S.row, { gap: 8, marginTop: 8 }]}>
                <Text style={[S.heroGain, { color: colors.primary }]}>+$84.22 (0.7%) 24h</Text>
              </View>
            </View>

            {/* Tabs */}
            <WalletTabs tab={tab} onTab={setTab} />

            {/* Panel */}
            {tab === 'send'  && <SendPanel />}
            {tab === 'swap'  && <SwapPanel />}
            {tab === 'yield' && <YieldPanel />}

          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const S = StyleSheet.create({
  root: { flex: 1 },
  row:  { flexDirection: 'row', alignItems: 'center' },

  // Hero
  hero:       { padding: 20, paddingTop: 16, paddingBottom: 18 },
  heroTop:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  totalLabel: { fontFamily: 'monospace', fontSize: 10, letterSpacing: 2.5 },
  hideBtn:    { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  balanceAmt: { fontFamily: 'monospace', fontSize: 42, fontWeight: '500', letterSpacing: -1.5 },
  heroGain:   { fontFamily: 'monospace', fontSize: 10.5, letterSpacing: 0.5 },

  // Tabs
  tabBar:   { flexDirection: 'row', padding: 4, marginHorizontal: 20, borderRadius: 12, gap: 2 },
  tabBtn:   { flex: 1, paddingVertical: 10, borderRadius: 9, alignItems: 'center' },
  tabLabel: { fontFamily: 'monospace', fontSize: 11, letterSpacing: 2, textTransform: 'uppercase' },

  // Panel / shared
  panel:    { paddingHorizontal: 20, paddingTop: 14, paddingBottom: 16, gap: 12 },
  card:     { borderRadius: 16, padding: 12 },
  cardLabel:{ fontFamily: 'monospace', fontSize: 9.5, letterSpacing: 2.5, textTransform: 'uppercase' },
  privLabel:{ fontFamily: 'monospace', fontSize: 9.5, letterSpacing: 2, textTransform: 'uppercase' },

  // Send — asset picker
  assetBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 8, paddingHorizontal: 11, borderRadius: 10, borderWidth: 0.5, borderColor: 'transparent' },
  assetSym: { fontFamily: 'monospace', fontSize: 11, letterSpacing: 0.5 },
  assetBal: { fontFamily: 'monospace', fontSize: 9 },
  privDot:  { width: 5, height: 5, borderRadius: 3 },

  // Send — recipient
  textField:     { fontSize: 14, fontFamily: 'monospace', letterSpacing: 0.5, padding: 0 },
  resolvedBadge: { fontFamily: 'monospace', fontSize: 9, letterSpacing: 2 },

  // Send — amount
  amountHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  maxBtn:       { fontFamily: 'monospace', fontSize: 9.5, letterSpacing: 2, textTransform: 'uppercase' },
  amountInput:  { fontSize: 40, fontWeight: '500', letterSpacing: -1.5, padding: 0 },
  amountSym:    { fontFamily: 'monospace', fontSize: 13, letterSpacing: 1.5 },
  usdHint:      { fontFamily: 'monospace', fontSize: 11, marginTop: 4 },

  // Progress
  progressLine: { flexDirection: 'row', gap: 10, paddingVertical: 3 },
  progressText: { fontFamily: 'monospace', fontSize: 11, letterSpacing: 0.5, flex: 1 },

  // Action
  actionBtn:   { padding: 15, borderRadius: 14, alignItems: 'center' },
  actionLabel: { fontFamily: 'monospace', fontSize: 12, letterSpacing: 3.5, textTransform: 'uppercase', fontWeight: '600' },

  // Swap
  swapInput:     { fontSize: 30, fontWeight: '500', letterSpacing: -0.5, padding: 0 },
  assetPill:     { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 7, paddingHorizontal: 11, borderRadius: 99 },
  assetPillLabel:{ fontFamily: 'monospace', fontSize: 12, letterSpacing: 0.5 },
  balHint:       { fontFamily: 'monospace', fontSize: 10.5, marginTop: 4 },
  flipWrap:      { alignItems: 'center', marginVertical: -20, zIndex: 2 },
  flipBtn:       { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  rateRow:       { flexDirection: 'row', justifyContent: 'space-between' },
  rateKey:       { fontFamily: 'monospace', fontSize: 11 },
  rateVal:       { fontFamily: 'monospace', fontSize: 11 },

  // Yield
  earningsAmt:  { fontFamily: 'monospace', fontSize: 28, fontWeight: '500', letterSpacing: -0.5 },
  vaultHeader:  { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
  vaultName:    { fontSize: 14, letterSpacing: -0.2 },
  vaultMeta:    { fontFamily: 'monospace', fontSize: 9.5, letterSpacing: 1.5, textTransform: 'uppercase' },
  vaultApy:     { fontFamily: 'monospace', fontSize: 16, fontWeight: '500', letterSpacing: -0.2 },
  vaultExpanded:{ padding: 14, paddingTop: 2, borderTopWidth: 0.5 },
  vaultBtn:     { padding: 11, borderRadius: 10, alignItems: 'center' },
  vaultBtnLabel:{ fontFamily: 'monospace', fontSize: 11, fontWeight: '600', letterSpacing: 2.5, textTransform: 'uppercase' },
});

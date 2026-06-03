import React, { memo, useCallback, useRef, useState } from 'react';
import {
  NativeScrollEvent, NativeSyntheticEvent,
  ScrollView, StyleSheet, Text, View, useWindowDimensions,
} from 'react-native';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { fontFamily, fontSize, radii, spacing, useTheme } from '@/theme';
import { useGlass } from '@/hooks/useGlass';
import { relTime } from '@/src/utils/relTime';

export interface PendingCosign {
  id:          string;
  txHash:      string;
  amountSol:   number;
  feeSol:      number;
  fromHash:    string;
  requestedAt: number;
}

interface Props {
  items: PendingCosign[];
}

function short(hash: string) {
  return `${hash.slice(0, 6)}…${hash.slice(-6)}`;
}

// No H_PAD — parent (WalletScreen grid) owns horizontal padding
const PEEK     = 14;  // next card peek amount
const CARD_GAP = 10;
// cardW accounts for wallet grid's paddingHorizontal: 16 on each side
const WALLET_PAD = 32;

export const PendingCosigns = memo(function PendingCosigns({ items }: Props) {
  const { colors }     = useTheme();
  const { width: sw }  = useWindowDimensions();
  const cardW          = sw - WALLET_PAD - PEEK;
  const [dot, setDot]  = useState(0);
  const scrollRef      = useRef<ScrollView>(null);

  const onScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    setDot(Math.round(e.nativeEvent.contentOffset.x / (cardW + CARD_GAP)));
  }, [cardW]);

  const isEmpty = items.length === 0;

  return (
    <View style={S.wrap}>
      {/* Section header */}
      <View style={S.labelRow}>
        <Text accessibilityRole="header" style={[S.sectionLabel, { color: colors.textTertiary }]}>MULTISIG CO-SIGNS</Text>
        <View style={[S.badge, { backgroundColor: colors.surface2, borderColor: colors.border }]}>
          <Text style={[S.badgeText, { color: colors.textTertiary }]}>PREVIEW</Text>
        </View>
      </View>

      {isEmpty ? (
        <EmptyState />
      ) : (
        <>
          <ScrollView
            ref={scrollRef}
            horizontal
            showsHorizontalScrollIndicator={false}
            snapToInterval={cardW + CARD_GAP}
            decelerationRate="fast"
            contentContainerStyle={[S.list, { gap: CARD_GAP }]}
            onScroll={onScroll}
            scrollEventThrottle={16}
          >
            {items.map(item => (
              <CosignCard
                key={item.id}
                item={item}
                cardWidth={cardW}
              />
            ))}
          </ScrollView>

          {items.length > 1 && (
            <View style={S.dots}>
              {items.map((item, i) => (
                <View
                  key={item.id}
                  style={[
                    S.dot,
                    { backgroundColor: i === dot ? colors.primary : colors.borderSubtle },
                    i === dot && S.dotActive,
                  ]}
                />
              ))}
            </View>
          )}
        </>
      )}
    </View>
  );
});

function EmptyState() {
  const { colors } = useTheme();
  const glass      = useGlass();
  return (
    <View style={[S.emptyCard, glass, { borderColor: colors.border }]}>
      <MaterialCommunityIcons name="bird" size={20} color={colors.textTertiary} />
      <Text style={[S.emptyText, { color: colors.textTertiary }]}>Multisig co-signs not yet live</Text>
    </View>
  );
}

const CosignCard = memo(function CosignCard({
  item, cardWidth,
}: {
  item:     PendingCosign;
  cardWidth: number;
}) {
  const { colors } = useTheme();
  const glass      = useGlass();

  return (
    <View style={[S.card, glass, { width: cardWidth, borderColor: colors.border }]}>
      <View style={[S.cardAccent, { backgroundColor: colors.primary }]} />

      {/* Top row: from + time */}
      <View style={S.cardTop}>
        <View style={[S.fromPill, { backgroundColor: colors.surface2, borderColor: colors.border }]}>
          <Feather name="user" size={9} color={colors.textTertiary} />
          <Text style={[S.fromHash, { color: colors.textSecondary }]}>{short(item.fromHash)}</Text>
        </View>
        <Text style={[S.timeAgo, { color: colors.textTertiary }]}>{relTime(item.requestedAt)}</Text>
      </View>

      {/* Amount + tx hash inline */}
      <View style={S.amountBlock}>
        <View style={S.amountRow}>
          <Text style={[S.amount, { color: colors.textPrimary }]}>{item.amountSol.toFixed(4)}</Text>
          <Text style={[S.amountUnit, { color: colors.primary }]}>SOL</Text>
        </View>
        <Text style={[S.txHash, { color: colors.textTertiary }]}>{short(item.txHash)}</Text>
      </View>

      {/* Fee row */}
      <View style={[S.feeRow, { borderTopColor: colors.borderSubtle }]}>
        <View style={[S.feeIcon, { backgroundColor: colors.primarySubtle }]}>
          <Feather name="zap" size={9} color={colors.primary} />
        </View>
        <Text style={[S.feeLabel, { color: colors.textTertiary }]}>Your fee</Text>
        <Text style={[S.feeVal, { color: colors.primary }]}>+{item.feeSol.toFixed(6)} SOL</Text>
      </View>

      {/* Actions — disabled in preview; multisig signing not yet wired */}
      <View style={S.actions} pointerEvents="none">
        <View style={[S.rejectBtn, { borderColor: colors.border, backgroundColor: colors.surface2, opacity: 0.4 }]}>
          <Feather name="x" size={14} color={colors.textTertiary} />
        </View>
        <View style={[S.signBtn, { backgroundColor: colors.surface2, borderWidth: 0.5, borderColor: colors.border, opacity: 0.6 }]}>
          <Text style={[S.signText, { color: colors.textTertiary }]}>Preview — not yet active</Text>
        </View>
      </View>
    </View>
  );
});

const S = StyleSheet.create({
  wrap:         { marginBottom: 0 },
  labelRow:     { flexDirection: 'row', alignItems: 'center', gap: spacing[3], marginBottom: 10 },
  sectionLabel: { fontFamily: fontFamily.sansMd, fontSize: fontSize.xs, letterSpacing: 2, textTransform: 'uppercase' },
  badge:        { paddingHorizontal: 7, paddingVertical: 2, borderRadius: radii.md, borderWidth: 0.5 },
  badgeText:    { fontFamily: fontFamily.sansMd, fontSize: fontSize.xs, letterSpacing: 1 },

  emptyCard:    { borderRadius: radii.lg, borderWidth: 0.5, padding: 14,
                  flexDirection: 'row', alignItems: 'center', gap: 10 },
  emptyText:    { fontFamily: fontFamily.sansMd, fontSize: fontSize.sm },

  list:         { paddingRight: PEEK },

  dots:         { flexDirection: 'row', justifyContent: 'center', gap: 5, marginTop: 10 },
  dot:          { width: 4, height: 4, borderRadius: radii.full },
  dotActive:    { width: 14 },

  card:         { borderRadius: radii.lg, borderWidth: 0.5, overflow: 'hidden', padding: 14, gap: 10 },
  cardAccent:   { position: 'absolute', top: 0, left: 0, right: 0, height: 2 },

  cardTop:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  fromPill:     { flexDirection: 'row', alignItems: 'center', gap: 4,
                  paddingHorizontal: 8, paddingVertical: 3, borderRadius: radii.xl, borderWidth: 0.5 },
  fromHash:     { fontFamily: fontFamily.sansMd, fontSize: fontSize.xs, letterSpacing: 0.3 },
  timeAgo:      { fontFamily: fontFamily.sansMd, fontSize: fontSize.xs },

  amountBlock:  { gap: 2 },
  amountRow:    { flexDirection: 'row', alignItems: 'flex-end', gap: 5 },
  amount:       { fontFamily: fontFamily.sansBold, fontSize: fontSize['2xl'], letterSpacing: -1, lineHeight: 30 },
  amountUnit:   { fontFamily: fontFamily.sansMd, fontSize: fontSize.sm, letterSpacing: 0.5, marginBottom: 2 },
  txHash:       { fontFamily: fontFamily.sansMd, fontSize: fontSize.xs, letterSpacing: 0.5, opacity: 0.5 },

  feeRow:       { flexDirection: 'row', alignItems: 'center', gap: spacing[3],
                  borderTopWidth: 0.5, paddingTop: 10 },
  feeIcon:      { width: 20, height: 20, borderRadius: radii.sm, alignItems: 'center', justifyContent: 'center' },
  feeLabel:     { flex: 1, fontFamily: fontFamily.sansMd, fontSize: fontSize.xs },
  feeVal:       { fontFamily: fontFamily.sansMd, fontSize: fontSize.xs, fontWeight: '600' },

  actions:      { flexDirection: 'row', gap: spacing[3] },
  rejectBtn:    { width: 40, height: 40, borderRadius: radii.md, borderWidth: 0.5,
                  alignItems: 'center', justifyContent: 'center' },
  signBtn:      { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
                  gap: 7, height: 40, borderRadius: radii.md },
  signText:     { fontFamily: fontFamily.sansMd, fontSize: fontSize.sm, fontWeight: '600' },
});

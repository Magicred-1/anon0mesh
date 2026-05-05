import React, { memo, useCallback, useRef, useState } from 'react';
import {
  NativeScrollEvent, NativeSyntheticEvent,
  ScrollView, StyleSheet, Text, View, Pressable, useWindowDimensions,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { fontFamily, useTheme } from '@/theme';
import { useGlass } from '@/hooks/useGlass';

export interface PendingCosign {
  id:          string;
  txHash:      string;
  amountSol:   number;
  feeSol:      number;
  fromHash:    string;
  requestedAt: number;
}

interface Props {
  items:    PendingCosign[];
  onSign:   (id: string) => void;
  onReject: (id: string) => void;
}

function relTime(ms: number) {
  const d = Date.now() - ms;
  if (d < 60_000)    return 'just now';
  if (d < 3_600_000) return `${Math.floor(d / 60_000)}m ago`;
  return `${Math.floor(d / 3_600_000)}h ago`;
}

function short(hash: string) {
  return `${hash.slice(0, 6)}…${hash.slice(-6)}`;
}

const H_PAD  = 20;
const PEEK   = 14;
const CARD_GAP = 10;

export const PendingCosigns = memo(function PendingCosigns({ items, onSign, onReject }: Props) {
  const { colors }          = useTheme();
  const { width: sw }       = useWindowDimensions();
  const cardW               = sw - H_PAD * 2 - PEEK;
  const [dot, setDot]       = useState(0);
  const scrollRef           = useRef<ScrollView>(null);

  const onScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const x = e.nativeEvent.contentOffset.x;
    setDot(Math.round(x / (cardW + CARD_GAP)));
  }, [cardW]);

  const isEmpty = items.length === 0;

  return (
    <View style={[S.wrap, { paddingHorizontal: H_PAD }]}>
      {/* Section header */}
      <View style={S.labelRow}>
        <Text style={[S.sectionLabel, { color: colors.textTertiary }]}>PENDING CO-SIGNS</Text>
        {!isEmpty && (
          <View style={[S.badge, { backgroundColor: colors.primary + '22', borderColor: colors.primary + '44' }]}>
            <Text style={[S.badgeText, { color: colors.primary }]}>{items.length}</Text>
          </View>
        )}
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
                onSign={onSign}
                onReject={onReject}
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
      <Text style={[S.emptyText, { color: colors.textTertiary }]}>No pending requests</Text>
    </View>
  );
}

const CosignCard = memo(function CosignCard({
  item, cardWidth, onSign, onReject,
}: {
  item: PendingCosign;
  cardWidth: number;
  onSign: (id: string) => void;
  onReject: (id: string) => void;
}) {
  const { colors } = useTheme();
  const glass      = useGlass();
  const handleSign   = useCallback(() => onSign(item.id),   [item.id, onSign]);
  const handleReject = useCallback(() => onReject(item.id), [item.id, onReject]);

  return (
    <View style={[S.card, glass, { width: cardWidth, borderColor: colors.border }]}>
      <View style={[S.cardAccent, { backgroundColor: colors.primary }]} />

      {/* Top row: from + time */}
      <View style={S.cardTop}>
        <View style={[S.fromPill, { backgroundColor: colors.surface2, borderColor: colors.border }]}>
          <Feather name="user" size={10} color={colors.textTertiary} />
          <Text style={[S.fromHash, { color: colors.textSecondary }]}>{short(item.fromHash)}</Text>
        </View>
        <Text style={[S.timeAgo, { color: colors.textTertiary }]}>{relTime(item.requestedAt)}</Text>
      </View>

      {/* Amount hero */}
      <View style={S.amountRow}>
        <Text style={[S.amount, { color: colors.textPrimary }]}>
          {item.amountSol.toFixed(4)}
        </Text>
        <Text style={[S.amountUnit, { color: colors.primary }]}>SOL</Text>
      </View>

      {/* Tx hash */}
      <Text style={[S.txHash, { color: colors.textTertiary }]}>{short(item.txHash)}</Text>

      {/* Divider + fee */}
      <View style={[S.feeRow, { borderTopColor: colors.borderSubtle }]}>
        <View style={[S.feeIcon, { backgroundColor: colors.primarySubtle }]}>
          <Feather name="zap" size={10} color={colors.primary} />
        </View>
        <Text style={[S.feeLabel, { color: colors.textTertiary }]}>Your fee</Text>
        <Text style={[S.feeVal, { color: colors.primary }]}>+{item.feeSol.toFixed(6)} SOL</Text>
      </View>

      {/* Actions */}
      <View style={S.actions}>
        <Pressable
          onPress={handleReject}
          style={({ pressed }) => [
            S.rejectBtn,
            { borderColor: colors.border, backgroundColor: colors.surface2, opacity: pressed ? 0.5 : 1 },
          ]}
        >
          <Feather name="x" size={15} color={colors.textTertiary} />
        </Pressable>
        <Pressable
          onPress={handleSign}
          style={({ pressed }) => [S.signBtn, { backgroundColor: colors.primary, opacity: pressed ? 0.82 : 1 }]}
        >
          <Feather name="lock" size={13} color={colors.textInverse} />
          <Text style={[S.signText, { color: colors.textInverse }]}>Sign with Biometrics</Text>
        </Pressable>
      </View>
    </View>
  );
});

const S = StyleSheet.create({
  wrap:         { marginBottom: 32 },
  labelRow:     { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  sectionLabel: { fontFamily: fontFamily.sansMd, fontSize: 10, letterSpacing: 2, textTransform: 'uppercase' },
  badge:        { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 10, borderWidth: 0.5 },
  badgeText:    { fontFamily: fontFamily.sansMd, fontSize: 9, letterSpacing: 1 },

  emptyCard:    { borderRadius: 16, borderWidth: 0.5, padding: 18,
                  flexDirection: 'row', alignItems: 'center', gap: 10 },
  emptyText:    { fontFamily: fontFamily.sansMd, fontSize: 12 },

  list:         { paddingRight: PEEK },

  dots:         { flexDirection: 'row', justifyContent: 'center', gap: 5, marginTop: 12 },
  dot:          { width: 4, height: 4, borderRadius: 2 },
  dotActive:    { width: 16 },

  card:         { borderRadius: 18, borderWidth: 0.5, overflow: 'hidden',
                  padding: 16, gap: 12 },
  cardAccent:   { position: 'absolute', top: 0, left: 0, right: 0, height: 2 },

  cardTop:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  fromPill:     { flexDirection: 'row', alignItems: 'center', gap: 5,
                  paddingHorizontal: 8, paddingVertical: 4, borderRadius: 20, borderWidth: 0.5 },
  fromHash:     { fontFamily: fontFamily.sansMd, fontSize: 10, letterSpacing: 0.3 },
  timeAgo:      { fontFamily: fontFamily.sansMd, fontSize: 10 },

  amountRow:    { flexDirection: 'row', alignItems: 'flex-end', gap: 6 },
  amount:       { fontFamily: fontFamily.sansBold, fontSize: 34, letterSpacing: -1.5, lineHeight: 38 },
  amountUnit:   { fontFamily: fontFamily.sansMd, fontSize: 15, letterSpacing: 0.5, marginBottom: 4 },

  txHash:       { fontFamily: fontFamily.sansMd, fontSize: 10, letterSpacing: 0.5, marginTop: -4 },

  feeRow:       { flexDirection: 'row', alignItems: 'center', gap: 8,
                  borderTopWidth: 0.5, paddingTop: 12 },
  feeIcon:      { width: 22, height: 22, borderRadius: 7, alignItems: 'center', justifyContent: 'center' },
  feeLabel:     { flex: 1, fontFamily: fontFamily.sansMd, fontSize: 11 },
  feeVal:       { fontFamily: fontFamily.sansMd, fontSize: 11, fontWeight: '600' },

  actions:      { flexDirection: 'row', gap: 8 },
  rejectBtn:    { width: 44, height: 44, borderRadius: 13, borderWidth: 0.5,
                  alignItems: 'center', justifyContent: 'center' },
  signBtn:      { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
                  gap: 8, height: 44, borderRadius: 13 },
  signText:     { fontFamily: fontFamily.sansMd, fontSize: 13, fontWeight: '600' },
});

import React, { memo, useEffect, useRef, useState } from 'react';
import {
  Animated, Keyboard, Modal, Pressable,
  StyleSheet, Text, TextInput, View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { fontFamily, useTheme } from '@/theme';
import { useGlass } from '@/hooks/useGlass';
import { ASSET_COLORS, BLUE } from './constants';

export type GridAction =
  | { type: 'share-address' }
  | { type: 'request-address' }
  | { type: 'request-money'; amount: string; asset: 'SOL' | 'USDC' };

interface Props {
  readonly visible:       boolean;
  readonly hasWallet:     boolean;
  readonly walletAddress?: string;
  readonly onAction:      (a: GridAction) => void;
  readonly onClose:       () => void;
}

const ASSETS: ('SOL' | 'USDC')[] = ['SOL', 'USDC'];

export const ActionGrid = memo(function ActionGrid({ visible, hasWallet, walletAddress, onAction, onClose }: Props) {
  const { colors } = useTheme();
  const glass      = useGlass();
  const softGlass  = useGlass('soft');
  const slideAnim  = useRef(new Animated.Value(300)).current;

  const [moneyOpen, setMoneyOpen] = useState(false);
  const [amount,    setAmount]    = useState('');
  const [asset,     setAsset]     = useState<'SOL' | 'USDC'>('SOL');

  useEffect(() => {
    if (visible) {
      setMoneyOpen(false); setAmount(''); setAsset('SOL');
      Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, overshootClamping: true }).start();
    } else {
      Animated.timing(slideAnim, { toValue: 300, duration: 220, useNativeDriver: true }).start();
    }
  }, [visible, slideAnim]);

  const close = () => { Keyboard.dismiss(); onClose(); };

  const fire = (a: GridAction) => { onClose(); onAction(a); };

  if (!visible) return null;

  let addrSubtitle = 'No wallet connected';
  if (hasWallet) addrSubtitle = walletAddress ? `${walletAddress.slice(0, 6)}…${walletAddress.slice(-6)}` : 'Send your Solana pubkey';

  return (
    <Modal visible transparent animationType="none" onRequestClose={close}>
      <Pressable style={[StyleSheet.absoluteFill, S.backdrop]} onPress={close} />
      <Animated.View style={[S.sheet, glass, { transform: [{ translateY: slideAnim }] }]}>

        {/* Share address */}
        <Pressable
          style={({ pressed }) => [S.row, pressed && { opacity: 0.7 }]}
          onPress={() => hasWallet ? fire({ type: 'share-address' }) : null}
        >
          <View style={[S.icon, { backgroundColor: ASSET_COLORS.SOL + '22' }]}>
            <Feather name="share-2" size={16} color={ASSET_COLORS.SOL} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[S.rowTitle, { color: colors.textPrimary }]}>Share wallet address</Text>
            <Text style={[S.rowSub,   { color: colors.textTertiary }]}>
              {addrSubtitle}
            </Text>
          </View>
          <Feather name="chevron-right" size={14} color={colors.textTertiary} />
        </Pressable>

        <View style={[S.sep, { backgroundColor: colors.borderSubtle }]} />

        {/* Request address */}
        <Pressable
          style={({ pressed }) => [S.row, pressed && { opacity: 0.7 }]}
          onPress={() => fire({ type: 'request-address' })}
        >
          <View style={[S.icon, { backgroundColor: BLUE + '22' }]}>
            <Feather name="at-sign" size={16} color={BLUE} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[S.rowTitle, { color: colors.textPrimary }]}>Request wallet address</Text>
            <Text style={[S.rowSub,   { color: colors.textTertiary }]}>Ask peer for their pubkey</Text>
          </View>
          <Feather name="chevron-right" size={14} color={colors.textTertiary} />
        </Pressable>

        <View style={[S.sep, { backgroundColor: colors.borderSubtle }]} />

        {/* Request money */}
        <Pressable
          style={({ pressed }) => [S.row, pressed && !moneyOpen && { opacity: 0.7 }]}
          onPress={() => setMoneyOpen(o => !o)}
        >
          <View style={[S.icon, { backgroundColor: colors.primary + '22' }]}>
            <Feather name="dollar-sign" size={16} color={colors.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[S.rowTitle, { color: colors.textPrimary }]}>Request payment</Text>
            <Text style={[S.rowSub,   { color: colors.textTertiary }]}>Ask peer to send crypto</Text>
          </View>
          <Feather name={moneyOpen ? 'chevron-up' : 'chevron-down'} size={14} color={colors.textTertiary} />
        </Pressable>

        {moneyOpen && (
          <View style={[S.moneyExpand, softGlass]}>
            {/* Asset picker */}
            <View style={S.assetRow}>
              {ASSETS.map(a => (
                <Pressable
                  key={a}
                  onPress={() => setAsset(a)}
                  style={[
                    S.assetBtn,
                    { borderColor: asset === a ? (ASSET_COLORS[a] ?? colors.primary) : colors.border,
                      backgroundColor: asset === a ? (ASSET_COLORS[a] ?? colors.primary) + '22' : 'transparent' },
                  ]}
                >
                  <Text style={[S.assetText, { color: asset === a ? (ASSET_COLORS[a] ?? colors.primary) : colors.textTertiary }]}>
                    {a}
                  </Text>
                </Pressable>
              ))}
            </View>

            {/* Amount input */}
            <View style={[S.amountRow, { borderColor: colors.border }]}>
              <TextInput
                style={[S.amountInput, { color: colors.textPrimary }]}
                placeholder="0.00"
                placeholderTextColor={colors.textTertiary}
                value={amount}
                onChangeText={setAmount}
                keyboardType="decimal-pad"
                autoFocus
              />
              <Text style={[S.assetLabel, { color: colors.textSecondary }]}>{asset}</Text>
            </View>

            <Pressable
              disabled={amount.trim() === '' || parseFloat(amount) <= 0}
              onPress={() => {
                const n = parseFloat(amount);
                if (!isNaN(n) && n > 0) fire({ type: 'request-money', amount, asset });
              }}
              style={[S.sendBtn, {
                backgroundColor: amount.trim() !== '' && parseFloat(amount) > 0
                  ? colors.primary : colors.surface2,
              }]}
            >
              <Text style={[S.sendText, {
                color: amount.trim() !== '' && parseFloat(amount) > 0
                  ? colors.background : colors.textTertiary,
              }]}>
                SEND REQUEST
              </Text>
            </Pressable>
          </View>
        )}

      </Animated.View>
    </Modal>
  );
});

const S = StyleSheet.create({
  backdrop:     { justifyContent: 'flex-end' },
  sheet:        {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    borderTopLeftRadius: 20, borderTopRightRadius: 20,
    paddingBottom: 32, paddingTop: 6,
  },
  row:          { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 18, paddingVertical: 14 },
  icon:         { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  rowTitle:     { fontFamily: fontFamily.sansMd, fontSize: 13.5, marginBottom: 2 },
  rowSub:       { fontFamily: fontFamily.sansMd, fontSize: 11, letterSpacing: 0.2 },
  sep:          { height: 0.5, marginHorizontal: 18 },

  moneyExpand:  { marginHorizontal: 18, marginTop: 4, borderRadius: 14, padding: 14, gap: 10 },
  assetRow:     { flexDirection: 'row', gap: 8 },
  assetBtn:     { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 8, borderWidth: 0.5 },
  assetText:    { fontFamily: fontFamily.sansMd, fontSize: 11, letterSpacing: 1.5, textTransform: 'uppercase' },
  amountRow:    { flexDirection: 'row', alignItems: 'center', borderWidth: 0.5, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10 },
  amountInput:  { flex: 1, fontSize: 22, fontFamily: fontFamily.sansMd },
  assetLabel:   { fontFamily: fontFamily.sansMd, fontSize: 13, letterSpacing: 1 },
  sendBtn:      { padding: 12, borderRadius: 10, alignItems: 'center' },
  sendText:     { fontFamily: fontFamily.sansMd, fontSize: 11, fontWeight: '600', letterSpacing: 2.5, textTransform: 'uppercase' },
});

import React, { memo, useState, useCallback } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { fontFamily, fontSize, radii, spacing, useTheme } from '@/theme';
import { useGlass } from '@/hooks/useGlass';
import { useWallet } from '@/context/WalletContext';
import { QRCode } from '@/components/settings/QRCode';

export const ReceivePanel = memo(function ReceivePanel() {
  const { colors }    = useTheme();
  const glass         = useGlass();
  const softGlass     = useGlass('soft');
  const accentGlass   = useGlass('accent');
  const { publicKey } = useWallet();
  const [copied, setCopied] = useState(false);

  const address = publicKey?.toBase58() ?? 'no wallet connected';
  const short   = address.length > 12
    ? address.slice(0, 8) + '····' + address.slice(-6)
    : address;

  const copy = useCallback(async () => {
    try {
      const Clipboard = await import('expo-clipboard');
      await Clipboard.setStringAsync(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    } catch (err) {
      // Off-grid audit § 3: don't silently swallow. The user just pressed
      // a copy button and got no feedback — at least surface it in logs so
      // the failure is debuggable. UI state stays "not copied".
      console.warn('[wallet/ReceivePanel] copy address failed', err);
      setCopied(false);
    }
  }, [address]);

  return (
    <View style={S.panel}>
      <View style={[S.qrCard, glass, { alignItems: 'center' }]}>
        <Text accessibilityRole="header" style={[S.cardLabel, { color: colors.textTertiary, marginBottom: spacing[5] }]}>SOLANA ADDRESS</Text>
        <View style={[S.qrWrap, { borderColor: colors.border }]}>
          <QRCode data={address} size={180} />
        </View>
        <Text style={[S.address, { color: colors.textPrimary }]}>{short}</Text>
        <Text style={[S.hint, { color: colors.textTertiary }]}>SOL · SPL TOKENS</Text>
      </View>

      <View style={[S.infoCard, accentGlass]}>
        <Feather name="radio" size={12} color={colors.primary} />
        <Text style={[S.infoText, { color: colors.primary }]}>SHARE THIS QR - YOUR FIRST INBOUND SHOWS IN ACTIVITY</Text>
      </View>

      <Pressable onPress={copy} style={[S.copyBtn, softGlass]}>
        <Feather name={copied ? 'check' : 'copy'} size={14} color={copied ? colors.primary : colors.textSecondary} />
        <Text style={[S.copyLabel, { color: copied ? colors.primary : colors.textSecondary }]}>
          {copied ? 'COPIED' : 'COPY ADDRESS'}
        </Text>
      </Pressable>
    </View>
  );
});

const S = StyleSheet.create({
  panel:     { paddingHorizontal: spacing[6], paddingTop: 14, paddingBottom: spacing[5], gap: spacing[4] },
  cardLabel: { fontFamily: fontFamily.sansMd, fontSize: 9.5, letterSpacing: 2.5, textTransform: 'uppercase' },
  qrCard:    { borderRadius: radii.lg, padding: spacing[6], gap: 14 },
  qrWrap:    { padding: 10, borderRadius: radii.md, borderWidth: 0.5, overflow: 'hidden' },
  address:   { fontFamily: fontFamily.mono, fontSize: fontSize.sm, letterSpacing: 0.5 },
  hint:      { fontFamily: fontFamily.sansMd, fontSize: 9, letterSpacing: 2.5, textTransform: 'uppercase' },
  infoCard:  { flexDirection: 'row', alignItems: 'center', gap: spacing[3], padding: spacing[4], borderRadius: radii.md },
  infoText:  { fontFamily: fontFamily.sansMd, fontSize: 9.5, letterSpacing: 2, textTransform: 'uppercase' },
  copyBtn:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing[3], padding: 14, borderRadius: radii.lg },
  copyLabel: { fontFamily: fontFamily.sansMd, fontSize: fontSize.xs, fontWeight: '600', letterSpacing: 3, textTransform: 'uppercase' },
});

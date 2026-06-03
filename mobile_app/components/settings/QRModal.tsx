import React, { useState, useRef, useEffect } from 'react';
import { View, Text, Pressable, Modal, StyleSheet, Animated } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { fontFamily, fontSize, radii, useTheme } from '@/theme';
import { useGlass } from '@/hooks/useGlass';
import { Pill } from '@/components/ui/Pill';
import { useWallet } from '@/context/WalletContext';
import { useLxmfContext } from '@/context/LxmfContext';
import { QRCode } from './QRCode';

type QRTab = 'wallet' | 'anonmesh';

export function QRModal({ onClose, initialTab = 'anonmesh' }: { readonly onClose: () => void; readonly initialTab?: QRTab }) {
  const { colors } = useTheme();
  const softGlass   = useGlass('soft');
  const baseGlass   = useGlass();
  const accentGlass = useGlass('accent');
  const { publicKey } = useWallet();
  const { status, displayName }    = useLxmfContext();
  const [tab, setTab] = useState<QRTab>(initialTab);

  const meshAddress = status?.addressHex ?? '';
  const meshIdentity =  displayName || meshAddress || 'unknown';
  
  const meshHandle  = meshAddress ? `@${meshIdentity}` : '@——';
  const scaleAnim   = useRef(new Animated.Value(0.85)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(scaleAnim,   { toValue: 1, useNativeDriver: true, bounciness: 6 }),
      Animated.timing(opacityAnim, { toValue: 1, duration: 180, useNativeDriver: true }),
    ]).start();
  }, [scaleAnim, opacityAnim]);

  const dismiss = () => {
    Animated.parallel([
      Animated.timing(scaleAnim,   { toValue: 0.88, duration: 160, useNativeDriver: true }),
      Animated.timing(opacityAnim, { toValue: 0,    duration: 160, useNativeDriver: true }),
    ]).start(onClose);
  };

  const walletPubkey = publicKey?.toBase58() ?? null;
  const walletLabel  = walletPubkey
    ? walletPubkey.slice(0, 8) + '..' + walletPubkey.slice(-6)
    : 'not connected';
  const qrData = tab === 'wallet' ? (walletPubkey ?? 'no-wallet') : (meshAddress || 'no-identity');
  const label  = tab === 'wallet' ? walletLabel : meshHandle;

  return (
    <Modal transparent animationType="none" onRequestClose={dismiss}>
      <Animated.View style={[
        StyleSheet.absoluteFill,
        { backgroundColor: 'rgba(4,4,6,0.86)', opacity: opacityAnim, alignItems: 'center', justifyContent: 'center' },
      ]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={dismiss} />

        <Animated.View style={[S.card, baseGlass, { transform: [{ scale: scaleAnim }] }]}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', width: '100%', marginBottom: 16 }}>
            <View style={[S.tabRow, softGlass]}>
              {(['anonmesh', 'wallet'] as QRTab[]).map(t => (
                <Pressable
                  key={t}
                  onPress={() => setTab(t)}
                  style={[S.tabBtn, tab === t && accentGlass, tab === t && { borderRadius: radii.sm }]}
                >
                  <Text style={[S.tabText, { color: tab === t ? colors.primary : colors.textTertiary }]}>
                    {t.toUpperCase()}
                  </Text>
                </Pressable>
              ))}
            </View>
            <Pressable onPress={dismiss} style={[S.closeBtn, softGlass]}>
              <Feather name="x" size={14} color={colors.textSecondary} />
            </Pressable>
          </View>

          <View style={[S.qrWrap, { backgroundColor: colors.surface2, borderColor: tab === 'wallet' ? colors.primary + '40' : colors.border }]}>
            <QRCode size={220} data={qrData} />
          </View>

          <View style={{ alignItems: 'center', marginTop: 16, gap: 4, width: '100%' }}>
            <Text style={[S.handle, { color: colors.textPrimary }]}>{label}</Text>
          </View>

          <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
            {tab === 'anonmesh'
              ? <Pill label="anonmesh" variant="default" dot />
              : <Pill label="solana"   variant="primary"  dot />
            }
          </View>

          <Text style={[S.hint, { color: colors.textTertiary, marginTop: 14 }]}>
            TAP OUTSIDE TO CLOSE
          </Text>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

const S = StyleSheet.create({
  card:    { borderRadius: radii['2xl'], padding: 20, alignItems: 'center', marginHorizontal: 32 },
  tabRow:  { flexDirection: 'row', borderRadius: radii.md, padding: 3, gap: 2 },
  tabBtn:  { paddingHorizontal: 12, paddingVertical: 6 },
  tabText: { fontFamily: fontFamily.sansMd, fontSize: fontSize.xs, letterSpacing: 1.5, textTransform: 'uppercase' },
  qrWrap:  { padding: 10, borderRadius: radii.lg, borderWidth: 0.5, overflow: 'hidden' },
  handle:  { fontFamily: fontFamily.sansMd, fontSize: fontSize.md, letterSpacing: -0.3 },
  hint:    { fontFamily: fontFamily.sansMd, fontSize: 9.5, letterSpacing: 2, textTransform: 'uppercase' },
  closeBtn:{ width: 30, height: 30, borderRadius: radii.full, alignItems: 'center', justifyContent: 'center' },
});

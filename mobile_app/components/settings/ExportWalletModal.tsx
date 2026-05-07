import React, { useState, useRef, useEffect, useCallback } from 'react';
import { View, Text, Pressable, StyleSheet, Animated } from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import * as ScreenCapture from 'expo-screen-capture';
import { fontFamily, useTheme } from '@/theme';
import { useGlass } from '@/hooks/useGlass';
import { useWallet } from '@/context/WalletContext';
import { KeyBox } from './KeyBox';

export function ExportWalletModal({ onClose }: { onClose: () => void }) {
  const { colors } = useTheme();
  const softGlass = useGlass('soft');
  const { walletMode, exportPrivateKey } = useWallet();

  const [secretKey, setSecretKey] = useState<string | null>(null);
  const [revealed,  setRevealed]  = useState(false);
  const [loading,   setLoading]   = useState(false);
  const [failed,    setFailed]    = useState(false);
  const [keyCopied, setKeyCopied] = useState(false);
  const [copiedAck, setCopiedAck] = useState(false);
  const sheetAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(sheetAnim, { toValue: 1, useNativeDriver: true, bounciness: 4 }).start();
  }, [sheetAnim]);

  useEffect(() => {
    ScreenCapture.preventScreenCaptureAsync().catch(() => undefined);
    return () => {
      ScreenCapture.allowScreenCaptureAsync().catch(() => undefined);
    };
  }, []);

  const authenticate = useCallback(async () => {
    setLoading(true);
    setFailed(false);
    setCopiedAck(false);
    const key = await exportPrivateKey();
    if (key) { setSecretKey(key); } else { setFailed(true); }
    setLoading(false);
  }, [exportPrivateKey]);

  const copyKey = useCallback(async () => {
    if (!secretKey) return;
    await Clipboard.setStringAsync(secretKey);
    setKeyCopied(true);
    setTimeout(() => setKeyCopied(false), 1400);
  }, [secretKey]);

  const dismiss = () => {
    if (secretKey && !copiedAck) return;
    Animated.timing(sheetAnim, { toValue: 0, duration: 220, useNativeDriver: true }).start(onClose);
  };

  const sheetY    = sheetAnim.interpolate({ inputRange: [0, 1], outputRange: [600, 0], extrapolate: 'clamp' });
  const overlayOp = sheetAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 1],   extrapolate: 'clamp' });
  const masked    = secretKey ? '·'.repeat(secretKey.length) : '';

  return (
    <View style={S.overlayRoot}>
      <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(4,4,6,0.72)', opacity: overlayOp }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={dismiss} />
      </Animated.View>

      <Animated.View style={[S.sheet, { backgroundColor: colors.glass, borderColor: colors.border, transform: [{ translateY: sheetY }] }]}>
        <View style={[S.grab, { backgroundColor: 'rgba(255,255,255,0.18)' }]} />

        <View style={S.header}>
          <View>
            <Text style={[S.tag,   { color: colors.textTertiary }]}>EXPORT WALLET</Text>
            <Text style={[S.title, { color: colors.textPrimary }]}>
              {walletMode === 'mwa' ? 'not available' : 'recovery key'}
            </Text>
          </View>
          <Pressable onPress={dismiss} style={[S.closeBtn, softGlass]}>
            <Feather name="x" size={14} color={colors.textSecondary} />
          </Pressable>
        </View>

        {walletMode === 'mwa' ? (
          <View style={S.center}>
            <View style={[S.iconCircle, { backgroundColor: colors.surface1, borderWidth: 0.5, borderColor: colors.border }]}>
              <Feather name="lock" size={28} color={colors.textSecondary} />
            </View>
            <View style={{ alignItems: 'center', gap: 6 }}>
              <Text style={[S.successTitle, { color: colors.textPrimary }]}>MWA wallet</Text>
              <Text style={[S.subText, { color: colors.textSecondary }]}>
                Keys are secured by your Solana Mobile device.{'\n'}Private key export is not available.
              </Text>
            </View>
            <Pressable onPress={dismiss} style={[S.doneBtn, softGlass]}>
              <Text style={[S.doneBtnText, { color: colors.textSecondary }]}>CLOSE</Text>
            </Pressable>
          </View>
        ) : (
          <View style={{ gap: 14 }}>
            <View style={[S.warn, { backgroundColor: colors.error + '14', borderColor: colors.error + '38' }]}>
              <Feather name="alert-triangle" size={14} color={colors.error} style={{ marginTop: 1 }} />
              <Text style={[S.warnText, { color: colors.error }]}>
                No mnemonic exists for this wallet. This base58 recovery key controls the wallet; store it offline only.
              </Text>
            </View>

            <KeyBox
              loading={loading}
              secretKey={secretKey}
              revealed={revealed}
              copied={keyCopied}
              failed={failed}
              masked={masked}
              onAuthenticate={authenticate}
              onRevealIn={() => setRevealed(true)}
              onRevealOut={() => setRevealed(false)}
              onCopy={copyKey}
            />

            {!!secretKey && (
              <>
                <Text style={[S.hint, { color: colors.textTertiary, textAlign: 'center' }]}>
                  HOLD TO REVEAL · SCREENSHOTS BLOCKED · BASE58 ENCODED
                </Text>
                <Pressable
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: copiedAck }}
                  onPress={() => setCopiedAck(v => !v)}
                  style={[S.ackRow, { borderColor: copiedAck ? colors.primary + '66' : colors.border, backgroundColor: colors.surface1 }]}
                >
                  <Feather name={copiedAck ? 'check-square' : 'square'} size={14} color={copiedAck ? colors.primary : colors.textTertiary} />
                  <Text style={[S.ackText, { color: copiedAck ? colors.primary : colors.textSecondary }]}>
                    I copied this recovery key
                  </Text>
                </Pressable>
              </>
            )}

            <Pressable
              disabled={!!secretKey && !copiedAck}
              onPress={dismiss}
              style={[S.doneBtn, softGlass, { opacity: secretKey && !copiedAck ? 0.45 : 1 }]}
            >
              <Text style={[S.doneBtnText, { color: secretKey && !copiedAck ? colors.textTertiary : colors.textSecondary }]}>DONE</Text>
            </Pressable>
          </View>
        )}
      </Animated.View>
    </View>
  );
}

const S = StyleSheet.create({
  overlayRoot:  { bottom: 0, left: 0, position: 'absolute', right: 0, top: 0, zIndex: 20 },
  sheet:       { position: 'absolute', bottom: 0, left: 0, right: 0, borderRadius: 20, borderBottomLeftRadius: 0, borderBottomRightRadius: 0, padding: 14, paddingBottom: 28, borderWidth: 0.5 },
  grab:        { width: 36, height: 4, borderRadius: 99, alignSelf: 'center', marginBottom: 14 },
  header:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  tag:         { fontFamily: fontFamily.sansMd, fontSize: 9.5, letterSpacing: 2, textTransform: 'uppercase' },
  title:       { fontSize: 18, marginTop: 4, letterSpacing: -0.3 },
  closeBtn:    { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  center:      { paddingVertical: 24, alignItems: 'center', gap: 16 },
  iconCircle:  { width: 64, height: 64, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  successTitle:{ fontSize: 17, letterSpacing: -0.3, textAlign: 'center' },
  subText:     { fontFamily: fontFamily.sansMd, fontSize: 11.5, lineHeight: 18, textAlign: 'center' },
  warn:        { flexDirection: 'row', gap: 10, padding: 12, borderRadius: 12, borderWidth: 0.5 },
  warnText:    { flex: 1, fontFamily: fontFamily.sansMd, fontSize: 11, lineHeight: 17, letterSpacing: 0.2 },
  hint:        { fontFamily: fontFamily.sansMd, fontSize: 10, letterSpacing: 1 },
  ackRow:      { alignItems: 'center', borderRadius: 12, borderWidth: 0.5, flexDirection: 'row', gap: 8, justifyContent: 'center', padding: 12 },
  ackText:     { fontFamily: fontFamily.sansMd, fontSize: 11, letterSpacing: 0.8, textTransform: 'uppercase' },
  doneBtn:     { width: '100%', padding: 13, borderRadius: 12, alignItems: 'center', marginTop: 4 },
  doneBtnText: { fontFamily: fontFamily.sansMd, fontSize: 11, fontWeight: '600', letterSpacing: 3, textTransform: 'uppercase' },
});

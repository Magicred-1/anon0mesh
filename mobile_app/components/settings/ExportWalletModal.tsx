import React, { useState, useRef, useEffect, useCallback } from 'react';
import { AppState, View, Text, Pressable, StyleSheet, Animated } from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import * as ScreenCapture from 'expo-screen-capture';
import { fontFamily, useTheme } from '@/theme';
import { useGlass } from '@/hooks/useGlass';
import { useWallet } from '@/context/WalletContext';
import { useNetworkMode } from '@/src/hooks/useNetworkMode';
import { KeyBox } from './KeyBox';

type CaptureBlockState = 'pending' | 'blocked' | 'unavailable';

export function ExportWalletModal({ onClose }: { onClose: () => void }) {
  const { colors } = useTheme();
  const softGlass = useGlass('soft');
  const { walletMode, exportPrivateKey } = useWallet();
  // Surface a mainnet-specific reminder on top of the existing
  // recovery-key warning. T-WALLET-* threat-model family: a user who
  // graduated their wallet onto mainnet via the network switcher needs an
  // extra "these keys move real funds" prompt before they see the secret.
  const { cluster } = useNetworkMode();

  const [secretKey, setSecretKey] = useState<string | null>(null);
  const [revealed,  setRevealed]  = useState(false);
  const [loading,   setLoading]   = useState(false);
  const [failed,    setFailed]    = useState(false);
  const [failMessage, setFailMessage] = useState<string | null>(null);
  const [keyCopied, setKeyCopied] = useState(false);
  const [copiedAck, setCopiedAck] = useState(false);
  const [captureBlock, setCaptureBlock] = useState<CaptureBlockState>('pending');
  const sheetAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(sheetAnim, { toValue: 1, useNativeDriver: true, bounciness: 4 }).start();
  }, [sheetAnim]);

  // Track whether preventScreenCaptureAsync actually succeeded. Previously we
  // fired it and forgot — if it rejected (older OS, sandbox issue, race with
  // another capture-protected screen), the user could reveal a recovery key
  // with screenshots fully unblocked while the UI still claimed otherwise.
  // Now: pessimistically drop to 'pending' before each apply, gate the
  // authenticate tap and the secret render on confirmed 'blocked', scrub any
  // rendered secret if protection lapses, and re-apply prevention on AppState
  // foreground in case the OS dropped the flag while the app was backgrounded.
  useEffect(() => {
    let mounted = true;

    async function applyBlock() {
      // Reset before every attempt so the in-flight window between resume and
      // confirmed prevention can never render the secret with stale 'blocked'.
      if (mounted) setCaptureBlock('pending');
      try {
        await ScreenCapture.preventScreenCaptureAsync();
        if (mounted) setCaptureBlock('blocked');
      } catch {
        if (mounted) setCaptureBlock('unavailable');
      }
    }

    applyBlock();
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') applyBlock();
    });

    return () => {
      mounted = false;
      sub.remove();
      ScreenCapture.allowScreenCaptureAsync().catch(() => undefined);
    };
  }, []);

  // Drop any in-memory secret whenever capture protection isn't currently
  // confirmed-applied. Covers both 'unavailable' (prevention failed outright)
  // and 'pending' (in-flight reapply on AppState resume). User re-authenticates
  // after the window closes — strictly safer than holding the secret through
  // a moment when screenshots may not actually be blocked.
  useEffect(() => {
    if (captureBlock !== 'blocked' && (secretKey || revealed)) {
      setSecretKey(null);
      setRevealed(false);
      setCopiedAck(false);
      // Without this, the 1.4s `keyCopied` flag from a copy-then-background
      // can survive the scrub and the next reveal flashes a stale "COPIED"
      // badge on a freshly re-authenticated session.
      setKeyCopied(false);
    }
  }, [captureBlock, secretKey, revealed]);

  const authenticate = useCallback(async () => {
    if (captureBlock !== 'blocked') return;
    setLoading(true);
    setFailed(false);
    setFailMessage(null);
    setCopiedAck(false);
    setKeyCopied(false);
    const result = await exportPrivateKey();
    if (result.ok) {
      setSecretKey(result.secretKey);
    } else if (result.message) {
      setFailed(true);
      setFailMessage(result.message);
    }
    // result.ok === false with no message = user cancelled biometric.
    // Stay in initial state silently — re-prompting them with "try again" is
    // hostile when they meant to dismiss.
    setLoading(false);
  }, [exportPrivateKey, captureBlock]);

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
            {cluster === 'mainnet' ? (
              <View style={[S.warn, { backgroundColor: colors.warningSubtle, borderColor: colors.warning + '40' }]}>
                <Feather name="alert-triangle" size={14} color={colors.warning} style={{ marginTop: 1 }} />
                <Text style={[S.warnText, { color: colors.warning }]}>
                  Mainnet keys are real. This recovery key controls real funds. Anyone with it can drain the wallet — store it offline only.
                </Text>
              </View>
            ) : null}
            <View style={[S.warn, { backgroundColor: colors.error + '14', borderColor: colors.error + '38' }]}>
              <Feather name="alert-triangle" size={14} color={colors.error} style={{ marginTop: 1 }} />
              <Text style={[S.warnText, { color: colors.error }]}>
                This wallet does not use a 12- or 24-word seed phrase. The copied base58 recovery key is the backup; store it offline only.
              </Text>
            </View>

            {captureBlock === 'unavailable' ? (
              <View style={[S.warn, { backgroundColor: colors.error + '14', borderColor: colors.error + '38' }]}>
                <Feather name="alert-octagon" size={14} color={colors.error} style={{ marginTop: 1 }} />
                <Text style={[S.warnText, { color: colors.error }]}>
                  Secure window unavailable on this device. Recovery export is disabled because screenshots cannot be blocked here. Try again on another device, or close and reopen this screen.
                </Text>
              </View>
            ) : (
              <KeyBox
                loading={loading}
                secretKey={secretKey}
                revealed={revealed}
                copied={keyCopied}
                failed={failed}
                failMessage={failMessage}
                masked={masked}
                captureReady={captureBlock === 'blocked'}
                onAuthenticate={authenticate}
                onRevealIn={() => setRevealed(true)}
                onRevealOut={() => setRevealed(false)}
                onCopy={copyKey}
              />
            )}

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

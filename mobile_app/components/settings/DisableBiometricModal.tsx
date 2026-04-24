import React, { useEffect, useRef, useState } from 'react';
import { Animated, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import Reanimated, { FadeIn } from 'react-native-reanimated';
import { Feather } from '@expo/vector-icons';
import { fontFamily, useTheme } from '@/theme';
import { useGlass } from '@/hooks/useGlass';

const DISABLE_LINES = [
  'revoking biometric requirement…',
  'writing security policy to store…',
  'wallet unlock will bypass face id / pin…',
  'change anytime in settings…',
];

export function DisableBiometricModal({
  onClose,
  onConfirm,
}: {
  onClose: () => void;
  onConfirm: () => void;
}) {
  const { colors } = useTheme();
  const softGlass  = useGlass('soft');

  const [phase, setPhase] = useState<0 | 1 | 2>(0);
  const sheetAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(sheetAnim, { toValue: 1, useNativeDriver: true, bounciness: 4 }).start();
  }, [sheetAnim]);

  // Auto-advance from processing → done after lines finish
  useEffect(() => {
    if (phase !== 1) return;
    const t = setTimeout(() => setPhase(2), DISABLE_LINES.length * 320 + 400);
    return () => clearTimeout(t);
  }, [phase]);

  const dismiss = () => {
    Animated.timing(sheetAnim, { toValue: 0, duration: 220, useNativeDriver: true }).start(onClose);
  };

  const handleConfirm = () => {
    onConfirm();   // write flag to AsyncStorage via hook in SettingsScreen
    setPhase(1);
  };

  const sheetY    = sheetAnim.interpolate({ inputRange: [0, 1], outputRange: [600, 0], extrapolate: 'clamp' });
  const overlayOp = sheetAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 1],   extrapolate: 'clamp' });

  const phaseTitle = ['disable biometric', 'disabling…', 'biometric disabled'][phase];

  return (
    <Modal transparent animationType="none" onRequestClose={dismiss}>
      <View style={StyleSheet.absoluteFill}>
        <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(4,4,6,0.72)', opacity: overlayOp }]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={phase === 1 ? undefined : dismiss} />
        </Animated.View>

        <Animated.View style={[S.sheet, { backgroundColor: colors.glass, borderColor: colors.border, transform: [{ translateY: sheetY }] }]}>
          <View style={[S.grab, { backgroundColor: 'rgba(255,255,255,0.18)' }]} />

          <View style={S.header}>
            <View>
              <Text style={[S.tag,   { color: colors.textTertiary }]}>SECURITY SETTINGS</Text>
              <Text style={[S.title, { color: colors.textPrimary }]}>{phaseTitle}</Text>
            </View>
            {phase !== 1 && (
              <Pressable onPress={dismiss} style={[S.closeBtn, softGlass]}>
                <Feather name="x" size={14} color={colors.textSecondary} />
              </Pressable>
            )}
          </View>

          {/* Phase 0 — confirm */}
          {phase === 0 && (
            <View style={S.body}>
              <View style={[S.warnBox, { backgroundColor: colors.error + '12', borderColor: colors.error + '30' }]}>
                <Feather name="shield-off" size={22} color={colors.error} style={{ marginBottom: 10 }} />
                <Text style={[S.warnTitle, { color: colors.error }]}>DANGER — REDUCED SECURITY</Text>
                <Text style={[S.warnText, { color: colors.textSecondary }]}>
                  Disabling biometric means anyone with physical access to your unlocked device can open your wallet without authentication.{'\n\n'}
                  Export and transaction signing will still require biometric confirmation.
                </Text>
              </View>

              <View style={S.btnRow}>
                <Pressable onPress={dismiss} style={[S.cancelBtn, softGlass]}>
                  <Text style={[S.cancelText, { color: colors.textSecondary }]}>CANCEL</Text>
                </Pressable>
                <Pressable onPress={handleConfirm} style={[S.disableBtn, { backgroundColor: colors.error }]}>
                  <Feather name="shield-off" size={13} color="#fff" />
                  <Text style={S.disableBtnText}>DISABLE</Text>
                </Pressable>
              </View>
            </View>
          )}

          {/* Phase 1 — processing */}
          {phase === 1 && (
            <View style={{ padding: 20, gap: 10 }}>
              {DISABLE_LINES.map((line, i) => (
                <Reanimated.View key={i} entering={FadeIn.delay(i * 320).duration(300)}>
                  <Text style={[S.logLine, { color: colors.textSecondary }]}>
                    <Text style={{ color: colors.error }}>{'›  '}</Text>
                    {line}
                  </Text>
                </Reanimated.View>
              ))}
            </View>
          )}

          {/* Phase 2 — done */}
          {phase === 2 && (
            <View style={S.center}>
              <View style={[S.iconCircle, { backgroundColor: colors.error + '18', borderColor: colors.error + '30', borderWidth: 0.5 }]}>
                <Feather name="shield-off" size={28} color={colors.error} />
              </View>
              <View style={{ alignItems: 'center', gap: 6 }}>
                <Text style={[S.doneTitle, { color: colors.textPrimary }]}>biometric disabled</Text>
                <Text style={[S.doneSub, { color: colors.textTertiary }]}>
                  RE-ENABLE ANYTIME IN SETTINGS · EXPORT STILL REQUIRES AUTH
                </Text>
              </View>
              <Pressable onPress={dismiss} style={[S.doneBtn, { backgroundColor: colors.surface2, borderColor: colors.border, borderWidth: 0.5 }]}>
                <Text style={[S.doneBtnText, { color: colors.textSecondary }]}>DONE</Text>
              </Pressable>
            </View>
          )}
        </Animated.View>
      </View>
    </Modal>
  );
}

const S = StyleSheet.create({
  sheet:        { position: 'absolute', bottom: 0, left: 0, right: 0, borderRadius: 20, borderBottomLeftRadius: 0, borderBottomRightRadius: 0, padding: 14, paddingBottom: 36, borderWidth: 0.5 },
  grab:         { width: 36, height: 4, borderRadius: 99, alignSelf: 'center', marginBottom: 14 },
  header:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  tag:          { fontFamily: fontFamily.sansMd, fontSize: 9.5, letterSpacing: 2, textTransform: 'uppercase' },
  title:        { fontSize: 18, marginTop: 4, letterSpacing: -0.3 },
  closeBtn:     { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },

  body:         { gap: 16, paddingBottom: 4 },
  warnBox:      { borderRadius: 14, borderWidth: 0.5, padding: 16, alignItems: 'center', gap: 2 },
  warnTitle:    { fontFamily: fontFamily.sansMd, fontSize: 10, letterSpacing: 2.5, textTransform: 'uppercase', marginBottom: 6 },
  warnText:     { fontFamily: fontFamily.sansMd, fontSize: 12.5, lineHeight: 19, textAlign: 'center' },
  btnRow:       { flexDirection: 'row', gap: 8 },
  cancelBtn:    { flex: 1, padding: 13, borderRadius: 12, alignItems: 'center' },
  cancelText:   { fontFamily: fontFamily.sansMd, fontSize: 11, fontWeight: '600', letterSpacing: 2.5, textTransform: 'uppercase' },
  disableBtn:   { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, padding: 13, borderRadius: 12 },
  disableBtnText: { fontFamily: fontFamily.sansMd, fontSize: 11, fontWeight: '600', letterSpacing: 2.5, textTransform: 'uppercase', color: '#fff' },

  logLine:      { fontFamily: fontFamily.sansMd, fontSize: 11.5, letterSpacing: 0.3 },

  center:       { paddingVertical: 24, alignItems: 'center', gap: 16 },
  iconCircle:   { width: 64, height: 64, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  doneTitle:    { fontSize: 17, letterSpacing: -0.3 },
  doneSub:      { fontFamily: fontFamily.sansMd, fontSize: 9, letterSpacing: 1.5, textTransform: 'uppercase', textAlign: 'center', marginTop: 2, paddingHorizontal: 20 },
  doneBtn:      { width: '100%', padding: 13, borderRadius: 12, alignItems: 'center', marginTop: 4 },
  doneBtnText:  { fontFamily: fontFamily.sansMd, fontSize: 11, fontWeight: '600', letterSpacing: 3, textTransform: 'uppercase' },
});

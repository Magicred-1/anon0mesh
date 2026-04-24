import React, { useState, useRef, useEffect } from 'react';
import { View, Text, Pressable, Modal, StyleSheet, Animated } from 'react-native';
import Reanimated, { FadeIn } from 'react-native-reanimated';
import { Feather } from '@expo/vector-icons';
import { fontFamily, useTheme } from '@/theme';
import { useGlass } from '@/hooks/useGlass';
import { useLxmfContext } from '@/context/LxmfContext';

const ROTATE_LINES = [
  'wiping ed25519 keypair from secure store…',
  'clearing lxmf address binding…',
  'purging peer cache…',
  'generating new ed25519 identity…',
  'deriving new lxmf address…',
  'announcing to mesh…',
];

export function RotateKeypairModal({ onClose }: { onClose: () => void }) {
  const { colors } = useTheme();
  const accentGlass = useGlass('accent');
  const softGlass   = useGlass('soft');

  const { resetIdentity, status } = useLxmfContext();

  const [phase,   setPhase]   = useState<0 | 1 | 2>(0); // 0=confirm 1=rotating 2=done
  const [newAddr, setNewAddr] = useState('');
  const sheetAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(sheetAnim, { toValue: 1, useNativeDriver: true, bounciness: 4 }).start();
  }, [sheetAnim]);

  // After reset, node restarts and emits new addressHex — capture it
  useEffect(() => {
    if (phase === 1 && status?.addressHex && status.addressHex !== '') {
      const timer = setTimeout(() => {
        setNewAddr(status.addressHex ?? '');
        setPhase(2);
      }, ROTATE_LINES.length * 320 + 400);
      return () => clearTimeout(timer);
    }
  }, [phase, status?.addressHex]);

  const dismiss = () => {
    Animated.timing(sheetAnim, { toValue: 0, duration: 220, useNativeDriver: true }).start(onClose);
  };

  const confirmRotate = async () => {
    setPhase(1);
    await resetIdentity();
  };

  const sheetY    = sheetAnim.interpolate({ inputRange: [0, 1], outputRange: [600, 0], extrapolate: 'clamp' });
  const overlayOp = sheetAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 1],   extrapolate: 'clamp' });

  const phaseTitle = ['rotate keypair', 'rotating…', 'new identity active'][phase];

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
              <Text style={[S.tag,   { color: colors.textTertiary }]}>LXMF IDENTITY</Text>
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
            <View style={S.confirmBody}>
              <View style={[S.warnBox, { backgroundColor: colors.error + '12', borderColor: colors.error + '30' }]}>
                <Feather name="alert-triangle" size={18} color={colors.error} style={{ marginBottom: 10 }} />
                <Text style={[S.warnTitle, { color: colors.error }]}>IRREVERSIBLE ACTION</Text>
                <Text style={[S.warnText,  { color: colors.textSecondary }]}>
                  Your current LXMF address will be permanently discarded. Peers who know your old address will not be able to reach you. Your display name carries over.
                </Text>
              </View>

              <View style={S.btnRow}>
                <Pressable onPress={dismiss} style={[S.cancelBtn, softGlass]}>
                  <Text style={[S.cancelText, { color: colors.textSecondary }]}>CANCEL</Text>
                </Pressable>
                <Pressable onPress={confirmRotate} style={[S.rotateBtn, { backgroundColor: colors.error }]}>
                  <Feather name="refresh-cw" size={13} color="#fff" />
                  <Text style={S.rotateBtnText}>ROTATE</Text>
                </Pressable>
              </View>
            </View>
          )}

          {/* Phase 1 — rotating */}
          {phase === 1 && (
            <View style={{ padding: 20, gap: 10 }}>
              {ROTATE_LINES.map((line, i) => (
                <Reanimated.View key={i} entering={FadeIn.delay(i * 320).duration(300)}>
                  <Text style={[S.logLine, { color: colors.textSecondary }]}>
                    <Text style={{ color: colors.primary }}>{'›  '}</Text>
                    {line}
                  </Text>
                </Reanimated.View>
              ))}
            </View>
          )}

          {/* Phase 2 — done */}
          {phase === 2 && (
            <View style={S.center}>
              <View style={[S.iconCircle, accentGlass]}>
                <Feather name="check" size={30} color={colors.primary} />
              </View>
              <View style={{ alignItems: 'center', gap: 4 }}>
                <Text style={[S.successTitle, { color: colors.textPrimary }]}>new identity ready</Text>
                {newAddr !== '' && (
                  <Text style={[S.newAddr, { color: colors.textTertiary }]}>
                    {newAddr.slice(0, 8)}…{newAddr.slice(-6)}
                  </Text>
                )}
                <Text style={[S.successSub, { color: colors.textTertiary }]}>
                  announcing to mesh · old address gone
                </Text>
              </View>
              <Pressable onPress={dismiss} style={[S.doneBtn, { backgroundColor: colors.primary }]}>
                <Text style={[S.doneBtnText, { color: colors.background }]}>DONE</Text>
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

  confirmBody:  { gap: 16, paddingBottom: 4 },
  warnBox:      { borderRadius: 14, borderWidth: 0.5, padding: 16, alignItems: 'center', gap: 2 },
  warnTitle:    { fontFamily: fontFamily.sansMd, fontSize: 10, letterSpacing: 2.5, textTransform: 'uppercase', marginBottom: 6 },
  warnText:     { fontFamily: fontFamily.sansMd, fontSize: 12.5, lineHeight: 19, textAlign: 'center' },
  btnRow:       { flexDirection: 'row', gap: 8 },
  cancelBtn:    { flex: 1, padding: 13, borderRadius: 12, alignItems: 'center' },
  cancelText:   { fontFamily: fontFamily.sansMd, fontSize: 11, fontWeight: '600', letterSpacing: 2.5, textTransform: 'uppercase' },
  rotateBtn:    { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, padding: 13, borderRadius: 12 },
  rotateBtnText:{ fontFamily: fontFamily.sansMd, fontSize: 11, fontWeight: '600', letterSpacing: 2.5, textTransform: 'uppercase', color: '#fff' },

  logLine:      { fontFamily: fontFamily.sansMd, fontSize: 11.5, letterSpacing: 0.3 },

  center:       { paddingVertical: 24, alignItems: 'center', gap: 16 },
  iconCircle:   { width: 64, height: 64, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  successTitle: { fontSize: 17, letterSpacing: -0.3, textAlign: 'center' },
  newAddr:      { fontFamily: fontFamily.sansMd, fontSize: 11, letterSpacing: 1 },
  successSub:   { fontFamily: fontFamily.sansMd, fontSize: 9.5, letterSpacing: 1.5, textTransform: 'uppercase', marginTop: 2 },
  doneBtn:      { width: '100%', padding: 13, borderRadius: 12, alignItems: 'center', marginTop: 4 },
  doneBtnText:  { fontFamily: fontFamily.sansMd, fontSize: 11, fontWeight: '600', letterSpacing: 3, textTransform: 'uppercase' },
});

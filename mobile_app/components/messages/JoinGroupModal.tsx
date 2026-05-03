import React, { useState, useRef, useEffect } from 'react';
import {
  Modal, View, Text, TextInput, Pressable,
  StyleSheet, Animated, ActivityIndicator, Platform, Keyboard,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { fontFamily, useTheme } from '@/theme';
import { useGlass } from '@/hooks/useGlass';
import { QRScannerModal } from './QRScannerModal';

interface Props {
  readonly visible:  boolean;
  readonly onClose:  () => void;
  readonly onJoin:   (addrHex: string, keyHex: string, name?: string) => Promise<boolean>;
}

const ADDR_RE = /^[0-9a-fA-F]{32}$/;
const KEY_RE  = /^[0-9a-fA-F]{32}$/;

export function JoinGroupModal({ visible, onClose, onJoin }: Props) {
  const { colors }  = useTheme();
  const baseGlass   = useGlass();
  const softGlass   = useGlass('soft');

  const [addrHex, setAddrHex] = useState('');
  const [keyHex,  setKeyHex]  = useState('');
  const [name,    setName]    = useState('');
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<string | null>(null);
  const [scanner, setScanner] = useState(false);

  const sheetAnim = useRef(new Animated.Value(0)).current;
  const kbOffset  = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.spring(sheetAnim, { toValue: 1, useNativeDriver: true, bounciness: 4 }).start();
    }
  }, [visible, sheetAnim]);

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const show = Keyboard.addListener(showEvent, e => {
      Animated.timing(kbOffset, {
        toValue: e.endCoordinates.height,
        duration: Platform.OS === 'ios' ? e.duration : 150,
        useNativeDriver: false,
      }).start();
    });
    const hide = Keyboard.addListener(hideEvent, e => {
      Animated.timing(kbOffset, {
        toValue: 0,
        duration: Platform.OS === 'ios' ? e.duration : 150,
        useNativeDriver: false,
      }).start();
    });
    return () => { show.remove(); hide.remove(); };
  }, [kbOffset]);

  const addrOk = ADDR_RE.test(addrHex.trim());
  const keyOk  = KEY_RE.test(keyHex.trim());
  const canJoin = addrOk && keyOk && !loading;

  async function handleJoin() {
    if (!canJoin) return;
    setError(null);
    setLoading(true);
    try {
      const ok = await onJoin(addrHex.trim(), keyHex.trim(), name.trim() || undefined);
      if (ok) { dismiss(); }
      else    { setError('could not join — check address and key'); }
    } catch {
      setError('join failed — try again');
    } finally {
      setLoading(false);
    }
  }

  function dismiss() {
    Keyboard.dismiss();
    Animated.timing(sheetAnim, { toValue: 0, duration: 220, useNativeDriver: true }).start(() => {
      setAddrHex('');
      setKeyHex('');
      setName('');
      setError(null);
      onClose();
    });
  }

  const sheetY    = sheetAnim.interpolate({ inputRange: [0, 1], outputRange: [500, 0], extrapolate: 'clamp' });
  const overlayOp = sheetAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 1], extrapolate: 'clamp' });

  return (
    <>
      <Modal transparent animationType="none" visible={visible} onRequestClose={dismiss}>
        <View style={StyleSheet.absoluteFill}>
          <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(4,4,6,0.72)', opacity: overlayOp }]}>
            <Pressable style={StyleSheet.absoluteFill} onPress={dismiss} />
          </Animated.View>

          <Animated.View style={[S.sheetWrap, { marginBottom: kbOffset }]}>
            <Animated.View style={[S.sheet, { backgroundColor: colors.glass, borderColor: colors.border, transform: [{ translateY: sheetY }] }]}>
              <View style={[S.grab, { backgroundColor: 'rgba(255,255,255,0.18)' }]} />

              <View style={S.header}>
                <View>
                  <Text style={[S.tag,   { color: colors.textTertiary }]}>CHANNELS</Text>
                  <Text style={[S.title, { color: colors.textPrimary }]}>join channel</Text>
                </View>
                <Pressable onPress={dismiss} style={[S.closeBtn, softGlass]}>
                  <Feather name="x" size={14} color={colors.textSecondary} />
                </Pressable>
              </View>

              <View style={{ gap: 10 }}>
                {/* Prominent QR scan button */}
                <Pressable onPress={() => setScanner(true)} style={[S.scanBtn, baseGlass]}>
                  <Feather name="camera" size={18} color={colors.primary} />
                  <Text style={[S.scanBtnText, { color: colors.primary }]}>SCAN QR CODE</Text>
                </Pressable>

                <View style={S.orRow}>
                  <View style={[S.orLine, { backgroundColor: colors.border }]} />
                  <Text style={[S.orText, { color: colors.textTertiary }]}>OR ENTER MANUALLY</Text>
                  <View style={[S.orLine, { backgroundColor: colors.border }]} />
                </View>

                <Text style={[S.fieldLabel, { color: colors.textTertiary }]}>CHANNEL ADDRESS</Text>
                <View style={[S.inputRow, baseGlass, addrHex && !addrOk ? { borderColor: '#FF4444', borderWidth: 0.5 } : {}]}>
                  <TextInput
                    style={[S.input, { color: colors.textPrimary }]}
                    placeholder="32-hex address…"
                    placeholderTextColor={colors.textTertiary}
                    value={addrHex}
                    onChangeText={t => { setAddrHex(t); setError(null); }}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                </View>

                <Text style={[S.fieldLabel, { color: colors.textTertiary }]}>ENCRYPTION KEY</Text>
                <View style={[S.inputRow, baseGlass, keyHex && !keyOk ? { borderColor: '#FF4444', borderWidth: 0.5 } : {}]}>
                  <TextInput
                    style={[S.input, { color: colors.textPrimary }]}
                    placeholder="32-hex key…"
                    placeholderTextColor={colors.textTertiary}
                    value={keyHex}
                    onChangeText={t => { setKeyHex(t); setError(null); }}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                </View>

                <Text style={[S.fieldLabel, { color: colors.textTertiary }]}>
                  NICKNAME{'  '}<Text style={{ letterSpacing: 0, textTransform: 'none', fontSize: 9 }}>(optional)</Text>
                </Text>
                <View style={[S.inputRow, baseGlass]}>
                  <Feather name="hash" size={14} color={colors.textTertiary} />
                  <TextInput
                    style={[S.input, { color: colors.textPrimary }]}
                    placeholder="e.g. ops-team"
                    placeholderTextColor={colors.textTertiary}
                    value={name}
                    onChangeText={setName}
                    autoCapitalize="none"
                    autoCorrect={false}
                    returnKeyType="done"
                    onSubmitEditing={handleJoin}
                  />
                </View>

                {!!error && (
                  <Text style={[S.hint, { color: '#FF4444', textAlign: 'center' }]}>{error}</Text>
                )}

                <Pressable
                  onPress={handleJoin}
                  disabled={!canJoin}
                  style={[S.actionBtn, { backgroundColor: colors.primary, opacity: canJoin ? 1 : 0.4, marginTop: 4 }]}
                >
                  {loading
                    ? <ActivityIndicator color="#08080A" size="small" />
                    : <Text style={[S.actionBtnText, { color: '#08080A' }]}>JOIN CHANNEL</Text>
                  }
                </Pressable>
              </View>
            </Animated.View>
          </Animated.View>
        </View>
      </Modal>

      <QRScannerModal
        visible={scanner}
        onClose={() => setScanner(false)}
        onResult={r => {
          setScanner(false);
          if (r.type === 'lxmf-group') {
            setAddrHex(r.addrHex);
            setKeyHex(r.keyHex);
            if (r.name && !name) setName(r.name);
            setError(null);
          } else if (r.type === 'lxmf') {
            setAddrHex(r.hash);
            setError(null);
          }
        }}
      />
    </>
  );
}

const S = StyleSheet.create({
  scanBtn:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, borderRadius: 12 },
  scanBtnText:   { fontFamily: fontFamily.sansMd, fontSize: 12, fontWeight: '600', letterSpacing: 2, textTransform: 'uppercase' },
  orRow:         { flexDirection: 'row', alignItems: 'center', gap: 8 },
  orLine:        { flex: 1, height: 0.5 },
  orText:        { fontFamily: fontFamily.sansMd, fontSize: 9, letterSpacing: 1.5, textTransform: 'uppercase' },
  sheetWrap:     { position: 'absolute', bottom: 0, left: 0, right: 0 },
  sheet:         { borderRadius: 20, borderBottomLeftRadius: 0, borderBottomRightRadius: 0, padding: 14, paddingBottom: 32, borderWidth: 0.5 },
  grab:          { width: 36, height: 4, borderRadius: 99, alignSelf: 'center', marginBottom: 14 },
  header:        { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  tag:           { fontFamily: fontFamily.sansMd, fontSize: 9.5, letterSpacing: 2, textTransform: 'uppercase' },
  title:         { fontSize: 18, marginTop: 4, letterSpacing: -0.3 },
  closeBtn:      { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  fieldLabel:    { fontFamily: fontFamily.sansMd, fontSize: 9.5, letterSpacing: 2, textTransform: 'uppercase' },
  inputRow:      { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: Platform.OS === 'ios' ? 13 : 10, borderRadius: 12 },
  input:         { flex: 1, fontSize: 14, fontFamily: fontFamily.sansMd, padding: 0 },
  hint:          { fontFamily: fontFamily.sansMd, fontSize: 10.5, letterSpacing: 0.2 },
  actionBtn:     { padding: 13, borderRadius: 12, alignItems: 'center' },
  actionBtnText: { fontFamily: fontFamily.sansMd, fontSize: 11, fontWeight: '600', letterSpacing: 2.5, textTransform: 'uppercase' },
});

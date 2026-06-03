import { router } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated, BackHandler, View, Text, TextInput, Pressable,
  StyleSheet, ActivityIndicator, Platform, Keyboard,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { fontFamily, useTheme } from '@/theme';
import { useGlass } from '@/hooks/useGlass';
import { useLxmfContext } from '@/context/LxmfContext';
import { scan } from '@/src/services/qrScan';

const ADDR_RE = /^[0-9a-fA-F]{32}$/;
const KEY_RE  = /^[0-9a-fA-F]{32}$/;

// Join-channel as a route, not a <Modal>. It owns its slide-up/down animation
// exactly like app/receive.tsx: presentation 'transparentModal' + animation
// 'none' (set in _layout) means there's no native modal motion to fight.
// Being a route is what lets the QR scanner route (scan()) compose cleanly on
// top — pushing a route over a route never conflicts, so the old "hide the
// sheet while scanning" workaround is gone. The screen behind stays mounted
// underneath; popping the scanner reveals this sheet instantly.
export default function JoinChannelScreen() {
  const { colors }    = useTheme();
  const baseGlass     = useGlass();
  const softGlass     = useGlass('soft');
  const { joinGroup } = useLxmfContext();

  const [addrHex, setAddrHex] = useState('');
  const [keyHex,  setKeyHex]  = useState('');
  const [name,    setName]    = useState('');
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<string | null>(null);

  const sheetAnim  = useRef(new Animated.Value(0)).current;
  const kbOffset   = useRef(new Animated.Value(0)).current;
  const closingRef = useRef(false);

  // Enter: slide up on mount.
  useEffect(() => {
    Animated.spring(sheetAnim, { toValue: 1, useNativeDriver: true, bounciness: 4 }).start();
  }, [sheetAnim]);

  // Keyboard avoidance — lift the sheet by the keyboard height.
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

  // Exit: slide down, then pop the route. animation:'none' on the route means
  // router.back() is instant — the slide-down is the only motion the user sees.
  const dismiss = useCallback(() => {
    if (closingRef.current) return;
    closingRef.current = true;
    Keyboard.dismiss();
    Animated.timing(sheetAnim, { toValue: 0, duration: 220, useNativeDriver: true }).start(() => {
      if (router.canGoBack()) router.back();
    });
  }, [sheetAnim]);

  // Android hardware back → animated dismiss (not an instant pop).
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => { dismiss(); return true; });
    return () => sub.remove();
  }, [dismiss]);

  async function handleScan() {
    const r = await scan();
    if (!r) return;
    if (r.type === 'lxmf-group') {
      setAddrHex(r.addrHex);
      setKeyHex(r.keyHex);
      const nm = r.name;
      if (nm) setName(prev => (prev ? prev : nm));
      setError(null);
    } else if (r.type === 'lxmf') {
      setAddrHex(r.hash);
      setError(null);
    }
  }

  const addrOk  = ADDR_RE.test(addrHex.trim());
  const keyOk   = KEY_RE.test(keyHex.trim());
  const canJoin = addrOk && keyOk && !loading;

  async function handleJoin() {
    if (!canJoin) return;
    setError(null);
    setLoading(true);
    try {
      const ok = await joinGroup(addrHex.trim(), keyHex.trim(), name.trim() || undefined);
      if (ok) { dismiss(); }
      else    { setError('could not join — check address and key'); }
    } catch {
      setError('join failed — try again');
    } finally {
      setLoading(false);
    }
  }

  const sheetY    = sheetAnim.interpolate({ inputRange: [0, 1], outputRange: [500, 0], extrapolate: 'clamp' });
  const overlayOp = sheetAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 1], extrapolate: 'clamp' });

  return (
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
            <Pressable onPress={handleScan} style={[S.scanBtn, baseGlass]}>
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

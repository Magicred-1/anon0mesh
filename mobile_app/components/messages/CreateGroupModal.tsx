import React, { useState, useRef, useEffect } from 'react';
import {
  Modal, View, Text, TextInput, Pressable,
  StyleSheet, Animated, ActivityIndicator, Platform, Keyboard,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import * as ScreenCapture from 'expo-screen-capture';
import { Feather } from '@expo/vector-icons';
import { fontFamily, fontSize, radii, useTheme } from '@/theme';
import { useGlass } from '@/hooks/useGlass';
import { QRCode } from '@/components/settings/QRCode';
import type { LxmfGroup } from '@/context/LxmfContext';

// See ChannelShareSheet for the same constant — clipboard auto-wipe window
// for the AES-128 channel key (AUDIT T19).
const CLIPBOARD_AUTO_CLEAR_MS = 60_000;

interface Props {
  readonly visible:  boolean;
  readonly onClose:  () => void;
  readonly onCreate: (name: string) => Promise<LxmfGroup>;
}

export function CreateGroupModal({ visible, onClose, onCreate }: Props) {
  const { colors }  = useTheme();
  const baseGlass   = useGlass();
  const accentGlass = useGlass('accent');
  const softGlass   = useGlass('soft');

  const [name,    setName]    = useState('');
  const [loading, setLoading] = useState(false);
  const [result,  setResult]  = useState<LxmfGroup | null>(null);
  const [copied,  setCopied]  = useState<'addr' | 'key' | null>(null);

  const sheetAnim = useRef(new Animated.Value(0)).current;
  const kbOffset  = useRef(new Animated.Value(0)).current;
  const clipboardClearTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (visible) {
      Animated.spring(sheetAnim, { toValue: 1, useNativeDriver: true, bounciness: 4 }).start();
    }
  }, [visible, sheetAnim]);

  // Block screen capture while modal is visible — applies to both phases, but
  // matters most when the AES-128 channel key is on-screen in the 'done' phase
  // (AUDIT T19). Cheaper to keep on for the whole lifecycle than to flip it
  // mid-flow.
  useEffect(() => {
    if (!visible) return;
    ScreenCapture.preventScreenCaptureAsync().catch(() => {});
    return () => {
      ScreenCapture.allowScreenCaptureAsync().catch(() => {});
    };
  }, [visible]);

  // Clear any pending clipboard-wipe timer on unmount.
  useEffect(() => {
    return () => {
      if (clipboardClearTimerRef.current) {
        clearTimeout(clipboardClearTimerRef.current);
        clipboardClearTimerRef.current = null;
      }
    };
  }, []);

  // Lift sheet above keyboard — Keyboard events work inside Modal; KAV does not.
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

  async function handleCreate() {
    const trimmed = name.trim();
    if (!trimmed || loading) return;
    setLoading(true);
    try {
      const g = await onCreate(trimmed);
      setResult(g);
    } catch {
      // stay on input phase — user can retry
    } finally {
      setLoading(false);
    }
  }

  function dismiss() {
    Keyboard.dismiss();
    Animated.timing(sheetAnim, { toValue: 0, duration: 220, useNativeDriver: true }).start(() => {
      setName('');
      setResult(null);
      setCopied(null);
      onClose();
    });
  }

  async function copy(text: string, which: 'addr' | 'key') {
    await Clipboard.setStringAsync(text);
    setCopied(which);
    setTimeout(() => setCopied(null), 1800);

    // Auto-wipe clipboard after CLIPBOARD_AUTO_CLEAR_MS (AUDIT T19). Reset
    // on every copy so the wipe is measured from the most recent paste action.
    if (clipboardClearTimerRef.current) clearTimeout(clipboardClearTimerRef.current);
    clipboardClearTimerRef.current = setTimeout(() => {
      Clipboard.setStringAsync('').catch(() => {});
      clipboardClearTimerRef.current = null;
    }, CLIPBOARD_AUTO_CLEAR_MS);
  }

  const sheetY    = sheetAnim.interpolate({ inputRange: [0, 1], outputRange: [500, 0], extrapolate: 'clamp' });
  const overlayOp = sheetAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 1], extrapolate: 'clamp' });

  const phase = result ? 'done' : 'input';

  return (
    <Modal transparent animationType="none" visible={visible} onRequestClose={dismiss}>
      <View style={StyleSheet.absoluteFill}>
        <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: colors.overlay, opacity: overlayOp }]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={dismiss} />
        </Animated.View>

        <Animated.View style={[S.sheetWrap, { marginBottom: kbOffset }]}>
          <Animated.View style={[S.sheet, { backgroundColor: colors.glass, borderColor: colors.border, transform: [{ translateY: sheetY }] }]}>
            <View style={[S.grab, { backgroundColor: 'rgba(255,255,255,0.18)' }]} />

            <View style={S.header}>
              <View>
                <Text style={[S.tag,   { color: colors.textTertiary }]}>CHANNELS</Text>
                <Text style={[S.title, { color: colors.textPrimary }]}>{phase === 'done' ? 'channel created' : 'create channel'}</Text>
              </View>
              <Pressable onPress={dismiss} style={[S.closeBtn, softGlass]}>
                <Feather name="x" size={14} color={colors.textSecondary} />
              </Pressable>
            </View>

            {phase === 'input' && (
              <View style={{ gap: 10 }}>
                <Text style={[S.fieldLabel, { color: colors.textTertiary }]}>CHANNEL NAME</Text>
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
                    onSubmitEditing={handleCreate}
                  />
                </View>
                <Text style={[S.hint, { color: colors.textTertiary }]}>
                  Encryption key generated automatically — share address + key with members.
                </Text>
                <Pressable
                  onPress={handleCreate}
                  disabled={!name.trim() || loading}
                  style={[S.actionBtn, { backgroundColor: colors.primary, opacity: !name.trim() || loading ? 0.45 : 1 }]}
                >
                  {loading
                    ? <ActivityIndicator color={colors.background} size="small" />
                    : <Text style={[S.actionBtnText, { color: colors.background }]}>CREATE CHANNEL</Text>
                  }
                </Pressable>
              </View>
            )}

            {phase === 'done' && result && (() => {
              const groupUri = `lxmf://group/${result.addrHex}/${result.keyHex}?name=${encodeURIComponent(result.name)}`;
              return (
                <View style={{ gap: 10 }}>
                  <View style={[S.successRow, accentGlass]}>
                    <Feather name="check-circle" size={16} color={colors.primary} />
                    <Text style={[S.successText, { color: colors.primary }]}>Scan or copy to invite members</Text>
                  </View>

                  <View style={S.qrWrap}>
                    <QRCode size={200} data={groupUri} />
                  </View>

                  {/* Honesty row (AUDIT T19): copied key sits in OS clipboard
                      in plaintext; we wipe it 60s after the last copy. */}
                  <View style={S.warnRow}>
                    <Feather name="clock" size={10} color={colors.textTertiary} />
                    <Text style={[S.warnText, { color: colors.textTertiary }]}>
                      key copied to clipboard auto-clears in 60s
                    </Text>
                  </View>

                  <Text style={[S.fieldLabel, { color: colors.textTertiary }]}>CHANNEL ADDRESS</Text>
                  <Pressable onPress={() => copy(result.addrHex, 'addr')} style={[S.copyRow, baseGlass]}>
                    <Text style={[S.mono, { color: colors.textPrimary }]} numberOfLines={1} ellipsizeMode="middle">
                      {result.addrHex}
                    </Text>
                    <Feather name={copied === 'addr' ? 'check' : 'copy'} size={13} color={copied === 'addr' ? colors.primary : colors.textTertiary} />
                  </Pressable>

                  <Text style={[S.fieldLabel, { color: colors.textTertiary }]}>ENCRYPTION KEY</Text>
                  <Pressable onPress={() => copy(result.keyHex, 'key')} style={[S.copyRow, baseGlass]}>
                    <Text style={[S.mono, { color: colors.textPrimary }]} numberOfLines={1} ellipsizeMode="middle">
                      {result.keyHex}
                    </Text>
                    <Feather name={copied === 'key' ? 'check' : 'copy'} size={13} color={copied === 'key' ? colors.primary : colors.textTertiary} />
                  </Pressable>

                  <Pressable onPress={dismiss} style={[S.actionBtn, { backgroundColor: colors.primary }]}>
                    <Text style={[S.actionBtnText, { color: colors.background }]}>DONE</Text>
                  </Pressable>
                </View>
              );
            })()}
          </Animated.View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const S = StyleSheet.create({
  sheetWrap:     { position: 'absolute', bottom: 0, left: 0, right: 0 },
  sheet:         { borderRadius: radii.xl, borderBottomLeftRadius: 0, borderBottomRightRadius: 0, padding: 14, paddingBottom: 32, borderWidth: 0.5 },
  grab:          { width: 36, height: 4, borderRadius: radii.full, alignSelf: 'center', marginBottom: 14 },
  header:        { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  tag:           { fontFamily: fontFamily.sansMd, fontSize: 9.5, letterSpacing: 2, textTransform: 'uppercase' },
  title:         { fontSize: fontSize.lg, marginTop: 4, letterSpacing: -0.3 },
  closeBtn:      { width: 30, height: 30, borderRadius: radii.full, alignItems: 'center', justifyContent: 'center' },
  fieldLabel:    { fontFamily: fontFamily.sansMd, fontSize: 9.5, letterSpacing: 2, textTransform: 'uppercase' },
  inputRow:      { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: Platform.OS === 'ios' ? 13 : 10, borderRadius: radii.md },
  input:         { flex: 1, fontSize: fontSize.md, fontFamily: fontFamily.sansMd, padding: 0 },
  hint:          { fontFamily: fontFamily.sansMd, fontSize: 10.5, letterSpacing: 0.2, paddingHorizontal: 2 },
  actionBtn:     { padding: 13, borderRadius: radii.md, alignItems: 'center', marginTop: 4 },
  actionBtnText: { fontFamily: fontFamily.sansMd, fontSize: fontSize.xs, fontWeight: '600', letterSpacing: 2.5, textTransform: 'uppercase' },
  qrWrap:        { alignItems: 'center', paddingVertical: 8 },
  successRow:    { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 11, borderRadius: radii.md },
  successText:   { fontFamily: fontFamily.sansMd, fontSize: fontSize.xs, letterSpacing: 0.3 },
  copyRow:       { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 11, borderRadius: radii.md },
  mono:          { fontFamily: fontFamily.sansMd, fontSize: fontSize.xs, flex: 1 },
  warnRow:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, marginTop: -2, marginBottom: 4 },
  warnText:      { fontFamily: fontFamily.sansMd, fontSize: 9.5, letterSpacing: 0.5, textTransform: 'lowercase' },
});

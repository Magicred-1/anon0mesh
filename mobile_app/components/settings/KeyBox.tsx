import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { fontFamily, useTheme } from '@/theme';
import { formatRecoveryKey } from '@/src/utils/recoveryKey';

export interface KeyBoxProps {
  loading: boolean;
  secretKey: string | null;
  revealed: boolean;
  copied: boolean;
  failed: boolean;
  masked: string;
  onAuthenticate: () => void;
  onRevealIn: () => void;
  onRevealOut: () => void;
  onCopy: () => void;
}

export function KeyBox({
  loading, secretKey, revealed, copied, failed, masked,
  onAuthenticate, onRevealIn, onRevealOut, onCopy,
}: Readonly<KeyBoxProps>) {
  const { colors } = useTheme();

  if (loading) {
    return (
      <View style={[S.box, { backgroundColor: colors.surface0, borderColor: colors.border }]}>
        <Text style={[S.hint, { color: colors.textTertiary }]}>AUTHENTICATING…</Text>
      </View>
    );
  }

  if (secretKey) {
    return (
      <View style={[S.box, { backgroundColor: colors.surface0, borderColor: revealed ? colors.primary + '60' : colors.border }]}>
        <Pressable onPressIn={onRevealIn} onPressOut={onRevealOut} style={{ width: '100%', alignItems: 'center' }}>
          <Text style={[S.key, { color: revealed ? colors.textPrimary : colors.textTertiary, letterSpacing: revealed ? 0 : 2 }]}>
            {revealed ? formatRecoveryKey(secretKey) : formatRecoveryKey(masked)}
          </Text>
        </Pressable>
        <Pressable onPress={onCopy} style={[S.copyBtn, { borderColor: colors.border, backgroundColor: colors.surface1 }]}>
          <Feather name={copied ? 'check' : 'copy'} size={11} color={copied ? colors.primary : colors.textTertiary} />
          <Text style={[S.hint, { color: copied ? colors.primary : colors.textTertiary }]}>
            {copied ? 'COPIED' : 'COPY'}
          </Text>
        </Pressable>
      </View>
    );
  }

  if (failed) {
    return (
      <View style={[S.box, { backgroundColor: colors.error + '0D', borderColor: colors.error + '38' }]}>
        <Text style={[S.hint, { color: colors.error, textAlign: 'center', lineHeight: 18 }]}>
          KEY UNAVAILABLE{'\n'}Try again when ready
        </Text>
      </View>
    );
  }

  return (
    <Pressable onPress={onAuthenticate} style={[S.box, { backgroundColor: colors.surface0, borderColor: colors.border }]}>
      <Feather name="lock" size={16} color={colors.textTertiary} style={{ marginBottom: 6 }} />
      <Text style={[S.hint, { color: colors.textTertiary }]}>TAP TO AUTHENTICATE</Text>
    </Pressable>
  );
}

const S = StyleSheet.create({
  box:     { padding: 14, borderRadius: 14, borderWidth: 0.5, alignItems: 'center' },
  key:     { fontFamily: fontFamily.mono, fontSize: 11, lineHeight: 20, textAlign: 'center' },
  hint:    { fontFamily: fontFamily.sansMd, fontSize: 10, letterSpacing: 1 },
  copyBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 10, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 8, borderWidth: 0.5 },
});

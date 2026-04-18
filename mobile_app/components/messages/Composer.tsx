import React, { memo, useState } from 'react';
import { View, TextInput, Pressable, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '@/theme';
import { useGlass } from './useGlass';

interface Props { onSend: (text: string) => void }

export const Composer = memo(function Composer({ onSend }: Props) {
  const { colors } = useTheme();
  const softGlass  = useGlass('soft');
  const baseGlass  = useGlass();
  const [value, setValue] = useState('');
  const hasText = value.trim().length > 0;

  const send = () => {
    if (!hasText) return;
    onSend(value.trim());
    setValue('');
  };

  return (
    <View style={[S.bar, { backgroundColor: colors.surface0, borderTopColor: colors.borderSubtle }]}>
      <Pressable style={[S.iconBtn, baseGlass]}>
        <Feather name="zap"  size={16} color={colors.textSecondary} />
      </Pressable>
      <Pressable style={[S.iconBtn, baseGlass]}>
        <Feather name="grid" size={15} color={colors.textSecondary} />
      </Pressable>
      <View style={[S.field, baseGlass]}>
        <Feather name="lock" size={13} color={colors.primary} />
        <TextInput
          value={value}
          onChangeText={setValue}
          onSubmitEditing={send}
          returnKeyType="send"
          placeholder="encrypted message…"
          placeholderTextColor={colors.textTertiary}
          style={[S.input, { color: colors.textPrimary }]}
        />
      </View>
      <Pressable
        onPress={send}
        style={[S.sendBtn, {
          backgroundColor: hasText ? colors.primary   : colors.surface2,
          borderColor:     hasText ? 'transparent'    : colors.border,
        }]}
      >
        <Feather name="arrow-up" size={16} color={hasText ? colors.background : colors.textTertiary} />
      </Pressable>
    </View>
  );
});

const S = StyleSheet.create({
  bar:     { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10, paddingHorizontal: 14, paddingBottom: 12, borderTopWidth: 0.5 },
  iconBtn: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  field:   { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, padding: 9, paddingHorizontal: 13, borderRadius: 99 },
  input:   { flex: 1, fontSize: 14 },
  sendBtn: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center', borderWidth: 0.5 },
});

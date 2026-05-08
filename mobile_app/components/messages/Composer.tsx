import React, { memo, useState, useCallback } from 'react';
import { View, TextInput, Pressable, StyleSheet, Alert } from 'react-native';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useTheme } from '@/theme';
import { useGlass } from '../../hooks/useGlass';

export interface MediaPayload {
  uri:      string;
  base64:   string;
  mimeType: string;
  width?:   number;
  height?:  number;
}

interface Props {
  readonly onSend:   (text: string) => void;
  readonly onMedia?: (media: MediaPayload) => void;
  readonly onGrid?:  () => void;
}

export const Composer = memo(function Composer({ onSend, onMedia, onGrid }: Props) {
  const { colors } = useTheme();
  const baseGlass  = useGlass();
  const [value, setValue] = useState('');
  const hasText = value.trim().length > 0;

  const send = () => {
    if (!hasText) return;
    onSend(value.trim());
    setValue('');
  };

  const pickMedia = useCallback(async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission required', 'Allow photo library access to send images.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: 'images',
      quality: 0.6,
      base64: true,
      exif: false,
      allowsEditing: false,
    });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    if (!asset.base64) return;
    onMedia?.({
      uri:      asset.uri,
      base64:   asset.base64,
      mimeType: asset.mimeType ?? 'image/jpeg',
      width:    asset.width,
      height:   asset.height,
    });
  }, [onMedia]);

  return (
    <View style={[S.bar, { backgroundColor: colors.surface0, borderTopColor: colors.borderSubtle }]}>
      <Pressable style={[S.iconBtn, baseGlass]} onPress={onGrid} hitSlop={8}>
        <Feather name="grid" size={18} color={colors.textSecondary} />
      </Pressable>
      <Pressable style={[S.iconBtn, baseGlass]} onPress={pickMedia} hitSlop={8}>
        <Feather name="image" size={18} color={colors.textSecondary} />
      </Pressable>
      <View style={[S.field, baseGlass]}>
        <Feather name="lock" size={14} color={colors.primary} />
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
        hitSlop={8}
        style={[S.sendBtn, {
          backgroundColor: hasText ? colors.primary   : colors.surface2,
          borderColor:     hasText ? 'transparent'    : colors.border,
        }]}
      >
        <MaterialCommunityIcons name="bird" size={20} color={hasText ? colors.background : colors.textTertiary} />
      </Pressable>
    </View>
  );
});

const S = StyleSheet.create({
  bar:     { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 8, paddingHorizontal: 14, paddingBottom: 10, borderTopWidth: 0.5 },
  iconBtn: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  field:   { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6, paddingHorizontal: 12, borderRadius: 12 },
  input:   { flex: 1, fontSize: 14 },
  sendBtn: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center', borderWidth: 0.5 },
});

import React, { useRef, useEffect, useState } from 'react';
import {
  Modal, View, Text, Pressable,
  StyleSheet, Animated, Platform,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { Feather } from '@expo/vector-icons';
import { fontFamily, useTheme } from '@/theme';
import { useGlass } from '@/hooks/useGlass';
import { QRCode } from '@/components/settings/QRCode';
import type { LxmfGroup } from '@/context/LxmfContext';

interface Props {
  readonly visible: boolean;
  readonly onClose: () => void;
  readonly group:   LxmfGroup | null;
}

export function ChannelShareSheet({ visible, onClose, group }: Props) {
  const { colors }  = useTheme();
  const baseGlass   = useGlass();
  const softGlass   = useGlass('soft');

  const [copied, setCopied] = useState<'addr' | 'key' | 'all' | null>(null);
  const sheetAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.spring(sheetAnim, { toValue: 1, useNativeDriver: true, bounciness: 4 }).start();
    }
  }, [visible, sheetAnim]);

  function dismiss() {
    Animated.timing(sheetAnim, { toValue: 0, duration: 220, useNativeDriver: true }).start(() => {
      setCopied(null);
      onClose();
    });
  }

  async function copy(text: string, which: 'addr' | 'key' | 'all') {
    await Clipboard.setStringAsync(text);
    setCopied(which);
    setTimeout(() => setCopied(null), 1800);
  }

  const sheetY    = sheetAnim.interpolate({ inputRange: [0, 1], outputRange: [600, 0], extrapolate: 'clamp' });
  const overlayOp = sheetAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 1], extrapolate: 'clamp' });

  const groupUri = group
    ? `lxmf://group/${group.addrHex}/${group.keyHex}?name=${encodeURIComponent(group.name)}`
    : '';

  return (
    <Modal transparent animationType="none" visible={visible} onRequestClose={dismiss}>
      <View style={StyleSheet.absoluteFill}>
        <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(4,4,6,0.72)', opacity: overlayOp }]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={dismiss} />
        </Animated.View>

        <Animated.View style={[S.sheet, { backgroundColor: colors.glass, borderColor: colors.border, transform: [{ translateY: sheetY }] }]}>
          <View style={[S.grab, { backgroundColor: 'rgba(255,255,255,0.18)' }]} />

          <View style={S.header}>
            <View>
              <Text style={[S.tag,   { color: colors.textTertiary }]}>SHARE CHANNEL</Text>
              <Text style={[S.title, { color: colors.textPrimary }]}>{group?.name ?? '—'}</Text>
            </View>
            <Pressable onPress={dismiss} style={[S.closeBtn, softGlass]}>
              <Feather name="x" size={14} color={colors.textSecondary} />
            </Pressable>
          </View>

          {/* QR code */}
          <View style={S.qrWrap}>
            <QRCode size={210} data={groupUri || 'anonmesh'} />
          </View>

          <Text style={[S.hint, { color: colors.textTertiary }]}>
            Peer scans this to join — encodes address + key
          </Text>

          {/* Copy rows */}
          <View style={{ gap: 6, marginTop: 6 }}>
            <Pressable onPress={() => copy(group?.addrHex ?? '', 'addr')} style={[S.copyRow, baseGlass]}>
              <View style={S.copyLabel}>
                <Text style={[S.copyTag, { color: colors.textTertiary }]}>ADDRESS</Text>
                <Text style={[S.mono, { color: colors.textPrimary }]} numberOfLines={1} ellipsizeMode="middle">
                  {group?.addrHex ?? '—'}
                </Text>
              </View>
              <Feather name={copied === 'addr' ? 'check' : 'copy'} size={13} color={copied === 'addr' ? colors.primary : colors.textTertiary} />
            </Pressable>

            <Pressable onPress={() => copy(group?.keyHex ?? '', 'key')} style={[S.copyRow, baseGlass]}>
              <View style={S.copyLabel}>
                <Text style={[S.copyTag, { color: colors.textTertiary }]}>KEY</Text>
                <Text style={[S.mono, { color: colors.textPrimary }]} numberOfLines={1} ellipsizeMode="middle">
                  {group?.keyHex ?? '—'}
                </Text>
              </View>
              <Feather name={copied === 'key' ? 'check' : 'copy'} size={13} color={copied === 'key' ? colors.primary : colors.textTertiary} />
            </Pressable>
          </View>

          <Pressable
            onPress={() => copy(`${group?.addrHex ?? ''}:${group?.keyHex ?? ''}`, 'all')}
            style={[S.copyAllBtn, { borderColor: colors.border }]}
          >
            <Feather name={copied === 'all' ? 'check' : 'link'} size={13} color={copied === 'all' ? colors.primary : colors.textTertiary} />
            <Text style={[S.copyAllText, { color: copied === 'all' ? colors.primary : colors.textTertiary }]}>
              {copied === 'all' ? 'COPIED' : 'COPY ADDR:KEY PAIR'}
            </Text>
          </Pressable>
        </Animated.View>
      </View>
    </Modal>
  );
}

const S = StyleSheet.create({
  sheet:       { position: 'absolute', bottom: 0, left: 0, right: 0, borderRadius: 20, borderBottomLeftRadius: 0, borderBottomRightRadius: 0, padding: 14, paddingBottom: Platform.OS === 'ios' ? 34 : 24, borderWidth: 0.5 },
  grab:        { width: 36, height: 4, borderRadius: 99, alignSelf: 'center', marginBottom: 14 },
  header:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  tag:         { fontFamily: fontFamily.sansMd, fontSize: 9.5, letterSpacing: 2, textTransform: 'uppercase' },
  title:       { fontSize: 18, marginTop: 4, letterSpacing: -0.3 },
  closeBtn:    { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  qrWrap:      { alignItems: 'center', marginBottom: 12 },
  hint:        { fontFamily: fontFamily.sansMd, fontSize: 10.5, letterSpacing: 0.2, textAlign: 'center', marginBottom: 4 },
  copyRow:     { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12 },
  copyLabel:   { flex: 1, minWidth: 0 },
  copyTag:     { fontFamily: fontFamily.sansMd, fontSize: 8.5, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 2 },
  mono:        { fontFamily: fontFamily.sansMd, fontSize: 11 },
  copyAllBtn:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, paddingVertical: 11, borderRadius: 12, borderWidth: 0.5, marginTop: 6 },
  copyAllText: { fontFamily: fontFamily.sansMd, fontSize: 10, letterSpacing: 1.5, textTransform: 'uppercase' },
});

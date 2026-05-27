import React, { useRef, useEffect, useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import * as ScreenCapture from 'expo-screen-capture';
import { Feather } from '@expo/vector-icons';
import { fontFamily, fontSize, radii, useTheme } from '@/theme';
import { useGlass } from '@/hooks/useGlass';
import { AppBottomSheet } from '@/components/primitives';
import { QRCode } from '@/components/settings/QRCode';
import type { LxmfGroup } from '@/context/LxmfContext';

// How long to leave the channel key sitting on the system clipboard before
// auto-wiping. AES-128 key in plaintext on every paste target is the entire
// confidentiality of the channel — 60s is a paste-and-move-on window.
const CLIPBOARD_AUTO_CLEAR_MS = 60_000;

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
  const clipboardClearTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Reset the copied-state checkmark when the sheet closes so a re-open never
  // shows a stale "copied" tick. Previously this happened in the local
  // dismiss() animation callback; AppBottomSheet owns the close animation now.
  useEffect(() => {
    if (!visible) setCopied(null);
  }, [visible]);

  // Block screen capture while the AES key + address are on screen (AUDIT T19).
  // The hex strings are short enough that a single screenshot leaks the channel.
  useEffect(() => {
    if (!visible) return;
    ScreenCapture.preventScreenCaptureAsync().catch(() => {});
    return () => {
      ScreenCapture.allowScreenCaptureAsync().catch(() => {});
    };
  }, [visible]);

  // Auto-wipe clipboard 60s after a copy; clear the pending timer on unmount
  // so we don't fire after the sheet is gone.
  useEffect(() => {
    return () => {
      if (clipboardClearTimerRef.current) {
        clearTimeout(clipboardClearTimerRef.current);
        clipboardClearTimerRef.current = null;
      }
    };
  }, []);

  async function copy(text: string, which: 'addr' | 'key' | 'all') {
    await Clipboard.setStringAsync(text);
    setCopied(which);
    setTimeout(() => setCopied(null), 1800);

    // Reset the auto-clear timer on every copy. Whatever is on the clipboard
    // right now will be wiped CLIPBOARD_AUTO_CLEAR_MS from this moment.
    if (clipboardClearTimerRef.current) clearTimeout(clipboardClearTimerRef.current);
    clipboardClearTimerRef.current = setTimeout(() => {
      Clipboard.setStringAsync('').catch(() => {});
      clipboardClearTimerRef.current = null;
    }, CLIPBOARD_AUTO_CLEAR_MS);
  }

  const groupUri = group
    ? `lxmf://group/${group.addrHex}/${group.keyHex}?name=${encodeURIComponent(group.name)}`
    : '';

  return (
    <AppBottomSheet visible={visible} onClose={onClose} backgroundColor={colors.glass}>
      <View style={S.header}>
        <View>
          <Text style={[S.tag,   { color: colors.textTertiary }]}>SHARE CHANNEL</Text>
          <Text style={[S.title, { color: colors.textPrimary }]}>{group?.name ?? '—'}</Text>
        </View>
        <Pressable onPress={onClose} style={[S.closeBtn, softGlass]}>
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

      {/* Honesty row (AUDIT T19): clipboard holds the AES-128 key in
          plaintext after Copy; we wipe it after 60s. */}
      <View style={S.warnRow}>
        <Feather name="clock" size={10} color={colors.textTertiary} />
        <Text style={[S.warnText, { color: colors.textTertiary }]}>
          key copied to clipboard auto-clears in 60s
        </Text>
      </View>

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
    </AppBottomSheet>
  );
}

const S = StyleSheet.create({
  header:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  tag:         { fontFamily: fontFamily.sansMd, fontSize: 9.5, letterSpacing: 2, textTransform: 'uppercase' },
  title:       { fontSize: fontSize.lg, marginTop: 4, letterSpacing: -0.3 },
  closeBtn:    { width: 30, height: 30, borderRadius: radii.full, alignItems: 'center', justifyContent: 'center' },
  qrWrap:      { alignItems: 'center', marginBottom: 12 },
  hint:        { fontFamily: fontFamily.sansMd, fontSize: 10.5, letterSpacing: 0.2, textAlign: 'center', marginBottom: 4 },
  warnRow:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, marginBottom: 8 },
  warnText:    { fontFamily: fontFamily.sansMd, fontSize: 9.5, letterSpacing: 0.5, textTransform: 'lowercase' },
  copyRow:     { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 10, borderRadius: radii.md },
  copyLabel:   { flex: 1, minWidth: 0 },
  copyTag:     { fontFamily: fontFamily.sansMd, fontSize: 8.5, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 2 },
  mono:        { fontFamily: fontFamily.sansMd, fontSize: fontSize.xs },
  copyAllBtn:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, paddingVertical: 11, borderRadius: radii.md, borderWidth: 0.5, marginTop: 6 },
  copyAllText: { fontFamily: fontFamily.sansMd, fontSize: 10, letterSpacing: 1.5, textTransform: 'uppercase' },
});

import React, { memo, useCallback } from 'react';
import { View, Text, Pressable, Alert, StyleSheet } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { Feather } from '@expo/vector-icons';
import { useTheme, fontFamily, fontSize, radii } from '@/theme';
import * as haptics from '@/src/design-system/haptics';
import { showToast } from '@/components/ui/Toast';
import { useGlass } from '../../hooks/useGlass';
import type { ChatMsg } from './types';

type SendState = 'sent' | 'queued' | 'delivered' | 'failed' | 'stale';

interface Props {
  readonly m: ChatMsg;
  readonly sendState?: SendState;
}

const STATE_META: Record<SendState, { icon: React.ComponentProps<typeof Feather>['name']; label: string }> = {
  sent:      { icon: 'check',        label: 'sent'      },
  queued:    { icon: 'clock',        label: 'queued'    },
  delivered: { icon: 'check-circle', label: 'delivered' },
  failed:    { icon: 'x-circle',     label: 'failed'    },
  stale:     { icon: 'clock',        label: 'queued'    },
};

function SendStatus({ state, colors }: { readonly state: SendState; readonly colors: ReturnType<typeof useTheme>['colors'] }) {
  const { icon, label } = STATE_META[state];
  let color: string = colors.textTertiary;
  if (state === 'failed')    color = colors.error;
  if (state === 'delivered') color = colors.primary;
  return (
    <View>
      <View style={S.statusRow}>
        <Feather name={icon} size={10} color={color} />
        <Text style={[S.statusText, { color }]}>{label}</Text>
      </View>
      {state === 'stale' && (
        <Text style={[S.staleHint, { color: colors.textTertiary }]}>Waiting for peer…</Text>
      )}
    </View>
  );
}

function FileRow({ file, colors }: {
  readonly file: { name: string; data: string };
  readonly colors: ReturnType<typeof useTheme>['colors'];
}) {
  const sizeKb = Math.round((file.data.length * 3) / 4 / 1024);
  return (
    <Pressable
      onPress={() => Alert.alert(file.name, `${sizeKb} KB — file saving coming soon`)}
      style={({ pressed }) => [S.fileRow, { backgroundColor: pressed ? colors.surface2 : colors.surface1, borderColor: colors.border }]}
    >
      <Feather name="file" size={13} color={colors.textSecondary} />
      <Text style={[S.fileName, { color: colors.textPrimary }]} numberOfLines={1}>{file.name}</Text>
      <Text style={[S.fileSize, { color: colors.textTertiary }]}>{sizeKb} KB</Text>
      <Feather name="download" size={12} color={colors.textTertiary} />
    </Pressable>
  );
}

export const MessageBubble = memo(function MessageBubble({ m, sendState }: Props) {
  const { colors } = useTheme();
  const glass      = useGlass(m.me ? 'accent' : 'base');
  const hasText    = m.text.length > 0;

  const copyText = useCallback(async () => {
    haptics.lightPress();
    try {
      await Clipboard.setStringAsync(m.text);
      showToast('Message copied');
    } catch (err) {
      // The user long-pressed for a copy and got nothing — surface the
      // failure in logs instead of silently swallowing it.
      console.warn('[messages/MessageBubble] copy failed', err);
    }
  }, [m.text]);

  return (
    <View style={[S.wrap, { alignItems: m.me ? 'flex-end' : 'flex-start' }]}>
      <View style={[S.meta, { justifyContent: m.me ? 'flex-end' : 'flex-start' }]}>
        {!m.me && <Text style={[S.from, { color: colors.textSecondary }]}>{m.from}{'  '}</Text>}
        <Text style={[S.time, { color: colors.textTertiary }]}>{m.time}</Text>
        {m.enc && <Feather name="lock" size={10} color={colors.primary} style={{ marginLeft: 4 }} />}
      </View>
      <Pressable
        onLongPress={hasText ? copyText : undefined}
        delayLongPress={350}
        accessibilityHint={hasText ? 'long press to copy message text' : undefined}
        style={({ pressed }) => [
          S.bubble, glass,
          { borderBottomRightRadius: m.me ? 4 : 16, borderBottomLeftRadius: m.me ? 16 : 4 },
          pressed && hasText && S.bubblePressed,
        ]}
      >
        {hasText && (
          <Text style={[S.text, { color: colors.textPrimary }]}>{m.text}</Text>
        )}
        {m.files && m.files.length > 0 && (
          <View style={[S.files, hasText && S.filesWithText]}>
            {m.files.map(f => <FileRow key={f.name} file={f} colors={colors} />)}
          </View>
        )}
        {m.me && sendState && (
          <SendStatus state={sendState} colors={colors} />
        )}
      </Pressable>
    </View>
  );
});

const S = StyleSheet.create({
  wrap:         { paddingHorizontal: 16, marginBottom: 14 },
  meta:         { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  from:         { fontSize: 10, letterSpacing: 0.5 },
  time:         { fontSize: 10, letterSpacing: 0.5 },
  bubble:       { maxWidth: '78%', padding: 10, paddingHorizontal: 13, borderRadius: radii.lg },
  bubblePressed:{ opacity: 0.85 },
  text:         { fontSize: fontSize.md, lineHeight: 21 },
  files:        { gap: 4 },
  filesWithText:{ marginTop: 8 },
  fileRow:      { flexDirection: 'row', alignItems: 'center', gap: 7, padding: 8, borderRadius: radii.sm, borderWidth: 0.5 },
  fileName:     { flex: 1, fontFamily: fontFamily.sansMd, fontSize: fontSize.sm },
  fileSize:     { fontFamily: fontFamily.sansMd, fontSize: 10 },
  statusRow:    { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 5, justifyContent: 'flex-end' },
  statusText:   { fontSize: 9, letterSpacing: 0.5, textTransform: 'uppercase' },
  staleHint:    { fontSize: 9, letterSpacing: 0.3, textAlign: 'right', marginTop: 2, opacity: 0.7 },
});

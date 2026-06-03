import React, { memo, useState } from 'react';
import { View, Text, Pressable, Modal, StyleSheet, Dimensions } from 'react-native';
import { Image } from 'expo-image';
import { Feather } from '@expo/vector-icons';
import { fontFamily, fontSize, radii, useTheme } from '@/theme';
import type { MediaMsg } from './types';

const SCREEN_W = Dimensions.get('window').width;
const BUBBLE_W = SCREEN_W * 0.65;

interface Props {
  readonly m: MediaMsg;
}

export const MediaBubble = memo(function MediaBubble({ m }: Props) {
  const { colors } = useTheme();
  const [lightbox, setLightbox] = useState(false);
  const [errored,  setErrored]  = useState(false);

  const aspect = m.width && m.height ? m.height / m.width : 0.75;
  const bubbleH = Math.round(BUBBLE_W * aspect);

  return (
    <View style={[S.wrap, { alignItems: m.me ? 'flex-end' : 'flex-start' }]}>
      <View style={[S.meta, { justifyContent: m.me ? 'flex-end' : 'flex-start' }]}>
        {!m.me && <Text style={[S.from, { color: colors.textSecondary }]}>{m.from}{'  '}</Text>}
        <Text style={[S.time, { color: colors.textTertiary }]}>{m.time}</Text>
        <Feather name="lock" size={10} color={colors.primary} style={{ marginLeft: 4 }} />
      </View>

      <Pressable
        onPress={() => !errored && setLightbox(true)}
        style={[S.bubble, { borderColor: m.me ? colors.primary + '40' : colors.border, width: BUBBLE_W, height: bubbleH }]}
      >
        {errored ? (
          <View style={[S.errorState, { backgroundColor: colors.surface1 }]}>
            <Feather name="image" size={22} color={colors.textTertiary} />
            <Text style={[S.errorText, { color: colors.textTertiary }]}>failed to load</Text>
          </View>
        ) : (
          <Image
            source={{ uri: m.uri }}
            style={S.img}
            contentFit="cover"
            onError={() => setErrored(true)}
            transition={180}
          />
        )}
      </Pressable>

      {/* Lightbox */}
      <Modal visible={lightbox} transparent animationType="fade" onRequestClose={() => setLightbox(false)}>
        <Pressable style={S.overlay} onPress={() => setLightbox(false)}>
          <Image
            source={{ uri: m.uri }}
            style={S.fullImg}
            contentFit="contain"
          />
          <Pressable style={[S.closeBtn, { backgroundColor: colors.surface1, borderColor: colors.border }]} onPress={() => setLightbox(false)}>
            <Feather name="x" size={16} color={colors.textSecondary} />
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
});

const S = StyleSheet.create({
  wrap:       { paddingHorizontal: 16, marginBottom: 14 },
  meta:       { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  from:       { fontSize: 10, letterSpacing: 0.5 },
  time:       { fontSize: 10, letterSpacing: 0.5, fontFamily: fontFamily.sansMd },
  bubble:     { borderRadius: radii.lg, overflow: 'hidden', borderWidth: 0.5 },
  img:        { flex: 1 },
  errorState: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 },
  errorText:  { fontFamily: fontFamily.sansMd, fontSize: fontSize.xs },
  overlay:    { flex: 1, backgroundColor: 'rgba(0,0,0,0.92)', alignItems: 'center', justifyContent: 'center' },
  fullImg:    { width: '100%', height: '80%' },
  closeBtn:   { position: 'absolute', top: 56, right: 20, width: 36, height: 36, borderRadius: radii.full, borderWidth: 0.5, alignItems: 'center', justifyContent: 'center' },
});

import React, { useRef, useEffect } from 'react';
import {
  Modal, View, Text, Pressable, ScrollView,
  StyleSheet, Animated, Platform,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { fontFamily, useTheme } from '@/theme';
import { useGlass } from '@/hooks/useGlass';
import type { LxmfGroup } from '@/context/LxmfContext';

interface Props {
  readonly visible:         boolean;
  readonly onClose:         () => void;
  readonly group:           LxmfGroup | null;
  readonly members:         string[];
  readonly getDisplayName:  (hash: string) => string;
}

function MemberRow({ hash, getDisplayName, colors, baseGlass }: {
  hash: string;
  getDisplayName: (h: string) => string;
  colors: ReturnType<typeof useTheme>['colors'];
  baseGlass: object;
}) {
  const name    = getDisplayName(hash);
  const initials = name.slice(0, 2).toUpperCase();
  return (
    <View style={[S.memberRow, baseGlass]}>
      <View style={[S.avatar, { backgroundColor: '#0d2f2a', borderColor: '#1a5c4f' }]}>
        <Text style={[S.avatarText, { color: '#4ecdc4' }]}>{initials}</Text>
      </View>
      <View style={S.memberInfo}>
        <Text style={[S.memberName, { color: colors.textPrimary }]} numberOfLines={1}>{name}</Text>
        <Text style={[S.memberHash, { color: colors.textTertiary }]}>{hash}</Text>
      </View>
      <View style={[S.activeBadge, { backgroundColor: colors.primarySubtle }]}>
        <Text style={[S.activeBadgeText, { color: colors.primary }]}>ACTIVE</Text>
      </View>
    </View>
  );
}

export function GroupMembersSheet({ visible, onClose, group, members, getDisplayName }: Props) {
  const { colors } = useTheme();
  const baseGlass  = useGlass();
  const softGlass  = useGlass('soft');

  const sheetAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.spring(sheetAnim, { toValue: 1, useNativeDriver: true, bounciness: 4 }).start();
    }
  }, [visible, sheetAnim]);

  function dismiss() {
    Animated.timing(sheetAnim, { toValue: 0, duration: 220, useNativeDriver: true }).start(onClose);
  }

  const sheetY    = sheetAnim.interpolate({ inputRange: [0, 1], outputRange: [500, 0], extrapolate: 'clamp' });
  const overlayOp = sheetAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 1], extrapolate: 'clamp' });

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
              <Text style={[S.tag, { color: colors.textTertiary }]}>CHANNEL MEMBERS</Text>
              <Text style={[S.title, { color: colors.textPrimary }]}>{group?.name ?? '—'}</Text>
            </View>
            <Pressable onPress={dismiss} style={[S.closeBtn, softGlass]}>
              <Feather name="x" size={14} color={colors.textSecondary} />
            </Pressable>
          </View>

          <View style={[S.countRow]}>
            <Feather name="users" size={12} color={colors.textTertiary} />
            <Text style={[S.countText, { color: colors.textTertiary }]}>
              {members.length === 0
                ? 'no activity yet'
                : `${members.length} active participant${members.length === 1 ? '' : 's'}`}
            </Text>
          </View>

          {members.length === 0 ? (
            <View style={S.empty}>
              <Feather name="message-circle" size={32} color={colors.textTertiary} style={{ opacity: 0.4 }} />
              <Text style={[S.emptyText, { color: colors.textTertiary }]}>
                Share the channel invite — members{'\n'}appear here after their first message
              </Text>
            </View>
          ) : (
            <ScrollView
              style={S.list}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ gap: 6, paddingBottom: 8 }}
              nestedScrollEnabled
            >
              {members.map(hash => (
                <MemberRow
                  key={hash}
                  hash={hash}
                  getDisplayName={getDisplayName}
                  colors={colors}
                  baseGlass={baseGlass}
                />
              ))}
            </ScrollView>
          )}
        </Animated.View>
      </View>
    </Modal>
  );
}

const S = StyleSheet.create({
  sheet:           { position: 'absolute', bottom: 0, left: 0, right: 0, borderRadius: 20, borderBottomLeftRadius: 0, borderBottomRightRadius: 0, padding: 14, paddingBottom: Platform.OS === 'ios' ? 34 : 24, borderWidth: 0.5, maxHeight: '70%' },
  grab:            { width: 36, height: 4, borderRadius: 99, alignSelf: 'center', marginBottom: 14 },
  header:          { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  tag:             { fontFamily: fontFamily.sansMd, fontSize: 9.5, letterSpacing: 2, textTransform: 'uppercase' },
  title:           { fontSize: 18, marginTop: 4, letterSpacing: -0.3 },
  closeBtn:        { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  countRow:        { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12 },
  countText:       { fontFamily: fontFamily.sansMd, fontSize: 10, letterSpacing: 1.5, textTransform: 'uppercase' },
  list:            { flexGrow: 0 },
  empty:           { alignItems: 'center', gap: 12, paddingVertical: 28 },
  emptyText:       { fontFamily: fontFamily.sansMd, fontSize: 11, letterSpacing: 0.2, textAlign: 'center', lineHeight: 18, opacity: 0.6 },
  memberRow:       { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10, borderRadius: 12 },
  avatar:          { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center', borderWidth: 0.5 },
  avatarText:      { fontFamily: fontFamily.sansMd, fontSize: 13, fontWeight: '600' },
  memberInfo:      { flex: 1, minWidth: 0 },
  memberName:      { fontFamily: fontFamily.sansMd, fontSize: 12, letterSpacing: 0.2 },
  memberHash:      { fontFamily: fontFamily.sansMd, fontSize: 9, letterSpacing: 0.5, marginTop: 2, opacity: 0.6 },
  activeBadge:     { paddingHorizontal: 7, paddingVertical: 3, borderRadius: 6 },
  activeBadgeText: { fontFamily: fontFamily.sansMd, fontSize: 8, letterSpacing: 1.5, textTransform: 'uppercase' },
});

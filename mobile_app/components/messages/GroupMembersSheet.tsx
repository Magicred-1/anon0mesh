import React from 'react';
import { View, Text, ScrollView, StyleSheet, Pressable } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { fontFamily, fontSize, radii, useTheme } from '@/theme';
import { useGlass } from '@/hooks/useGlass';
import { AppBottomSheet } from '@/components/primitives';
import { EmptyState } from '@/components/ui';
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

  return (
    <AppBottomSheet visible={visible} onClose={onClose} backgroundColor={colors.glass}>
      <View style={S.header}>
        <View>
          <Text style={[S.tag, { color: colors.textTertiary }]}>CHANNEL MEMBERS</Text>
          <Text style={[S.title, { color: colors.textPrimary }]}>{group?.name ?? '—'}</Text>
        </View>
        <Pressable onPress={onClose} style={[S.closeBtn, softGlass]}>
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
        <EmptyState
          fill={false}
          icon="message-circle"
          title="no activity yet"
          description="Share the channel invite — members appear here after their first message"
        />
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
    </AppBottomSheet>
  );
}

const S = StyleSheet.create({
  header:          { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  tag:             { fontFamily: fontFamily.sansMd, fontSize: 9.5, letterSpacing: 2, textTransform: 'uppercase' },
  title:           { fontSize: fontSize.lg, marginTop: 4, letterSpacing: -0.3 },
  closeBtn:        { width: 30, height: 30, borderRadius: radii.full, alignItems: 'center', justifyContent: 'center' },
  countRow:        { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12 },
  countText:       { fontFamily: fontFamily.sansMd, fontSize: 10, letterSpacing: 1.5, textTransform: 'uppercase' },
  list:            { flexGrow: 0 },
  memberRow:       { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10, borderRadius: radii.md },
  avatar:          { width: 34, height: 34, borderRadius: radii.md, alignItems: 'center', justifyContent: 'center', borderWidth: 0.5 },
  avatarText:      { fontFamily: fontFamily.sansMd, fontSize: fontSize.sm, fontWeight: '600' },
  memberInfo:      { flex: 1, minWidth: 0 },
  memberName:      { fontFamily: fontFamily.sansMd, fontSize: fontSize.sm, letterSpacing: 0.2 },
  memberHash:      { fontFamily: fontFamily.sansMd, fontSize: 9, letterSpacing: 0.5, marginTop: 2, opacity: 0.6 },
  activeBadge:     { paddingHorizontal: 7, paddingVertical: 3, borderRadius: radii.sm },
  activeBadgeText: { fontFamily: fontFamily.sansMd, fontSize: 8, letterSpacing: 1.5, textTransform: 'uppercase' },
});

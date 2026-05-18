import React, { memo, useState, useRef, useCallback } from 'react';
import { View, Text, Pressable, TextInput, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { fontFamily, useTheme } from '@/theme';
import { Pill } from '@/components/ui/Pill';
import { useGlass } from '../../hooks/useGlass';
import { useLxmfContext } from '@/context/LxmfContext';

interface Props {
  peer:           string | null;
  selfName?:      string;
  hops?:          number;
  iface?:         'TCP' | 'BLE' | 'RNode';
  online?:        boolean;
  isGroup?:       boolean;
  memberCount?:   number;
  /** False when the active thread's peer has not announced a name; render "Anonymous · prefix". */
  nameKnown?:     boolean;
  /** 8-char hash prefix for anonymous-peer display. */
  hashShort?:     string;
  onOpen:         () => void;
  onShareQR?:     () => void;
  onShowMembers?: () => void;
}

// ── Peer info row ─────────────────────────────────────────────────────────────

function GroupInfo({ peer, memberCount }: { readonly peer: string | null; readonly memberCount?: number }) {
  const { colors } = useTheme();
  const count = memberCount ?? 0;
  return (
    <>
      <Text style={[S.handle, { color: colors.textPrimary }]} numberOfLines={1}>{peer}</Text>
      <View style={S.statusRow}>
        <Feather name="hash" size={9} color={colors.textTertiary} style={{ marginRight: 4 }} />
        <Text style={[S.meta, { color: colors.textTertiary }]}>CHANNEL</Text>
        <Text style={[S.meta, { color: colors.textTertiary }]}>
          {` · ${count} active participant${count === 1 ? '' : 's'}`}
        </Text>
      </View>
    </>
  );
}

function PeerInfo({ peer, hops, iface, online, nameKnown, hashShort }:
  Readonly<Pick<Props, 'peer' | 'hops' | 'iface' | 'online' | 'nameKnown' | 'hashShort'>>) {
  const { colors } = useTheme();
  const showAnon = nameKnown === false && !!hashShort;
  return (
    <>
      {showAnon ? (
        <View style={S.anonRow}>
          <Text style={[S.handle, { color: colors.textPrimary }]} numberOfLines={1}>Anonymous</Text>
          <Text style={[S.anonHash, { color: colors.textTertiary }]} numberOfLines={1}>· {hashShort}</Text>
        </View>
      ) : (
        <Text style={[S.handle, { color: colors.textPrimary }]} numberOfLines={1}>{peer}</Text>
      )}
      <View style={S.statusRow}>
        <View style={[S.dot, { backgroundColor: online ? colors.primary : colors.textTertiary }]} />
        <Text style={[S.meta, { color: online ? colors.primary : colors.textTertiary }]}>
          {online ? 'ONLINE' : 'OFFLINE'}
        </Text>
        {hops !== undefined && (
          <Text style={[S.meta, { color: colors.textTertiary }]}>
            {` · ${hops} HOP${hops === 1 ? '' : 'S'}`}
          </Text>
        )}
        {iface && (
          <Text style={[S.meta, { color: colors.textTertiary }]}>{` · ${iface}`}</Text>
        )}
      </View>
    </>
  );
}

// ── Right-side slot ───────────────────────────────────────────────────────────

function PeerPill({ online }: { readonly online?: boolean }) {
  return (
    <Pill
      label={online ? 'Link Established' : 'Offline'}
      variant={online ? 'primary' : 'default'}
      dot
      style={{ alignSelf: 'center' }}
    />
  );
}

function EditActions({ onConfirm, onCancel }: { readonly onConfirm: () => void; readonly onCancel: () => void }) {
  const { colors } = useTheme();
  return (
    <View style={S.editActions}>
      <Pressable onPress={onCancel} hitSlop={8}>
        <Feather name="x" size={15} color={colors.textTertiary} />
      </Pressable>
      <Pressable onPress={onConfirm} hitSlop={8}>
        <Feather name="check" size={15} color={colors.primary} />
      </Pressable>
    </View>
  );
}

function EditIcon({ onPress }: { readonly onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <Pressable onPress={onPress} hitSlop={10} style={S.editBtn}>
      <Feather name="edit-2" size={13} color={colors.textTertiary} />
    </Pressable>
  );
}

// ── ThreadHeader ──────────────────────────────────────────────────────────────

export const ThreadHeader = memo(function ThreadHeader({ peer, selfName, hops, iface, online, isGroup, memberCount, nameKnown, hashShort, onOpen, onShareQR, onShowMembers }: Props) {
  const { colors }            = useTheme();
  const baseGlass             = useGlass();
  const { updateDisplayName } = useLxmfContext();
  const { top }               = useSafeAreaInsets();
  const hasPeer               = peer !== null && peer !== '';

  const [editing, setEditing] = useState(false);
  const [draft,   setDraft]   = useState('');
  const inputRef              = useRef<TextInput>(null);

  const startEdit = useCallback(() => {
    setDraft(selfName ?? '');
    setEditing(true);
    setTimeout(() => inputRef.current?.focus(), 50);
  }, [selfName]);

  const confirm = useCallback(async () => {
    setEditing(false);
    await updateDisplayName(draft);
  }, [draft, updateDisplayName]);

  const cancel = useCallback(() => {
    setEditing(false);
    setDraft('');
  }, []);

  let rightSlot: React.ReactNode;
  if (hasPeer && isGroup) {
    rightSlot = (
      <View style={S.rightGroup}>
        {onShowMembers && (
          <Pressable
            onPress={onShowMembers}
            hitSlop={10}
            style={S.qrBtn}
            accessibilityRole="button"
            accessibilityLabel="show channel members"
          >
            <Feather name="users" size={14} color={colors.textTertiary} />
          </Pressable>
        )}
        {onShareQR && (
          <Pressable
            onPress={onShareQR}
            hitSlop={10}
            style={S.qrBtn}
            accessibilityRole="button"
            accessibilityLabel="share channel"
          >
            <Feather name="share-2" size={14} color={colors.textTertiary} />
          </Pressable>
        )}
      </View>
    );
  } else if (hasPeer && onShareQR) {
    rightSlot = (
      <View style={S.rightGroup}>
        <Pressable onPress={onShareQR} hitSlop={10} style={S.qrBtn}>
          <Feather name="share-2" size={14} color={colors.textTertiary} />
        </Pressable>
        <PeerPill online={online} />
      </View>
    );
  } else if (hasPeer) {
    rightSlot = <PeerPill online={online} />;
  } else if (editing) {
    rightSlot = <EditActions onConfirm={confirm} onCancel={cancel} />;
  } else {
    rightSlot = <EditIcon onPress={startEdit} />;
  }

  return (
    <View style={[S.header, { backgroundColor: colors.surface0, borderBottomColor: colors.borderSubtle, paddingTop: top + 10 }]}>
      <Pressable onPress={onOpen} style={[S.hamburger, baseGlass]}>
        <Feather name={hasPeer ? 'arrow-left' : 'menu'} size={16} color={colors.textSecondary} />
      </Pressable>

      <View style={{ flex: 1 }}>
        {hasPeer && isGroup && <GroupInfo peer={peer} memberCount={memberCount} />}
        {hasPeer && !isGroup && <PeerInfo peer={peer} hops={hops} iface={iface} online={online} nameKnown={nameKnown} hashShort={hashShort} />}
        {!hasPeer && !editing && (
          <View style={S.nameRow}>
            <Text style={[S.handle, { color: colors.textPrimary, fontSize: 13 }]}>{selfName ?? 'messages'}</Text>
            <EditIcon onPress={startEdit} />
          </View>
        )}
        {!hasPeer && editing && (
          <View style={S.nameRow}>
            <TextInput
              ref={inputRef}
              value={draft}
              onChangeText={setDraft}
              onSubmitEditing={confirm}
              onBlur={confirm}
              returnKeyType="done"
              autoCorrect={false}
              autoCapitalize="none"
              maxLength={32}
              style={[S.handle, S.input, { color: colors.textPrimary, borderColor: colors.primary, flex: 1 }]}
            />
            <EditActions onConfirm={confirm} onCancel={cancel} />
          </View>
        )}
      </View>

      {hasPeer && rightSlot}
    </View>
  );
});

const S = StyleSheet.create({
  header:      { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 10, paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 0.5 },
  hamburger:   { width: 30, height: 30, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  handle:      { fontFamily: fontFamily.sansMd, fontSize: 14 },
  anonRow:     { flexDirection: 'row', alignItems: 'baseline', gap: 5 },
  anonHash:    { fontFamily: fontFamily.sansMd, fontSize: 11.5, letterSpacing: 0.5 },
  input:       { borderBottomWidth: 1, paddingBottom: 1, paddingHorizontal: 0, minWidth: 80 },
  statusRow:   { flexDirection: 'row', alignItems: 'center', marginTop: 2 },
  dot:         { width: 6, height: 6, borderRadius: 3, marginRight: 4 },
  meta:        { fontFamily: fontFamily.sansMd, fontSize: 9.5, letterSpacing: 1.5 },
  nameRow:     { flexDirection: 'row', alignItems: 'center', gap: 6 },
  editBtn:     { padding: 4 },
  editActions: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  rightGroup:  { flexDirection: 'row', alignItems: 'center', gap: 8 },
  qrBtn:       { padding: 4 },
});

import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

interface PeerListItemProps {
  id: string;
  name: string;
  lastActive: string;
  unreadCount?: number;
  onPress: (id: string) => void;
}

export default function PeerListItem({
  id,
  name,
  lastActive,
  unreadCount,
  onPress,
}: PeerListItemProps) {
  const getAvatarColor = (name: string) => {
    // Generate a consistent color based on name
    const colors = ['#22D3EE', '#10b981', '#8b5cf6', '#f59e0b', '#ef4444', '#ec4899'];
    const charCode = name.charCodeAt(0);
    return colors[charCode % colors.length];
  };

  return (
    <TouchableOpacity
      style={styles.container}
      onPress={() => onPress(id)}
      activeOpacity={0.7}
    >
      <View style={styles.leftSection}>
        <View style={[styles.avatar, { backgroundColor: getAvatarColor(name) }]}>
          <Text style={styles.avatarText}>
            {name.charAt(0).toUpperCase()}
          </Text>
        </View>
        <View style={styles.peerInfo}>
          <Text style={styles.peerName}>{name}</Text>
          {unreadCount && unreadCount > 0 ? (
            <View style={styles.unreadBadge}>
              <Text style={styles.unreadText}>{unreadCount}</Text>
            </View>
          ) : null}
        </View>
      </View>
      <View style={styles.rightSection}>
        <Text style={styles.lastActive}>{lastActive}</Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#1a2626',
  },
  leftSection: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  avatarText: {
    color: '#0D0D0D',
    fontSize: 18,
    fontWeight: '700',
  },
  peerInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  peerName: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '500',
  },
  unreadBadge: {
    backgroundColor: '#22D3EE',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
    paddingHorizontal: 6,
  },
  unreadText: {
    color: '#0D0D0D',
    fontSize: 12,
    fontWeight: '700',
  },
  rightSection: {
    alignItems: 'flex-end',
  },
  lastActive: {
    color: '#6b7280',
    fontSize: 14,
  },
});

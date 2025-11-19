import { LinearGradient } from 'expo-linear-gradient';
import { CaretRight } from 'phosphor-react-native';
import React, { useState } from 'react';
import {
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import BottomNavWithMenu from '../ui/BottomNavWithMenu';

interface Peer {
  id: string;
  name: string;
  lastActive: string;
  unreadCount?: number;
}

interface ChatSelectionScreenProps {
  onSelectPeer: (peerId: string) => void;
  onBack?: () => void;
  onNavigateToMessages?: () => void;
  onNavigateToWallet?: () => void;
  onNavigateToHistory?: () => void;
  onNavigateToMeshZone?: () => void;
  onNavigateToProfile?: () => void;
  onDisconnect?: () => void;
}

const MOCK_PEERS: Peer[] = [
  { id: '1', name: 'Alice, John +1', lastActive: '2min' },
  { id: '2', name: 'Junkonoshima#0669', lastActive: '34min' },
  { id: '3', name: 'Magicred1#3323', lastActive: '3h' },
  { id: '4', name: 'PauluneMoon#3323', lastActive: '3h' },
  { id: '5', name: 'anonUser#3323', lastActive: '3h' },
  { id: '6', name: 'anonUser#3323', lastActive: '3h' },
];

export default function ChatSelectionScreen({
  onSelectPeer,
  onBack,
  onNavigateToMessages,
  onNavigateToWallet,
  onNavigateToHistory,
  onNavigateToMeshZone,
  onNavigateToProfile,
  onDisconnect,
}: ChatSelectionScreenProps) {
  const [connectedPeers] = useState(3);
  const [pressedItemId, setPressedItemId] = useState<string | null>(null);

  const renderPeerItem = ({ item }: { item: Peer }) => {
    const hasMessages = item.unreadCount !== undefined && item.unreadCount > 0;
    const isPressed = pressedItemId === item.id;

    return (
      <TouchableOpacity
        style={[
          styles.peerItem,
          isPressed && styles.peerItemPressed,
        ]}
        onPress={() => onSelectPeer(item.id)}
        onPressIn={() => setPressedItemId(item.id)}
        onPressOut={() => setPressedItemId(null)}
        activeOpacity={1}
      >
        <View style={styles.peerContent}>
          <View style={styles.peerLeft}>
            <View style={styles.peerInfo}>
              <View
                style={[
                  styles.onlineIndicator,
                  !hasMessages && styles.onlineIndicatorNoMessages,
                ]}
              />
              <Text style={styles.peerName}>{item.name}</Text>
            </View>
            <Text style={styles.lastActive}>{item.lastActive}</Text>
          </View>
          <View style={styles.chevronIcon}>
            <CaretRight size={24} color="#22D3EE" weight="regular" />
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <LinearGradient
      colors={['#0D0D0D', '#06181B', '#072B31']}
      locations={[0, 0.94, 1]}
      start={{ x: 0.2125, y: 0 }}
      end={{ x: 0.7875, y: 1 }}
      style={styles.container}
    >
      <SafeAreaView style={styles.safeArea}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Messages</Text>
          <View style={styles.peersCountContainer}>
            <View style={styles.peersCountDot} />
            <Text style={styles.peersCountText}>
              Peers connected ({connectedPeers})
            </Text>
          </View>
        </View>

        {/* Peer List */}
        <View style={styles.peerListContainer}>
          <FlatList
            data={MOCK_PEERS}
            renderItem={renderPeerItem}
            keyExtractor={(item) => item.id}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.peerListContent}
          />
        </View>

        {/* Bottom Navigation Bar with Menu */}
        <BottomNavWithMenu
          onNavigateToMessages={onNavigateToMessages}
          onNavigateToWallet={onNavigateToWallet}
          onNavigateToHistory={onNavigateToHistory}
          onNavigateToMeshZone={onNavigateToMeshZone}
          onNavigateToProfile={onNavigateToProfile}
          onDisconnect={onDisconnect}
        />
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: 'transparent',
    borderBottomWidth: 2,
    borderBottomColor: '#22D3EE',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
  peersCountContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  peersCountDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#22D3EE',
  },
  peersCountText: {
    color: '#22D3EE',
    fontSize: 13,
    fontWeight: '400',
    marginLeft: 6,
  },
  peerListContainer: {
    flex: 1,
    paddingTop: 16,
  },
  peerListContent: {
    paddingHorizontal: 8,
    paddingBottom: 20,
  },
  peerItem: {
    backgroundColor: 'transparent',
    borderRadius: 12,
    marginBottom: 8,
    marginHorizontal: 8,
  },
  peerItemPressed: {
    backgroundColor: '#0a2828',
  },
  peerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 20,
  },
  peerLeft: {
    flexDirection: 'column',
    alignItems: 'flex-start',
    flex: 1,
  },
  onlineIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#22D3EE',
    marginRight: 8,
  },
  onlineIndicatorNoMessages: {
    backgroundColor: '#1e3a5f',
  },
  peerInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  peerName: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
  },
  lastActive: {
    color: '#9CA3AF',
    fontSize: 14,
    fontWeight: '500',
  },
  chevronIcon: {
    marginLeft: 16,
  },
});

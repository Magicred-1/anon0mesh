import { LinearGradient } from 'expo-linear-gradient';
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

  const renderPeerItem = ({ item }: { item: Peer }) => (
    <TouchableOpacity
      style={styles.peerItem}
      onPress={() => onSelectPeer(item.id)}
      activeOpacity={0.7}
    >
      <View style={styles.peerContent}>
        <View style={styles.peerLeft}>
          <View style={styles.onlineIndicator} />
          <View style={styles.peerInfo}>
            <Text style={styles.peerName}>{item.name}</Text>
            <Text style={styles.lastActive}>{item.lastActive}</Text>
          </View>
        </View>
        <View style={styles.chevronIcon}>
          <Text style={styles.chevronText}>›</Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  return (
    <LinearGradient
      colors={['#0D0D0D', '#06181B', '#072B31']}
      locations={[0, 0.94, 1]}
      start={{ x: 0.21, y: 0 }}
      end={{ x: 0.79, y: 1 }}
      style={styles.container}
    >
      <SafeAreaView style={styles.safeArea}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Messages</Text>
        </View>

        {/* Connected Peers Count */}
        <View style={styles.peersCountContainer}>
          <View style={styles.peersCountDot} />
          <Text style={styles.peersCountText}>
            Peers connected ({connectedPeers})
          </Text>
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
    paddingHorizontal: 20,
    paddingVertical: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#0d2626',
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '600',
  },
  peersCountContainer: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  peersCountDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#22D3EE',
  },
  peersCountText: {
    color: '#8a9999',
    fontSize: 14,
    fontWeight: '400',
    marginLeft: 8,
  },
  peerListContainer: {
    flex: 1,
    paddingTop: 8,
  },
  peerListContent: {
    paddingHorizontal: 16,
    paddingBottom: 20,
  },
  peerItem: {
    backgroundColor: '#0d3333',
    borderRadius: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#1a4444',
  },
  peerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  peerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  onlineIndicator: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#22D3EE',
    marginRight: 12,
  },
  peerInfo: {
    flex: 1,
  },
  peerName: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 4,
  },
  lastActive: {
    color: '#6b7780',
    fontSize: 13,
  },
  chevronIcon: {
    marginLeft: 12,
  },
  chevronText: {
    color: '#22D3EE',
    fontSize: 28,
    fontWeight: '300',
  },
});

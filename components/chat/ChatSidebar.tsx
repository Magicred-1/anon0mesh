import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

interface Peer {
  id: string;
  nickname: string;
  online: boolean;
}

interface ChatSidebarProps {
  visible: boolean;
  peers: Peer[];
  selectedPeerId: string | null;
  onPeerSelect: (peerId: string | null) => void;
  onClose: () => void;
  onDisconnect?: () => void;
}

export default function ChatSidebar({
  visible,
  peers,
  selectedPeerId,
  onPeerSelect,
  onClose,
  onDisconnect,
}: ChatSidebarProps) {
  if (!visible) return null;

  const handlePeerPress = (peerId: string | null) => {
    onPeerSelect(peerId);
    onClose();
  };

  const onlinePeers = peers.filter(p => p.online);
  const offlinePeers = peers.filter(p => !p.online);

  return (
    <View style={styles.overlay}>
      <TouchableOpacity style={styles.backdrop} onPress={onClose} activeOpacity={1} />
      <View style={styles.sidebar}>
        <View style={styles.header}>
          <Text style={styles.headerText}>Peers</Text>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Text style={styles.closeButtonText}>✕</Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.peerList}>
          {/* Public Zone */}
          <TouchableOpacity
            onPress={() => handlePeerPress(null)}
            style={[
              styles.peerItem,
              selectedPeerId === null && styles.peerItemSelected,
            ]}
          >
            <View style={[styles.statusDot, styles.statusOnline]} />
            <View style={styles.peerInfo}>
              <Text style={styles.peerName}>Public Zone</Text>
              <Text style={styles.peerStatus}>Broadcast to all</Text>
            </View>
          </TouchableOpacity>

          {/* Online Peers */}
          {onlinePeers.length > 0 && (
            <>
              <Text style={styles.sectionHeader}>Online ({onlinePeers.length})</Text>
              {onlinePeers.map(peer => (
                <TouchableOpacity
                  key={peer.id}
                  onPress={() => handlePeerPress(peer.id)}
                  style={[
                    styles.peerItem,
                    selectedPeerId === peer.id && styles.peerItemSelected,
                  ]}
                >
                  <View style={[styles.statusDot, styles.statusOnline]} />
                  <View style={styles.peerInfo}>
                    <Text style={styles.peerName}>{peer.nickname}</Text>
                    <Text style={styles.peerId}>{peer.id.substring(0, 8)}...</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </>
          )}

          {/* Offline Peers */}
          {offlinePeers.length > 0 && (
            <>
              <Text style={styles.sectionHeader}>Offline ({offlinePeers.length})</Text>
              {offlinePeers.map(peer => (
                <TouchableOpacity
                  key={peer.id}
                  onPress={() => handlePeerPress(peer.id)}
                  style={[
                    styles.peerItem,
                    selectedPeerId === peer.id && styles.peerItemSelected,
                  ]}
                >
                  <View style={[styles.statusDot, styles.statusOffline]} />
                  <View style={styles.peerInfo}>
                    <Text style={[styles.peerName, styles.peerNameOffline]}>{peer.nickname}</Text>
                    <Text style={styles.peerId}>{peer.id.substring(0, 8)}...</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </>
          )}

          {peers.length === 0 && (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>No peers discovered</Text>
              <Text style={styles.emptySubtext}>Make sure Bluetooth is enabled</Text>
            </View>
          )}

          {/* Disconnect Button at bottom */}
          <View style={styles.footer}>
            <TouchableOpacity
              style={styles.disconnectButton}
              onPress={() => {
                onDisconnect?.();
                onClose();
              }}
            >
              <Text style={styles.disconnectButtonText}>Disconnect & Clear Chat</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1000,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
  },
  sidebar: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: '75%',
    maxWidth: 300,
    backgroundColor: '#000',
    borderLeftWidth: 1,
    borderLeftColor: '#00d9ff',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#00d9ff',
  },
  headerText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#00d9ff',
  },
  closeButton: {
    padding: 8,
  },
  closeButtonText: {
    fontSize: 24,
    color: '#00d9ff',
    fontWeight: 'bold',
  },
  peerList: {
    flex: 1,
  },
  sectionHeader: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#666',
    paddingHorizontal: 16,
    paddingVertical: 12,
    textTransform: 'uppercase',
  },
  peerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1a1a1a',
  },
  peerItemSelected: {
    backgroundColor: '#1a1a1a',
    borderLeftWidth: 3,
    borderLeftColor: '#00d9ff',
  },
  statusDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 12,
  },
  statusOnline: {
    backgroundColor: '#00d9ff',
  },
  statusOffline: {
    backgroundColor: '#666',
  },
  peerInfo: {
    flex: 1,
  },
  peerName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#fff',
    marginBottom: 2,
  },
  peerNameOffline: {
    color: '#666',
  },
  peerStatus: {
    fontSize: 12,
    color: '#666',
  },
  peerId: {
    fontSize: 12,
    color: '#666',
    fontFamily: 'monospace',
  },
  emptyState: {
    padding: 32,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#444',
    textAlign: 'center',
  },
  footer: {
    padding: 20,
    marginTop: 20,
    borderTopWidth: 1,
    borderTopColor: '#333',
  },
  disconnectButton: {
    backgroundColor: 'rgba(255, 68, 68, 0.1)',
    borderWidth: 1,
    borderColor: '#ff4444',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  disconnectButtonText: {
    color: '#ff4444',
    fontSize: 14,
    fontWeight: 'bold',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
});

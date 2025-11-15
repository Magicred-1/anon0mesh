import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import HashtagIcon from '../icons/HashtagIcon';
import WalletIcon from '../icons/WalletIcon';
import NostrZoneSelectorModal from '../modals/NostrZoneSelectorModal';

interface ChatHeaderProps {
  nickname: string;
  selectedPeer: string | null;
  onlinePeersCount: number;
  bleConnected: boolean;
  onMenuPress: () => void;
  onWalletPress?: () => void;
  onProfilePress?: () => void;
  onClearCache?: () => void;
  onEditNickname?: () => void;
  onBackPress?: () => void;
}

export default function ChatHeader({
  nickname,
  selectedPeer,
  onlinePeersCount,
  bleConnected,
  onMenuPress,
  onWalletPress,
  onProfilePress,
  onClearCache,
  onEditNickname,
  onBackPress,
}: ChatHeaderProps) {
  // Zone selector state
  const [showZoneSelector, setShowZoneSelector] = useState(false);
  const [selectedZone, setSelectedZone] = useState<'local' | 'neighborhood' | 'city' | 'internet'>('local');

  // Tap-count refs for title: single tap = edit, triple tap = clear cache
  const tapCountRef = useRef(0);
  const tapTimerRef = useRef<any>(null);

  useEffect(() => {
    return () => {
      if (tapTimerRef.current) {
        clearTimeout(tapTimerRef.current);
        tapTimerRef.current = null;
      }
    };
  }, []);

  const handleTitlePress = () => {
    tapCountRef.current += 1;
    if (tapTimerRef.current) {
      clearTimeout(tapTimerRef.current);
    }
    tapTimerRef.current = setTimeout(() => {
      const taps = tapCountRef.current;
      tapCountRef.current = 0;
      tapTimerRef.current = null;
      if (taps === 1) {
        onEditNickname && onEditNickname();
      } else if (taps >= 3) {
        onClearCache && onClearCache();
      }
    }, 600);
  };

  return (
    <View style={styles.header}>
      <View style={styles.headerLeft}>
        {/* Back arrow
        <TouchableOpacity style={styles.backButton} onPress={onBackPress}>
          <Text style={styles.backArrow}>←</Text>
        </TouchableOpacity> */}
        <TouchableOpacity onPress={handleTitlePress} activeOpacity={0.7} style={styles.titleTouch}>
          <Text style={styles.headerTitle}>{selectedPeer || nickname}</Text>
        </TouchableOpacity>
      </View>
      
      {/* Right side icons */}
      <View style={styles.headerRight}>
        {/* Wallet Icon */}
        <TouchableOpacity style={styles.iconButton} onPress={onWalletPress}>
          <View style={styles.walletIcon}>
            <WalletIcon size={20} />
          </View>
        </TouchableOpacity>

        {/* Bluetooth Icon - Opens Zone Selector */}
        <TouchableOpacity style={styles.iconButton} onPress={() => setShowZoneSelector(true)}>
          <View style={[styles.bluetoothIcon, bleConnected && styles.bluetoothActive]}>
            <HashtagIcon width={16} height={16} color={bleConnected ? '#00CED1' : '#333'} />
          </View>
        </TouchableOpacity>
      </View>

      {/* Nostr Zone Selector Modal */}
      <NostrZoneSelectorModal
        visible={showZoneSelector}
        onClose={() => setShowZoneSelector(false)}
        onSelectZone={(zone) => {
          setSelectedZone(zone);
          console.log('Selected Nostr zone:', zone);
        }}
        selectedZone={selectedZone}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#000',
    borderBottomWidth: 1,
    borderBottomColor: '#00CED1',
  },
  headerLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  backButton: {
    padding: 4,
  },
  backArrow: {
    fontSize: 24,
    color: '#00CED1',
    fontWeight: 'bold',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  titleTouch: {
    paddingVertical: 4,
    paddingHorizontal: 6,
  },
  iconButton: {
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#00CED1',
    backgroundColor: 'rgba(0, 217, 255, 0.1)',
  },
  // Wallet Icon
  walletIcon: {
    width: 20,
    height: 16,
  },
  walletTop: {
    width: 20,
    height: 4,
    backgroundColor: '#00CED1',
    borderTopLeftRadius: 2,
    borderTopRightRadius: 2,
  },
  walletBottom: {
    width: 20,
    height: 12,
    backgroundColor: '#00CED1',
    borderBottomLeftRadius: 2,
    borderBottomRightRadius: 2,
    marginTop: 0,
  },
  // Profile Icon
  profileIcon: {
    width: 20,
    height: 20,
    alignItems: 'center',
  },
  profileHead: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#00d9ff',
  },
  profileBody: {
    width: 16,
    height: 10,
    borderRadius: 8,
    backgroundColor: '#00d9ff',
    marginTop: 2,
  },
  // Bluetooth Icon
  bluetoothIcon: {
    width: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  bluetoothActive: {
    opacity: 1,
  },
  bluetoothSymbol: {
    width: 12,
    height: 18,
    borderLeftWidth: 2,
    borderRightWidth: 2,
    borderTopWidth: 2,
    borderBottomWidth: 2,
    borderColor: '#00CED1',
    borderTopLeftRadius: 6,
    borderTopRightRadius: 6,
    borderBottomLeftRadius: 6,
    borderBottomRightRadius: 6,
    transform: [{ rotate: '45deg' }],
  },
  // Trash Icon
  trashIcon: {
    width: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  trashLid: {
    width: 16,
    height: 3,
    backgroundColor: '#00CED1',
    borderTopLeftRadius: 2,
    borderTopRightRadius: 2,
    marginBottom: 2,
  },
  trashBody: {
    width: 12,
    height: 10,
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#00CED1',
    borderBottomLeftRadius: 2,
    borderBottomRightRadius: 2,
  },
});

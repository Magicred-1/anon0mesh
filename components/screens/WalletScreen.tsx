import { WalletFactory } from '@/src/infrastructure/wallet';
import '@/src/polyfills';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  Alert,
  Clipboard,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

export default function WalletScreen() {
  const router = useRouter();
  const [publicKey, setPublicKey] = useState<string>('');

  // Initialize wallet
  useEffect(() => {
    (async () => {
      try {
        const hasWallet = await WalletFactory.hasLocalWallet();
        if (!hasWallet) {
          Alert.alert('No Wallet', 'Please create a wallet first.');
          router.replace('/onboarding' as any);
          return;
        }

        const walletAdapter = await WalletFactory.createAuto();
        const pubKey = await walletAdapter.getPublicKey();
        
        if (pubKey) {
          const pubKeyString = pubKey.toBase58();
          setPublicKey(pubKeyString);
          console.log('[Wallet] Initialized:', pubKeyString.slice(0, 8) + '...');
        }

        // TODO: Fetch actual balance from blockchain

  // TODO: Fetch actual balance from blockchain
      } catch (error) {
        console.error('[Wallet] Error initializing:', error);
        Alert.alert('Error', 'Failed to initialize wallet');
      }
    })();
  }, [router]);

  const handleCopyAddress = () => {
    if (publicKey) {
      Clipboard.setString(publicKey);
      Alert.alert('Copied!', 'Wallet address copied to clipboard');
    }
  };

  const handleReceive = () => {
    Alert.alert('Receive', 'Show this QR code to receive payments');
  };

  const handleSwap = () => {
    Alert.alert('Swap', 'Swap feature coming soon');
  };

  const handleSend = () => {
    Alert.alert('Send', 'Send feature coming soon');
  };

  const handleBack = () => {
    router.back();
  };

  const handleSettings = () => {
    Alert.alert('Settings', 'Settings coming soon');
  };

  // Format address for display (XXXX...XXXX)
  const formatAddress = (address: string) => {
    if (!address) return 'XXXX...XXXX';
    return `${address.slice(0, 4)}...${address.slice(-4)}`;
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={handleBack} style={styles.backButton}>
          <Text style={styles.backArrow}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Wallet</Text>
        <TouchableOpacity onPress={handleSettings} style={styles.settingsButton}>
          <View style={styles.settingsIcon}>
            <View style={styles.settingsLine} />
            <View style={styles.settingsLine} />
            <View style={styles.settingsLine} />
          </View>
        </TouchableOpacity>
      </View>

      {/* Action Buttons */}
      <View style={styles.actionsContainer}>
        <TouchableOpacity style={styles.actionButton} onPress={handleReceive}>
          <View style={styles.actionIconContainer}>
            <View style={styles.receiveIcon}>
              <View style={styles.receiveArrow} />
            </View>
          </View>
          <Text style={styles.actionLabel}>Receive</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.actionButton} onPress={handleSwap}>
          <View style={styles.actionIconContainer}>
            <View style={styles.swapIcon}>
              <View style={styles.swapArrowUp} />
              <View style={styles.swapArrowDown} />
            </View>
          </View>
          <Text style={styles.actionLabel}>Swap</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.actionButton} onPress={handleSend}>
          <View style={styles.actionIconContainer}>
            <View style={styles.sendIcon}>
              <View style={styles.sendArrow} />
            </View>
          </View>
          <Text style={styles.actionLabel}>Send</Text>
        </TouchableOpacity>
      </View>

      {/* QR Code */}
      <View style={styles.qrContainer}>
        <View style={styles.qrBox}>
          {/* QR Code corners */}
          <View style={[styles.qrCorner, styles.qrCornerTL]} />
          <View style={[styles.qrCorner, styles.qrCornerTR]} />
          <View style={[styles.qrCorner, styles.qrCornerBL]} />
          <View style={[styles.qrCorner, styles.qrCornerBR]} />
          
          {/* QR code pattern placeholder */}
          <View style={styles.qrContent}>
            <View style={styles.qrPattern}>
              {[...Array(10)].map((_, row) => (
                <View key={row} style={styles.qrRow}>
                  {[...Array(10)].map((_, col) => (
                    <View
                      key={col}
                      style={[
                        styles.qrDot,
                        (row + col) % 2 === 0 && styles.qrDotFilled,
                      ]}
                    />
                  ))}
                </View>
              ))}
            </View>
          </View>
        </View>
      </View>

      {/* Address Display */}
      <TouchableOpacity style={styles.addressContainer} onPress={handleCopyAddress}>
        <Text style={styles.addressText}>{formatAddress(publicKey)}</Text>
        <View style={styles.copyIcon}>
          <View style={styles.copyIconBack} />
          <View style={styles.copyIconFront} />
        </View>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a1a1a',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#00d9ff',
  },
  backButton: {
    padding: 4,
    width: 40,
  },
  backArrow: {
    fontSize: 24,
    color: '#00d9ff',
    fontWeight: 'bold',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#fff',
  },
  settingsButton: {
    padding: 4,
    width: 40,
    alignItems: 'flex-end',
  },
  settingsIcon: {
    width: 24,
    height: 24,
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  settingsLine: {
    width: 24,
    height: 2,
    backgroundColor: '#00d9ff',
    borderRadius: 1,
  },
  actionsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: 32,
    paddingVertical: 32,
  },
  actionButton: {
    alignItems: 'center',
    gap: 8,
  },
  actionIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#00d9ff',
    backgroundColor: 'rgba(0, 217, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionLabel: {
    fontSize: 14,
    color: '#00d9ff',
    fontWeight: '500',
  },
  // Receive Icon (down arrow)
  receiveIcon: {
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  receiveArrow: {
    width: 0,
    height: 0,
    borderLeftWidth: 10,
    borderRightWidth: 10,
    borderTopWidth: 16,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: '#00d9ff',
  },
  // Swap Icon (circular arrows)
  swapIcon: {
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  swapArrowUp: {
    width: 20,
    height: 10,
    borderTopWidth: 2,
    borderLeftWidth: 2,
    borderColor: '#00d9ff',
    borderTopLeftRadius: 8,
    transform: [{ rotate: '45deg' }],
    marginBottom: 4,
  },
  swapArrowDown: {
    width: 20,
    height: 10,
    borderBottomWidth: 2,
    borderRightWidth: 2,
    borderColor: '#00d9ff',
    borderBottomRightRadius: 8,
    transform: [{ rotate: '45deg' }],
  },
  // Send Icon (paper plane)
  sendIcon: {
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendArrow: {
    width: 0,
    height: 0,
    borderLeftWidth: 16,
    borderRightWidth: 0,
    borderTopWidth: 10,
    borderBottomWidth: 10,
    borderLeftColor: '#00d9ff',
    borderTopColor: 'transparent',
    borderBottomColor: 'transparent',
    transform: [{ rotate: '-45deg' }],
  },
  qrContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 32,
    paddingHorizontal: 32,
  },
  qrBox: {
    width: 320,
    height: 320,
    backgroundColor: '#fff',
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#00d9ff',
    position: 'relative',
    padding: 20,
  },
  qrCorner: {
    position: 'absolute',
    width: 40,
    height: 40,
    borderColor: '#000',
  },
  qrCornerTL: {
    top: 10,
    left: 10,
    borderTopWidth: 4,
    borderLeftWidth: 4,
  },
  qrCornerTR: {
    top: 10,
    right: 10,
    borderTopWidth: 4,
    borderRightWidth: 4,
  },
  qrCornerBL: {
    bottom: 10,
    left: 10,
    borderBottomWidth: 4,
    borderLeftWidth: 4,
  },
  qrCornerBR: {
    bottom: 10,
    right: 10,
    borderBottomWidth: 4,
    borderRightWidth: 4,
  },
  qrContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  qrPattern: {
    flexDirection: 'column',
    gap: 8,
  },
  qrRow: {
    flexDirection: 'row',
    gap: 8,
  },
  qrDot: {
    width: 16,
    height: 16,
    backgroundColor: 'transparent',
  },
  qrDotFilled: {
    backgroundColor: '#000',
  },
  addressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: 32,
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#00d9ff',
    backgroundColor: 'rgba(0, 217, 255, 0.05)',
  },
  addressText: {
    fontSize: 18,
    color: '#00d9ff',
    fontFamily: 'monospace',
    letterSpacing: 2,
  },
  copyIcon: {
    width: 24,
    height: 24,
    position: 'relative',
  },
  copyIconBack: {
    position: 'absolute',
    top: 4,
    right: 0,
    width: 16,
    height: 16,
    borderWidth: 2,
    borderColor: '#00d9ff',
    borderRadius: 4,
  },
  copyIconFront: {
    position: 'absolute',
    top: 0,
    right: 4,
    width: 16,
    height: 16,
    borderWidth: 2,
    borderColor: '#00d9ff',
    backgroundColor: '#0a1a1a',
    borderRadius: 4,
  },
  
});

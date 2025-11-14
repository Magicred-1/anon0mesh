import { WalletFactory } from '@/src/infrastructure/wallet';
import '@/src/polyfills';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  Alert,
  Clipboard,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
// QR code
import QRCode from 'react-native-qrcode-svg';
import WalletHeader from '../wallet/WalletHeader';

export default function WalletScreen({ hideHeader = false }: { hideHeader?: boolean } = {}) {
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
      {!hideHeader && <WalletHeader onBack={handleBack} onRightPress={handleSettings} />}

      {/* QR Code */}
      <View style={styles.qrContainer}>
        {publicKey ? (
          <QRCode value={publicKey} size={320} backgroundColor="transparent" color="#D4F9FF" />
        ) : (
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
        )}
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
  },
  backButton: {
    padding: 4,
    width: 40,
  },
  backArrow: {
    fontSize: 24,
    color: '#fff',
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
  qrContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 32,
    paddingHorizontal: 32,
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

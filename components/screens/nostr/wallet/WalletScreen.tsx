import { WalletFactory } from '@/src/infrastructure/wallet';
import '@/src/polyfills';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Clipboard,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
// QR code
import SendIcon from '@/components/icons/SendIcon';
import SolanaIcon from '@/components/icons/SolanaIcon';
import USDCIcon from '@/components/icons/USDCIcon';
import ZECIcon from '@/components/icons/ZECIcon';
import SettingsIcon from '@/components/icons/wallet/Settings';
import SwapIcon from '@/components/icons/wallet/SwapIcon';
import { useWalletBalances } from '@/hooks/useWalletBalances';
import QRCode from 'react-native-qrcode-svg';
import BottomNavWithMenu from '../../../ui/BottomNavWithMenu';

export default function WalletScreen() {
  const router = useRouter();
  const [publicKey, setPublicKey] = useState<string>('');
  const { balances, isRefreshing, fetchBalances } = useWalletBalances();

  // Initialize wallet and fetch balances
  useEffect(() => {
    let mounted = true;
    
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
        
        if (pubKey && mounted) {
          const pubKeyString = pubKey.toBase58();
          setPublicKey(pubKeyString);
          console.log('[Wallet] Initialized:', pubKeyString.slice(0, 8) + '...');

          // Fetch real balances from Devnet
          await fetchBalances(pubKey);
        }
      } catch (error) {
        console.error('[Wallet] Error initializing:', error);
        Alert.alert('Error', 'Failed to initialize wallet');
      }
    })();

    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  const handleCopyAddress = () => {
    if (publicKey) {
      Clipboard.setString(publicKey);
      Alert.alert('Copied!', 'Wallet address copied to clipboard');
    }
  };

  const handleSend = () => {
    router.push('/wallet/send' as any);
  };

  const handleSwap = () => {
    router.push('/wallet/swap' as any);
  };

  // Format address for display (XXXX...XXXX)
  const formatAddress = (address: string) => {
    if (!address) return 'XXXX...XXXX';
    return `${address.slice(0, 4)}...${address.slice(-4)}`;
  };

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
          <Text style={styles.headerTitle}>Wallet</Text>
          <TouchableOpacity 
            style={styles.settingsButton}
            onPress={() => router.push('/wallet/settings')}
          >
            <View style={styles.settingsIcon}>
              <SettingsIcon />
            </View>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {/* Network Badge */}
          <View style={styles.networkBadge}>
            <View style={styles.networkIcon}>
              <SolanaIcon size={16} color='#22D3EE' />
            </View>
            <Text style={styles.networkText}>Solana Network</Text>
          </View>

          {/* QR Code */}
          <View style={styles.qrContainer}>
            <View style={styles.qrWrapper}>
              {publicKey ? (
                <QRCode 
                  value={publicKey} 
                  size={280} 
                  backgroundColor="transparent" 
                  color="#D4F9FF"
                  quietZone={20}
                />
              ) : (
                <View style={styles.qrPlaceholder}>
                  <Text style={styles.qrPlaceholderText}>Loading...</Text>
                </View>
              )}
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

          {/* Action Buttons */}
          <View style={styles.actionsContainer}>
            <TouchableOpacity style={styles.actionButton} onPress={handleSend}>
              <SendIcon width={20} height={20} color="#ffffffff" />
              <Text style={styles.actionText}>Send</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionButton} onPress={handleSwap}>
              <SwapIcon size={20} color="#ffffffff" />
              <Text style={styles.actionText}>Swap</Text>
            </TouchableOpacity>
          </View>

          {/* Balances Section */}
          <View style={styles.balancesSection}>
            <View style={styles.balancesTitleRow}>
              <Text style={styles.balancesTitle}>Balances</Text>
              {isRefreshing && <ActivityIndicator size="small" color="#22D3EE" />}
            </View>
            {balances.map((item, index) => (
              <View key={index} style={styles.balanceItem}>
                <View style={styles.balanceLeft}>
                  <View style={styles.balanceIcon}>
                    {item.symbol === 'SOL' && <SolanaIcon size={40} color="#14F195" />}
                    {item.symbol === 'USDC' && <USDCIcon size={40} />}
                    {item.symbol === 'ZEC' && <ZECIcon size={40} />}
                  </View>
                  <View>
                    <Text style={styles.balanceSymbol}>{item.symbol}</Text>
                    <Text style={styles.balanceName}>{item.name}</Text>
                  </View>
                </View>
                {item.isLoading ? (
                  <ActivityIndicator size="small" color="#22D3EE" />
                ) : (
                  <Text style={styles.balanceAmount}>
                    {item.balance.toFixed(item.symbol === 'SOL' ? 4 : 2)}
                  </Text>
                )}
              </View>
            ))}
          </View>
        </ScrollView>

        {/* Bottom Navigation */}
        <BottomNavWithMenu
          onNavigateToMessages={() => router.push('/chat' as any)}
          onNavigateToWallet={() => {}}
          onNavigateToHistory={() => router.push('/history' as any)}
          onNavigateToMeshZone={() => Alert.alert('Mesh Zone', 'Coming soon')}
          onNavigateToProfile={() => Alert.alert('Profile', 'Coming soon')}
          onDisconnect={() => Alert.alert('Disconnect', 'Coming soon')}
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
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#0d2626',
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  settingsButton: {
    padding: 4,
  },
  settingsIcon: {
    width: 24,
    height: 18,
    justifyContent: 'space-between',
  },
  settingsLine: {
    width: 24,
    height: 3,
    backgroundColor: '#22D3EE',
    borderRadius: 2,
  },
  content: {
    flex: 1,
  },
  networkBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
    marginBottom: 20,
    gap: 8,
  },
  networkIcon: {
    flexDirection: 'row',
    gap: 2,
    alignItems: 'flex-end',
  },
  networkIconBar: {
    width: 3,
    height: 12,
    backgroundColor: '#22D3EE',
    borderRadius: 2,
  },
  networkText: {
    fontSize: 14,
    color: '#8a9999',
    fontWeight: '500',
  },
  qrContainer: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  qrWrapper: {
    backgroundColor: 'transparent',
    borderRadius: 20,
    borderWidth: 3,
    borderColor: '#22D3EE',
  },
  qrPlaceholder: {
    width: 280,
    height: 280,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qrPlaceholderText: {
    color: '#666',
    fontSize: 16,
  },
  addressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: 20,
    marginTop: 20,
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#22D3EE',
    backgroundColor: 'rgba(34, 211, 238, 0.05)',
  },
  addressText: {
    fontSize: 16,
    color: '#22D3EE',
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
    borderColor: '#22D3EE',
    borderRadius: 3,
  },
  copyIconFront: {
    position: 'absolute',
    top: 0,
    right: 4,
    width: 16,
    height: 16,
    borderWidth: 2,
    borderColor: '#22D3EE',
    backgroundColor: '#06181B',
    borderRadius: 3,
  },
  actionsContainer: {
    flexDirection: 'row',
    marginHorizontal: 20,
    marginTop: 20,
    gap: 12,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#22D3EE',
    backgroundColor: 'rgba(34, 211, 238, 0.05)',
    gap: 8,
  },
  actionIcon: {
    fontSize: 20,
    color: '#ffffffff',
  },
  actionText: {
    fontSize: 16,
    color: '#ffffffff',
    fontWeight: '500',
  },
  balancesSection: {
    marginTop: 32,
    marginHorizontal: 20,
    marginBottom: 20,
  },
  balancesTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  balancesTitle: {
    fontSize: 18,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  balanceItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#0d3333',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#1a4444',
  },
  balanceLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  balanceIcon: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  balanceSymbol: {
    fontSize: 18,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  balanceName: {
    fontSize: 14,
    color: '#8a9999',
    marginTop: 2,
  },
  balanceAmount: {
    fontSize: 18,
    color: '#FFFFFF',
    fontWeight: '500',
  },
});

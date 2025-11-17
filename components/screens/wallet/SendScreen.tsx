import SolanaIcon from '@/components/icons/SolanaIcon';
import USDCIcon from '@/components/icons/USDCIcon';
import SettingsIcon from '@/components/icons/wallet/Settings';
import ZECIcon from '@/components/icons/ZECIcon';
import QRScannerModal from '@/components/modals/QRScannerModal';
import SendConfirmationModal from '@/components/modals/SendConfirmationModal';
import { WalletFactory } from '@/src/infrastructure/wallet';
import type { ConnectivityStatus } from '@/src/infrastructure/wallet/utils/connectivity';
import * as ConnectivityUtils from '@/src/infrastructure/wallet/utils/connectivity';
import '@/src/polyfills';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

type TokenType = 'SOL' | 'USDC' | 'ZEC';

const TOKEN_BALANCES: Record<TokenType, number> = {
  SOL: 2.8998,
  USDC: 3.46532,
  ZEC: 3.46532,
};

export default function SendScreen() {
  const router = useRouter();
  const [publicKey, setPublicKey] = useState<string>('');
  const [amount, setAmount] = useState('0.00');
  const [token, setToken] = useState<TokenType>('SOL');
  const [recipient, setRecipient] = useState('');
  const [showTokenDropdown, setShowTokenDropdown] = useState(false);
  const [selectedFrom, setSelectedFrom] = useState<'primary' | 'disposable1' | 'disposable2'>('primary');
  const [showFromDropdown, setShowFromDropdown] = useState(false);
  const [connectivity, setConnectivity] = useState<ConnectivityStatus | null>(null);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [showQRScanner, setShowQRScanner] = useState(false);

  const balance = TOKEN_BALANCES[token];

  // Check connectivity
  useEffect(() => {
    const checkConnectivity = async () => {
      const status = await ConnectivityUtils.getConnectivityStatus();
      setConnectivity(status);
    };

    checkConnectivity();
    const unsubscribe = ConnectivityUtils.subscribeToConnectivityChanges(checkConnectivity);

    return () => {
      unsubscribe();
    };
  }, []);

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
        const pubKey = walletAdapter.getPublicKey();
        
        if (pubKey) {
          const pubKeyString = pubKey.toBase58();
          setPublicKey(pubKeyString);
          console.log('[Send] Wallet loaded:', pubKeyString.slice(0, 8) + '...');
        }

        // TODO: Fetch actual balance from blockchain
      } catch (error) {
        console.error('[Send] Error initializing:', error);
        Alert.alert('Error', 'Failed to initialize wallet');
      }
    })();
  }, [router]);

  const handleCreateNewAddress = () => {
    router.push('/wallet/settings');
  };

  const handleQRScan = () => {
    setShowQRScanner(true);
  };

  const handleQRScanned = (data: string) => {
    console.log('[Send] QR scanned:', data);
    setRecipient(data);
    setShowQRScanner(false);
  };

  const handleTokenDropdown = () => {
    setShowTokenDropdown(!showTokenDropdown);
  };

  const handleSelectToken = (selectedToken: TokenType) => {
    setToken(selectedToken);
    setShowTokenDropdown(false);
  };

  const handleMaxAmount = () => {
    setAmount(balance.toString());
  };

  const handleBack = () => {
    router.back();
  };

  const handleSettings = () => {
    router.push('/wallet/settings');
  };

  const handleSendTransaction = async () => {
    if (!recipient) {
      Alert.alert('Error', 'Please enter recipient address');
      return;
    }

    if (!amount || parseFloat(amount) <= 0) {
      Alert.alert('Error', 'Please enter a valid amount');
      return;
    }

    // Check connectivity before sending
    const sendCheck = await ConnectivityUtils.canSendTransaction();
    
    if (!sendCheck.canSend) {
      Alert.alert(
        'Cannot Send',
        sendCheck.reason || 'No internet or Bluetooth connection available',
        [{ text: 'OK' }]
      );
      return;
    }

    // Process transaction and show confirmation modal
    // TODO: Implement actual transaction logic
    const useOfflineMode = sendCheck.useOfflineMode || !connectivity?.isInternetConnected;
    
    console.log('[Send] Transaction:', {
      amount,
      token,
      recipient,
      useOfflineMode
    });
    
    // Show confirmation modal for both internet and Bluetooth transactions
    setShowConfirmation(true);
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
          <TouchableOpacity onPress={handleBack} style={styles.backButton}>
            <Text style={styles.backIcon}>‹</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Send</Text>
          <TouchableOpacity style={styles.settingsButton} onPress={handleSettings}>
            <View style={styles.settingsIcon}>
              <SettingsIcon />
            </View>
          </TouchableOpacity>
        </View>

        <KeyboardAvoidingView
          style={styles.content}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
        >
          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {/* Network Badge */}
            <View style={styles.networkBadge}>
              <View style={styles.networkIcon}>
                <SolanaIcon size={16} color='#22D3EE' />
              </View>
              <Text style={styles.networkText}>Solana Network</Text>
            </View>

            {/* Token Selector & Amount */}
            <View style={styles.amountCard}>
              <TouchableOpacity style={styles.tokenSelector} onPress={handleTokenDropdown}>
                <View style={styles.tokenIconWrapper}>
                  {token === 'SOL' && <SolanaIcon size={24} color="#14F195" />}
                  {token === 'USDC' && <USDCIcon size={24} />}
                  {token === 'ZEC' && <ZECIcon size={24} />}
                </View>
                <Text style={styles.tokenText}>{token}</Text>
                <Text style={styles.dropdownIcon}>▼</Text>
              </TouchableOpacity>

              <TextInput
                style={styles.amountInput}
                value={amount}
                onChangeText={setAmount}
                keyboardType="decimal-pad"
                placeholder="0.00"
                placeholderTextColor="#4a6c6c"
              />

              <View style={styles.balanceRow}>
                <Text style={styles.balanceLabel}>Balance:</Text>
                <Text style={styles.balanceAmount}>{balance} {token}</Text>
                <Text style={styles.maxLabel}>(Max)</Text>
              </View>

              <Text style={styles.usdValue}>+$ 6726.2307</Text>
            </View>

            {/* Token Dropdown */}
            {showTokenDropdown && (
              <View style={styles.tokenDropdown}>
                {(['SOL', 'USDC', 'ZEC'] as TokenType[]).map((t) => (
                  <TouchableOpacity
                    key={t}
                    style={styles.tokenOption}
                    onPress={() => handleSelectToken(t)}
                  >
                    <View style={styles.tokenIconWrapper}>
                      {t === 'SOL' && <SolanaIcon size={24} color="#14F195" />}
                      {t === 'USDC' && <USDCIcon size={24} />}
                      {t === 'ZEC' && <ZECIcon size={24} />}
                    </View>
                    <Text style={styles.tokenOptionText}>{t}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {/* To Section */}
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>To</Text>
              <View style={styles.recipientContainer}>
                <TextInput
                  style={styles.recipientInput}
                  placeholder="Enter recipient address..."
                  placeholderTextColor="#4a6c6c"
                  value={recipient}
                  onChangeText={setRecipient}
                />
                <TouchableOpacity onPress={handleQRScan} style={styles.qrButton}>
                  <View style={styles.qrIcon}>
                    <View style={styles.qrCornerTL} />
                    <View style={styles.qrCornerTR} />
                    <View style={styles.qrCornerBL} />
                    <View style={styles.qrCornerBR} />
                  </View>
                </TouchableOpacity>
              </View>
            </View>

            {/* From Section */}
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>From</Text>
              <TouchableOpacity 
                style={styles.fromSelector}
                onPress={() => setShowFromDropdown(!showFromDropdown)}
              >
                <Text style={styles.fromPrimaryText}>
                  Primary Wallet (JDij...qU6U)
                </Text>
                <Text style={styles.fromExpandIcon}>
                  {showFromDropdown ? '∧' : '∨'}
                </Text>
              </TouchableOpacity>

              {/* From Dropdown */}
              {showFromDropdown && (
                <View style={styles.fromDropdown}>
                  <TouchableOpacity 
                    style={styles.fromOption}
                    onPress={() => {
                      setSelectedFrom('disposable1');
                      setShowFromDropdown(false);
                    }}
                  >
                    <Text style={styles.fromOptionText}>
                      Disposable Adress (8nXF...QyaS)
                    </Text>
                    <Text style={styles.fromOptionBalance}>75.99 SOL</Text>
                  </TouchableOpacity>
                  <TouchableOpacity 
                    style={styles.fromOption}
                    onPress={() => {
                      setSelectedFrom('disposable2');
                      setShowFromDropdown(false);
                    }}
                  >
                    <Text style={styles.fromOptionText}>
                      Disposable Adress (8nXF...QyaS)
                    </Text>
                    <Text style={styles.fromOptionBalance}>75.99 SOL</Text>
                  </TouchableOpacity>
                  <TouchableOpacity 
                    style={styles.createNewButton}
                  >
                    <Text style={styles.createNewIcon}>+</Text>
                    <Text style={styles.createNewText} onPressIn={handleCreateNewAddress}>Create new disposable address</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>

            {/* Send Button */}
            <TouchableOpacity
              style={[
                styles.sendButton,
                (!recipient || !amount || parseFloat(amount) <= 0) && styles.sendButtonDisabled
              ]}
              onPress={handleSendTransaction}
              disabled={!recipient || !amount || parseFloat(amount) <= 0}
            >
              <Text style={styles.sendButtonText}>Send</Text>
            </TouchableOpacity>

            {/* Connectivity Status */}
            {connectivity && (
              <View style={styles.connectivityBanner}>
                <View style={[
                  styles.statusDot,
                  { backgroundColor: connectivity.isInternetConnected ? '#22D3EE' : 
                                    connectivity.isBluetoothAvailable ? '#ffa500' : '#ff4444' }
                ]} />
                <Text style={styles.connectivityText}>
                  {connectivity.isInternetConnected 
                    ? 'Connected to Bluetooth Mesh'
                    : connectivity.isBluetoothAvailable
                    ? 'Offline mode - Using Bluetooth Mesh'
                    : 'No connection available'
                  }
                </Text>
              </View>
            )}
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
      
      <SendConfirmationModal 
        visible={showConfirmation}
        onClose={() => {
          setShowConfirmation(false);
          router.back();
        }}
        isBluetooth={connectivity?.isBluetoothAvailable}
      />

      <QRScannerModal
        visible={showQRScanner}
        onClose={() => setShowQRScanner(false)}
        onScan={handleQRScanned}
      />
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
  backButton: {
    padding: 4,
    width: 40,
  },
  backIcon: {
    fontSize: 32,
    color: '#22D3EE',
    fontWeight: 'bold',
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  settingsButton: {
    padding: 4,
    width: 40,
    alignItems: 'flex-end',
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
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 24,
  },
  networkBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    gap: 8,
  },
  networkIcon: {
    flexDirection: 'row',
    gap: 2,
    alignItems: 'flex-end',
  },
  networkText: {
    fontSize: 14,
    color: '#8a9999',
    fontWeight: '500',
  },
  // Amount Card
  amountCard: {
    backgroundColor: '#0d3333',
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#22D3EE',
    padding: 16,
    marginBottom: 20,
  },
  tokenSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  tokenIconWrapper: {
    width: 24,
    height: 24,
  },
  tokenText: {
    flex: 1,
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
  },
  dropdownIcon: {
    color: '#22D3EE',
    fontSize: 14,
  },
  amountInput: {
    color: '#fff',
    fontSize: 48,
    fontWeight: '600',
    textAlign: 'right',
    marginBottom: 8,
  },
  balanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 8,
  },
  balanceLabel: {
    color: '#8a9999',
    fontSize: 12,
  },
  balanceAmount: {
    color: '#8a9999',
    fontSize: 12,
  },
  maxLabel: {
    color: '#8a9999',
    fontSize: 12,
  },
  usdValue: {
    color: '#22D3EE',
    fontSize: 14,
    textAlign: 'right',
  },
  // Token Dropdown
  tokenDropdown: {
    backgroundColor: '#0d3333',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#22D3EE',
    marginBottom: 20,
    overflow: 'hidden',
  },
  tokenOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1a4444',
  },
  tokenOptionText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
  },
  // Section
  section: {
    marginBottom: 20,
  },
  sectionLabel: {
    color: '#8a9999',
    fontSize: 14,
    marginBottom: 8,
  },
  // Recipient Input
  recipientContainer: {
    backgroundColor: 'transparent',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#22D3EE',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  recipientInput: {
    flex: 1,
    color: '#22D3EE',
    fontSize: 14,
  },
  qrButton: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qrIcon: {
    width: 24,
    height: 24,
    position: 'relative',
  },
  qrCornerTL: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: 8,
    height: 8,
    borderTopWidth: 2,
    borderLeftWidth: 2,
    borderColor: '#22D3EE',
  },
  qrCornerTR: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 8,
    height: 8,
    borderTopWidth: 2,
    borderRightWidth: 2,
    borderColor: '#22D3EE',
  },
  qrCornerBL: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    width: 8,
    height: 8,
    borderBottomWidth: 2,
    borderLeftWidth: 2,
    borderColor: '#22D3EE',
  },
  qrCornerBR: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 8,
    height: 8,
    borderBottomWidth: 2,
    borderRightWidth: 2,
    borderColor: '#22D3EE',
  },
  // From Selector
  fromSelector: {
    backgroundColor: '#0d3333',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#22D3EE',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 8,
  },
  fromPrimaryText: {
    color: '#22D3EE',
    fontSize: 14,
  },
  fromExpandIcon: {
    color: '#22D3EE',
    fontSize: 16,
  },
  fromDropdown: {
    backgroundColor: '#0d3333',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#22D3EE',
    overflow: 'hidden',
  },
  fromOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1a4444',
  },
  fromOptionText: {
    color: '#22D3EE',
    fontSize: 14,
  },
  fromOptionBalance: {
    color: '#8a9999',
    fontSize: 12,
  },
  createNewButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  createNewIcon: {
    color: '#22D3EE',
    fontSize: 20,
    fontWeight: 'bold',
  },
  createNewText: {
    color: '#8a9999',
    fontSize: 14,
  },
  // Send Button
  sendButton: {
    backgroundColor: 'transparent',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#22D3EE',
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  sendButtonDisabled: {
    opacity: 0.3,
  },
  sendButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
  },
  // Connectivity Status
  connectivityBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  connectivityText: {
    color: '#22D3EE',
    fontSize: 12,
  },
});

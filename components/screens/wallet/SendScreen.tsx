import { WalletFactory } from '@/src/infrastructure/wallet';
import type { ConnectivityStatus } from '@/src/infrastructure/wallet/utils/connectivity';
import * as ConnectivityUtils from '@/src/infrastructure/wallet/utils/connectivity';
import '@/src/polyfills';
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
import SendSettingsModal from '../../modals/SettingsModal';
import { useWalletTabs } from '../../wallet/WalletTabsContext';

export default function SendScreen({ hideHeader = false }: { hideHeader?: boolean } = {}) {
  const router = useRouter();
  const tabs = useWalletTabs();
  const [publicKey, setPublicKey] = useState<string>('');
  const [amount, setAmount] = useState('0.00');
  // TODO: Token Selector
  const [token, setToken] = useState('SOL');
  const [recipient, setRecipient] = useState('');
  //TODO: Fetch actual balance from blockchain (native token balance and selected token balance)
  const [balance, setBalance] = useState('0.0000');
  const [connectivity, setConnectivity] = useState<ConnectivityStatus | null>(null);

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

  const handleQRScan = () => {
    Alert.alert('QR Scanner', 'QR scanner coming soon');
  };

  const handleTokenDropdown = () => {
    Alert.alert('Select Token', 'Token selector coming soon');
  };

  const handleMaxAmount = () => {
    // Set amount to full available balance
    setAmount(balance);
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

    // Determine send method based on connectivity
    const mode = sendCheck.useOfflineMode ? 'Bluetooth Mesh' : 'Internet';
    Alert.alert(
      'Send Transaction',
      `Sending ${amount} ${token} to ${recipient.slice(0, 8)}... via ${mode}`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm',
          onPress: () => {
            // TODO: Implement actual transaction logic
            console.log(`[Send] Transaction via ${mode}:`, {
              amount,
              token,
              recipient,
              useOfflineMode: sendCheck.useOfflineMode
            });
          }
        }
      ]
    );
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Amount Section */}
        <View style={styles.amountSection}>
        <Text style={styles.amountLabel}>Amount</Text>
        <View style={styles.amountInputContainer}>
          <TextInput
            style={styles.amountInput}
            value={amount}
            onChangeText={setAmount}
            keyboardType="decimal-pad"
            placeholder="0.00"
            placeholderTextColor="#4a6c6c"
          />
        </View>
        <View style={styles.balanceRow}>
          <Text style={styles.availableBalance}>available balance = {balance} {token}</Text>
          <TouchableOpacity style={styles.maxButton} onPress={handleMaxAmount}>
            <Text style={styles.maxButtonText}>Max</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Token Selector */}
      <View style={styles.tokenSelectorContainer}>
        <TouchableOpacity style={styles.tokenSelector} onPress={handleTokenDropdown}>
          <Text style={styles.tokenText}>{token}</Text>
          <Text style={styles.dropdownIcon}>▼</Text>
        </TouchableOpacity>
      </View>

      {/* Recipient Address Input */}
      <View style={styles.recipientContainer}>
        <TextInput
          style={styles.recipientInput}
          placeholder="Enter recipient address.."
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

      {/* Connectivity Status */}
      {connectivity && (
        <TouchableOpacity 
          style={styles.connectivityBanner}
          onPress={async () => {
            if (!connectivity.isBluetoothAvailable) {
              const btStatus = await ConnectivityUtils.getBluetoothStateString();
              Alert.alert(
                'Bluetooth Status',
                btStatus,
                [
                  { text: 'OK' },
                  {
                    text: 'Check Again',
                    onPress: async () => {
                      const status = await ConnectivityUtils.getConnectivityStatus();
                      setConnectivity(status);
                    }
                  }
                ]
              );
            } else {
              Alert.alert(
                'Connection Status',
                connectivity.isInternetConnected 
                  ? `You're connected to the internet via ${connectivity.connectionType}. Transactions will be sent directly to the Solana network.`
                  : 'You\'re in offline mode. Transactions will be sent via Bluetooth mesh network to nearby devices.',
                [{ text: 'Got it' }]
              );
            }
          }}
        >
          <View style={[
            styles.statusDot,
            { backgroundColor: connectivity.isInternetConnected ? '#00d9ff' : 
                              connectivity.isBluetoothAvailable ? '#ffa500' : '#ff4444' }
          ]} />
          <Text style={styles.connectivityText}>
            {connectivity.isInternetConnected 
              ? `Connected via ${connectivity.connectionType || 'Internet'}`
              : connectivity.isBluetoothAvailable
              ? 'Offline mode - Using Bluetooth Mesh'
              : 'No connection available - Tap for details'
            }
          </Text>
        </TouchableOpacity>
      )}

      {/* Send Button */}
      <TouchableOpacity
        style={[
          styles.sendButton,
          (!recipient || !amount || parseFloat(amount) <= 0) && styles.sendButtonDisabled
        ]}
        onPress={handleSendTransaction}
        disabled={!recipient || !amount || parseFloat(amount) <= 0}
      >
        <Text style={styles.sendButtonText}>Send {token}</Text>
      </TouchableOpacity>

      </ScrollView>

      {/* Settings Modal */}
      <SendSettingsModal
        visible={tabs.showSettings}
        onClose={() => tabs.setShowSettings(false)}
        walletAddress={publicKey}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 32,
    paddingBottom: 24,
  },
  // Amount Section
  amountSection: {
    marginBottom: 24,
  },
  amountLabel: {
    color: '#7a9999',
    fontSize: 14,
    marginBottom: 8,
  },
  amountInputContainer: {
    backgroundColor: '#0d4d4d',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#00d9ff',
    paddingHorizontal: 20,
    paddingVertical: 16,
    marginBottom: 8,
  },
  amountInput: {
    color: '#fff',
    fontSize: 48,
    fontWeight: '600',
    textAlign: 'center',
  },
  balanceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  availableBalance: {
    color: '#7a9999',
    fontSize: 14,
  },
  maxButton: {
    backgroundColor: '#1a3333',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: '#00d9ff',
  },
  maxButtonText: {
    color: '#00d9ff',
    fontSize: 14,
    fontWeight: '600',
  },
  // Token Selector
  tokenSelectorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 24,
  },
  menuButtonTouchable: {
    backgroundColor: '#0d4d4d',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#00d9ff',
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuButton: {
    width: 20,
    height: 16,
    justifyContent: 'space-between',
  },
  menuLine: {
    height: 2,
    backgroundColor: '#00d9ff',
    borderRadius: 1,
  },
  tokenSelector: {
    flex: 1,
    backgroundColor: '#0d4d4d',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#00d9ff',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  tokenText: {
    flex: 1,
    color: '#fff',
    fontSize: 18,
    fontWeight: '500',
  },
  dropdownIcon: {
    color: '#00d9ff',
    fontSize: 16,
  },
  // Recipient Input
  recipientContainer: {
    backgroundColor: '#0d4d4d',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#00d9ff',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    marginBottom: 16,
  },
  recipientInput: {
    flex: 1,
    color: '#fff',
    fontSize: 16,
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
    borderColor: '#00d9ff',
  },
  qrCornerTR: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 8,
    height: 8,
    borderTopWidth: 2,
    borderRightWidth: 2,
    borderColor: '#00d9ff',
  },
  qrCornerBL: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    width: 8,
    height: 8,
    borderBottomWidth: 2,
    borderLeftWidth: 2,
    borderColor: '#00d9ff',
  },
  qrCornerBR: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 8,
    height: 8,
    borderBottomWidth: 2,
    borderRightWidth: 2,
    borderColor: '#00d9ff',
  },
  // Connectivity Status
  connectivityBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0d4d4d',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 16,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  connectivityText: {
    color: '#7a9999',
    fontSize: 13,
    flex: 1,
  },
  // Send Button
  sendButton: {
    backgroundColor: '#00d9ff',
    borderRadius: 12,
    paddingVertical: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  sendButtonDisabled: {
    backgroundColor: '#0d4d4d',
    opacity: 0.5,
  },
  sendButtonText: {
    color: '#000',
    fontSize: 18,
    fontWeight: '600',
  },
});

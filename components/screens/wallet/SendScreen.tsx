import { WalletFactory } from '@/src/infrastructure/wallet';
import '@/src/polyfills';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  Alert,
  Clipboard,
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
  const [token, setToken] = useState('SOL');
  const [recipient, setRecipient] = useState('');
  const [balance, setBalance] = useState('0.0000');

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

  const handleClose = () => {
    router.back();
  };

  const handleReceive = () => {
    tabs.setTab('wallet');
  };

  const handleSend = () => {
    // Already on send tab
  };

  const handleCopyAddress = () => {
    if (publicKey) {
      Clipboard.setString(publicKey);
      Alert.alert('Copied!', 'Wallet address copied to clipboard');
    }
  };

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

  const handleSettings = () => {
    tabs.setShowSettings(true);
  };

  const handleSendTransaction = () => {
    if (!recipient) {
      Alert.alert('Error', 'Please enter recipient address');
      return;
    }
    Alert.alert('Send', `Sending ${amount} ${token} to ${recipient.slice(0, 8)}...`);
  };

  return (
    <View style={styles.container}>
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
        <TouchableOpacity onPress={handleSettings} style={styles.menuButtonTouchable}>
          <View style={styles.menuButton}>
            <View style={styles.menuLine} />
            <View style={styles.menuLine} />
            <View style={styles.menuLine} />
          </View>
        </TouchableOpacity>
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

      {/* Settings Modal */}
      <SendSettingsModal
        visible={tabs.showSettings}
        onClose={() => tabs.setShowSettings(false)}
        walletAddress={publicKey}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 32,
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
});

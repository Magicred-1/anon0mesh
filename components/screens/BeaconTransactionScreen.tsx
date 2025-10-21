import React, { useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Switch, Text, TextInput, TouchableOpacity, View } from 'react-native';
import {
  BeaconCapabilities,
  TokenType,
  TransactionStatus,
  TransactionStatusResponse
} from '../../src/solana/BeaconManager';
import { useSolanaWallet } from '../../src/solana/useSolanaWallet';
import { useMeshNetworking } from '../networking/MeshNetworkingManager';

interface BeaconTransactionScreenProps {
  pubKey: string;
  nickname: string;
  onMessageReceived: (message: any) => void;
  hasInternetConnection?: boolean;
}

const BeaconTransactionScreen: React.FC<BeaconTransactionScreenProps> = ({
  pubKey,
  nickname,
  onMessageReceived,
  hasInternetConnection = false,
}) => {
  const [toAddress, setToAddress] = useState('');
  const [amount, setAmount] = useState('');
  const [memo, setMemo] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedTokenType, setSelectedTokenType] = useState<TokenType>(TokenType.SOL);
  const [selectedNetwork, setSelectedNetwork] = useState<'devnet' | 'mainnet-beta' | 'testnet'>('devnet');
  const [transactionStatuses, setTransactionStatuses] = useState<TransactionStatusResponse[]>([]);
  const [isBeaconMode, setIsBeaconMode] = useState(hasInternetConnection);

  // Initialize Solana wallet
  const solanaWallet = useSolanaWallet({
    network: selectedNetwork,
  });

  // Beacon capabilities based on current settings
  const beaconCapabilities: BeaconCapabilities = {
    hasInternetConnection: isBeaconMode,
    supportedNetworks: isBeaconMode ? ['devnet', 'testnet', 'mainnet-beta'] : [],
    supportedTokens: isBeaconMode ? [TokenType.SOL, TokenType.USDC] : [],
    maxTransactionSize: 1232,
    priorityFeeSupport: true,
    rpcEndpoints: isBeaconMode ? ['https://api.devnet.solana.com'] : [],
    lastOnlineTimestamp: isBeaconMode ? Date.now() : 0,
  };

  // Initialize mesh networking with beacon support
  const meshNetworking = useMeshNetworking(
    pubKey,
    nickname,
    onMessageReceived,
    (transaction) => {
      console.log('Transaction received via mesh:', transaction);
      Alert.alert('Transaction Received', `Transaction from ${transaction.fromPeer} has been received`);
    },
    (status: TransactionStatusResponse) => {
      console.log('Transaction status update:', status);
      setTransactionStatuses(prev => {
        const existing = prev.find(s => s.requestId === status.requestId);
        if (existing) {
          return prev.map(s => s.requestId === status.requestId ? status : s);
        } else {
          return [...prev, status];
        }
      });
      
      // Show alert for important status updates
      if (status.status === TransactionStatus.CONFIRMED) {
        Alert.alert('Transaction Confirmed', `Transaction ${status.requestId} has been confirmed!`);
      } else if (status.status === TransactionStatus.FAILED) {
        Alert.alert('Transaction Failed', `Transaction ${status.requestId} failed: ${status.error}`);
      }
    },
    solanaWallet.wallet?.getConnection(),
    beaconCapabilities
  );

  // Initialize wallet on component mount
  useEffect(() => {
    if (pubKey) {
      solanaWallet.initializeWallet(pubKey);
    }
  }, [pubKey, solanaWallet]);

  // Update beacon capabilities when beacon mode changes
  useEffect(() => {
    const updatedCapabilities: Partial<BeaconCapabilities> = {
      hasInternetConnection: isBeaconMode,
      supportedNetworks: isBeaconMode ? ['devnet', 'testnet', 'mainnet-beta'] : [],
      supportedTokens: isBeaconMode ? [TokenType.SOL, TokenType.USDC] : [],
      lastOnlineTimestamp: isBeaconMode ? Date.now() : 0,
    };
    meshNetworking.updateBeaconCapabilities(updatedCapabilities);
  }, [isBeaconMode, meshNetworking]);

  const handleSendViaBeacon = async () => {
    if (!toAddress || !amount) {
      Alert.alert('Error', 'Please fill in all required fields');
      return;
    }

    if (!solanaWallet.isInitialized) {
      Alert.alert('Error', 'Wallet not initialized');
      return;
    }

    setIsSubmitting(true);
    try {
      // Create transaction
      const transaction = await solanaWallet.createTransferTransaction(
        toAddress,
        parseFloat(amount),
        { 
          memo: memo || `Sent via anon0mesh beacon by ${nickname}`,
          priorityFee: 5000, // 0.005 SOL priority fee
        }
      );

      // Sign transaction
      const signedTx = solanaWallet.signTransaction(transaction);

      // Send via beacon network
      const requestId = meshNetworking.sendTransactionViaBeacon(
        signedTx,
        selectedTokenType,
        selectedNetwork,
        {
          recipientPubKey: toAddress,
          amount: amount,
          memo: memo || `Sent via anon0mesh beacon by ${nickname}`,
          priorityFee: 5000,
          maxRetries: 3,
          expiresIn: 300, // 5 minutes
        }
      );
      
      if (requestId) {
        Alert.alert('Success', `Transaction request ${requestId} sent to beacon network!`);
        
        // Clear form
        setToAddress('');
        setAmount('');
        setMemo('');
      }
    } catch (error) {
      console.error('Beacon transaction failed:', error);
      Alert.alert('Error', 'Failed to send via beacon: ' + (error instanceof Error ? error.message : 'Unknown error'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRequestAirdrop = async () => {
    if (!solanaWallet.isInitialized) {
      Alert.alert('Error', 'Wallet not initialized');
      return;
    }

    try {
      const signature = await solanaWallet.requestAirdrop(1);
      Alert.alert('Airdrop Success', `1 SOL airdropped! Signature: ${signature.slice(0, 20)}...`);
    } catch (error) {
      console.error('Airdrop failed:', error);
      Alert.alert('Error', 'Airdrop failed: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
  };

  const formatBalance = (balance: number) => {
    return `${balance.toFixed(4)} SOL`;
  };

  const formatAddress = (address: string) => {
    return `${address.slice(0, 8)}...${address.slice(-8)}`;
  };

  const getStatusColor = (status: TransactionStatus) => {
    switch (status) {
      case TransactionStatus.PENDING: return '#FFA500';
      case TransactionStatus.SUBMITTED: return '#00BFFF';
      case TransactionStatus.CONFIRMED: return '#00FF00';
      case TransactionStatus.FAILED: return '#FF0000';
      case TransactionStatus.EXPIRED: return '#808080';
      default: return '#FFFFFF';
    }
  };

  const beaconStats = meshNetworking.getBeaconStats();
  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>anon0mesh Beacon Network</Text>
      
      {/* Beacon Mode Toggle */}
      <View style={styles.beaconToggle}>
        <Text style={styles.label}>Beacon Mode (Internet Connection):</Text>
        <Switch
          value={isBeaconMode}
          onValueChange={setIsBeaconMode}
          trackColor={{ false: '#767577', true: '#A855F7' }}
          thumbColor={isBeaconMode ? '#fff' : '#f4f3f4'}
        />
      </View>

      {/* Wallet Info */}
      <View style={styles.walletInfo}>
        <Text style={styles.label}>Address:</Text>
        <Text style={styles.address}>
          {solanaWallet.publicKey ? formatAddress(solanaWallet.publicKey) : 'Not initialized'}
        </Text>
        
        <Text style={styles.label}>Balance:</Text>
        <Text style={styles.balance}>{formatBalance(solanaWallet.balance)}</Text>
        
        <Text style={styles.label}>Network: {selectedNetwork}</Text>
      </View>

      {/* Network Selection */}
      <View style={styles.form}>
        <Text style={styles.label}>Network</Text>
        <View style={styles.buttonRow}>
          {(['devnet', 'testnet', 'mainnet-beta'] as const).map((network) => (
            <TouchableOpacity
              key={network}
              style={[
                styles.networkButton,
                selectedNetwork === network && styles.selectedNetworkButton
              ]}
              onPress={() => setSelectedNetwork(network)}
            >
              <Text style={[
                styles.networkButtonText,
                selectedNetwork === network && styles.selectedNetworkButtonText
              ]}>
                {network}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Token Type Selection */}
        <Text style={styles.label}>Token Type</Text>
        <View style={styles.buttonRow}>
          {[TokenType.SOL, TokenType.USDC].map((token) => (
            <TouchableOpacity
              key={token}
              style={[
                styles.tokenButton,
                selectedTokenType === token && styles.selectedTokenButton
              ]}
              onPress={() => setSelectedTokenType(token)}
            >
              <Text style={[
                styles.tokenButtonText,
                selectedTokenType === token && styles.selectedTokenButtonText
              ]}>
                {token}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        
        <TextInput
          style={styles.input}
          placeholder="Recipient Address"
          placeholderTextColor="#888"
          value={toAddress}
          onChangeText={setToAddress}
        />
        
        <TextInput
          style={styles.input}
          placeholder={`Amount (${selectedTokenType})`}
          placeholderTextColor="#888"
          value={amount}
          onChangeText={setAmount}
          keyboardType="decimal-pad"
        />
        
        <TextInput
          style={styles.input}
          placeholder="Memo (optional)"
          placeholderTextColor="#888"
          value={memo}
          onChangeText={setMemo}
        />
        
        <TouchableOpacity
          style={[styles.button, styles.beaconButton]}
          onPress={handleSendViaBeacon}
          disabled={isSubmitting || !solanaWallet.isInitialized}
        >
          <Text style={styles.buttonText}>
            Send via Beacon Network
          </Text>
        </TouchableOpacity>
        
        {selectedNetwork !== 'mainnet-beta' && (
          <TouchableOpacity
            style={[styles.button, styles.airdropButton]}
            onPress={handleRequestAirdrop}
            disabled={!solanaWallet.isInitialized}
          >
            <Text style={styles.buttonText}>Request Airdrop (1 SOL)</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Transaction Status */}
      <View style={styles.transactions}>
        <Text style={styles.label}>Transaction Status</Text>
        {transactionStatuses.length === 0 ? (
          <Text style={styles.noTransactions}>No pending transactions</Text>
        ) : (
          transactionStatuses.map((status, index) => (
            <View key={index} style={styles.transactionItem}>
              <Text style={styles.transactionId}>
                {status.requestId}
              </Text>
              <Text style={[styles.transactionStatus, { color: getStatusColor(status.status) }]}>
                {status.status}
              </Text>
              {status.signature && (
                <Text style={styles.transactionSignature}>
                  Sig: {status.signature.slice(0, 16)}...
                </Text>
              )}
              {status.error && (
                <Text style={styles.transactionError}>
                  Error: {status.error}
                </Text>
              )}
            </View>
          ))
        )}
      </View>

      {solanaWallet.error && (
        <Text style={styles.error}>{solanaWallet.error}</Text>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#000000',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#A855F7',
    textAlign: 'center',
    marginBottom: 20,
  },
  beaconToggle: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#0A0A0A',
    padding: 15,
    borderRadius: 10,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#A855F7',
  },
  walletInfo: {
    backgroundColor: '#0A0A0A',
    padding: 15,
    borderRadius: 10,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#A855F7',
  },
  metrics: {
    backgroundColor: '#0A0A0A',
    padding: 15,
    borderRadius: 10,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#333',
  },
  form: {
    backgroundColor: '#0A0A0A',
    padding: 15,
    borderRadius: 10,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#A855F7',
  },
  transactions: {
    backgroundColor: '#0A0A0A',
    padding: 15,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#333',
    marginBottom: 20,
  },
  label: {
    color: '#A855F7',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  address: {
    color: '#fff',
    fontSize: 14,
    fontFamily: 'monospace',
    marginBottom: 10,
  },
  balance: {
    color: '#00ff00',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  metricText: {
    color: '#ccc',
    fontSize: 14,
    marginBottom: 5,
  },
  beaconText: {
    color: '#A855F7',
    fontSize: 12,
    marginBottom: 3,
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 15,
  },
  networkButton: {
    flex: 1,
    backgroundColor: '#333',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    marginHorizontal: 2,
    alignItems: 'center',
  },
  selectedNetworkButton: {
    backgroundColor: '#A855F7',
  },
  networkButtonText: {
    color: '#ccc',
    fontSize: 12,
    fontWeight: 'bold',
  },
  selectedNetworkButtonText: {
    color: '#fff',
  },
  tokenButton: {
    flex: 1,
    backgroundColor: '#333',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    marginHorizontal: 2,
    alignItems: 'center',
  },
  selectedTokenButton: {
    backgroundColor: '#059669',
  },
  tokenButtonText: {
    color: '#ccc',
    fontSize: 14,
    fontWeight: 'bold',
  },
  selectedTokenButtonText: {
    color: '#fff',
  },
  input: {
    backgroundColor: '#111',
    color: '#fff',
    borderWidth: 1,
    borderColor: '#333',
    borderRadius: 8,
    padding: 12,
    marginBottom: 10,
    fontSize: 16,
  },
  button: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 10,
  },
  beaconButton: {
    backgroundColor: '#A855F7',
  },
  airdropButton: {
    backgroundColor: '#EF4444',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  transactionItem: {
    backgroundColor: '#111',
    padding: 10,
    borderRadius: 6,
    marginBottom: 8,
  },
  transactionId: {
    color: '#A855F7',
    fontSize: 12,
    fontFamily: 'monospace',
    marginBottom: 4,
  },
  transactionStatus: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  transactionSignature: {
    color: '#ccc',
    fontSize: 10,
    fontFamily: 'monospace',
    marginBottom: 2,
  },
  transactionError: {
    color: '#ff6b6b',
    fontSize: 10,
    marginBottom: 2,
  },
  noTransactions: {
    color: '#888',
    fontSize: 14,
    textAlign: 'center',
    marginTop: 10,
  },
  error: {
    color: '#ff0000',
    fontSize: 14,
    textAlign: 'center',
    marginTop: 10,
  },
});

export default BeaconTransactionScreen;
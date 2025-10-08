import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, TextInput, TouchableOpacity, Alert, StyleSheet } from 'react-native';
import { useSolanaWallet } from '../../src/solana/useSolanaWallet';
import { useMeshNetworking } from '../networking/MeshNetworkingManager';
import { TokenType } from '../../src/solana/BeaconManager';
import { RateLimitManager } from '../../src/utils/RateLimitManager';

interface SolanaTransactionScreenProps {
  pubKey: string;
  nickname: string;
  onMessageReceived: (message: any) => void;
}

const SolanaTransactionScreen: React.FC<SolanaTransactionScreenProps> = ({
  pubKey,
  nickname,
  onMessageReceived,
}) => {
  const [toAddress, setToAddress] = useState('');
  const [amount, setAmount] = useState('');
  const [memo, setMemo] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [recentTransactions, setRecentTransactions] = useState<any[]>([]);
  const [rateLimitManager] = useState(() => new RateLimitManager(pubKey));

  // Initialize Solana wallet (using devnet for demo)
  const solanaWallet = useSolanaWallet({
    network: 'devnet',
  });

  // Initialize mesh networking with Solana support
  const meshNetworking = useMeshNetworking(
    pubKey,
    nickname,
    onMessageReceived,
    (transaction) => {
      console.log('Transaction received via mesh:', transaction);
      Alert.alert('Transaction Received', `Transaction from ${transaction.fromPeer} has been relayed`);
    },
    (status) => {
      console.log('Transaction status update:', status);
      // Optionally, show alerts or update state here if needed
      if (status.status === 'CONFIRMED') {
        Alert.alert('Transaction Confirmed', `Transaction ${status.requestId} has been confirmed!`);
      } else if (status.status === 'FAILED') {
        Alert.alert('Transaction Failed', `Transaction ${status.requestId} failed: ${status.error}`);
      }
    }
  );

  const loadRecentTransactions = useCallback(async () => {
    try {
      const transactions = await solanaWallet.getRecentTransactions(5);
      setRecentTransactions(transactions);
    } catch (error) {
      console.error('Failed to load recent transactions:', error);
    }
  }, [solanaWallet]);

  // Initialize wallet on component mount
  useEffect(() => {
    if (pubKey) {
      solanaWallet.initializeWallet(pubKey);
    }
  }, [pubKey, solanaWallet]);

  // Load recent transactions
  useEffect(() => {
    if (solanaWallet.isInitialized) {
      loadRecentTransactions();
    }
  }, [solanaWallet.isInitialized, loadRecentTransactions]);

  const handleSendViaDirect = async () => {
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
        { memo: memo || `Sent by ${nickname}` }
      );

      // Sign transaction
      const signedTx = solanaWallet.signTransaction(transaction);

      // Submit directly to Solana network
      const signature = await solanaWallet.submitTransaction(signedTx);
      
      // Unlock unlimited messaging after successful transaction
      await rateLimitManager.unlockMessaging();
      
      Alert.alert(
        '✅ Transaction Sent!', 
        `Transaction successful!\n\n` +
        `Signature: ${signature.slice(0, 20)}...\n\n` +
        `🎉 Bonus: You now have unlimited messaging for today!`,
        [{ text: 'Awesome!' }]
      );
      
      // Clear form
      setToAddress('');
      setAmount('');
      setMemo('');
      
      // Refresh transactions
      await loadRecentTransactions();
    } catch (error) {
      console.error('Transaction failed:', error);
      Alert.alert('Error', 'Transaction failed: ' + (error instanceof Error ? error.message : 'Unknown error'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSendViaMesh = async () => {
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
          memo: memo || `Sent via anon0mesh by ${nickname}`,
          priorityFee: 1000, // 0.001 SOL priority fee
        }
      );

      // Sign transaction
      const signedTx = solanaWallet.signTransaction(transaction);

      meshNetworking.sendTransactionViaBeacon(
        signedTx,
        TokenType.SOL,
        'devnet'
      );
      
      // Unlock unlimited messaging after successful transaction
      await rateLimitManager.unlockMessaging();
      
      Alert.alert(
        '✅ Transaction Broadcasted!', 
        `Transaction sent to anon0mesh network!\n\n` +
        `🎉 Bonus: You now have unlimited messaging for today!`,
        [{ text: 'Awesome!' }]
      );
      
      // Clear form
      setToAddress('');
      setAmount('');
      setMemo('');
    } catch (error) {
      console.error('Mesh transaction failed:', error);
      Alert.alert('Error', 'Failed to send via mesh: ' + (error instanceof Error ? error.message : 'Unknown error'));
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

  // Get beacon stats for mesh network information
  const beaconStats = meshNetworking.getBeaconStats();

  return (
    <View style={styles.container}>
      <Text style={styles.title}>anon0mesh Solana Wallet</Text>
      
      {/* Wallet Info */}
      <View style={styles.walletInfo}>
        <Text style={styles.label}>Address:</Text>
        <Text style={styles.address}>
          {solanaWallet.publicKey ? formatAddress(solanaWallet.publicKey) : 'Not initialized'}
        </Text>
        
        <Text style={styles.label}>Balance:</Text>
        <Text style={styles.balance}>{formatBalance(solanaWallet.balance)}</Text>
        
        <Text style={styles.label}>Network: Devnet</Text>
      </View>

      {/* Mesh Metrics */}
      <View style={styles.metrics}>
        <Text style={styles.label}>Mesh Network Status:</Text>
        <Text style={styles.metricText}>Known Beacons: {beaconStats?.knownBeacons || 0}</Text>
        <Text style={styles.metricText}>Pending Requests: {beaconStats?.pendingRequests || 0}</Text>
        <Text style={styles.metricText}>Is Beacon: {beaconStats?.isBeacon ? 'Yes' : 'No'}</Text>
      </View>

      {/* Transaction Form */}
      <View style={styles.form}>
        <Text style={styles.label}>Send SOL</Text>
        
        <TextInput
          style={styles.input}
          placeholder="Recipient Address"
          placeholderTextColor="#888"
          value={toAddress}
          onChangeText={setToAddress}
        />
        
        <TextInput
          style={styles.input}
          placeholder="Amount (SOL)"
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
        
        <View style={styles.buttonRow}>
          <TouchableOpacity
            style={[styles.button, styles.directButton]}
            onPress={handleSendViaDirect}
            disabled={isSubmitting || !solanaWallet.isInitialized}
          >
            <Text style={styles.buttonText}>Send Direct</Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[styles.button, styles.meshButton]}
            onPress={handleSendViaMesh}
            disabled={isSubmitting || !solanaWallet.isInitialized}
          >
            <Text style={styles.buttonText}>Send via Mesh</Text>
          </TouchableOpacity>
        </View>
        
        <TouchableOpacity
          style={[styles.button, styles.airdropButton]}
          onPress={handleRequestAirdrop}
          disabled={!solanaWallet.isInitialized}
        >
          <Text style={styles.buttonText}>Request Airdrop (1 SOL)</Text>
        </TouchableOpacity>
      </View>

      {/* Recent Transactions */}
      <View style={styles.transactions}>
        <Text style={styles.label}>Recent Transactions</Text>
        {recentTransactions.length === 0 ? (
          <Text style={styles.noTransactions}>No recent transactions</Text>
        ) : (
          recentTransactions.map((tx, index) => (
            <View key={index} style={styles.transactionItem}>
              <Text style={styles.transactionSignature}>
                {formatAddress(tx.signature)}
              </Text>
              <Text style={styles.transactionStatus}>
                {tx.err ? 'Failed' : 'Success'}
              </Text>
            </View>
          ))
        )}
      </View>

      {solanaWallet.error && (
        <Text style={styles.error}>{solanaWallet.error}</Text>
      )}
    </View>
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
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  button: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center',
    flex: 1,
    marginHorizontal: 5,
  },
  directButton: {
    backgroundColor: '#059669',
  },
  meshButton: {
    backgroundColor: '#A855F7',
  },
  airdropButton: {
    backgroundColor: '#EF4444',
    marginHorizontal: 0,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  transactionItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  transactionSignature: {
    color: '#ccc',
    fontSize: 14,
    fontFamily: 'monospace',
  },
  transactionStatus: {
    color: '#00ff00',
    fontSize: 14,
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

export default SolanaTransactionScreen;
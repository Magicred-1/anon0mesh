import { Transaction, useTransactionHistory } from '@/hooks/useTransactionHistory';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import React, { useEffect } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import BottomNavWithMenu from '../ui/BottomNavWithMenu';

// Mock data pour le design
const MOCK_TRANSACTIONS: Transaction[] = [
  {
    id: 'mock-1',
    type: 'Send',
    address: '8nXF...QyaS',
    amount: '99.08',
    currency: 'USDC',
    status: 'Pending',
    timestamp: '18 Oct. 2025 - 11.30 AM',
    signature: 'mock-signature-1',
  },
  {
    id: 'mock-2',
    type: 'Send',
    address: '8nXF...QyaS',
    amount: '99.08',
    currency: 'USDC',
    status: 'Success',
    timestamp: '18 Oct. 2025 - 11.30 AM',
    signature: 'mock-signature-2',
  },
  {
    id: 'mock-3',
    type: 'Send',
    address: '8nXF...QyaS',
    amount: '99.08',
    currency: 'USDC',
    status: 'Pending',
    timestamp: '18 Oct. 2025 - 11.30 AM',
    signature: 'mock-signature-3',
  },
  {
    id: 'mock-4',
    type: 'Send',
    address: '7xKX...9mP3',
    amount: '250.50',
    currency: 'USDC',
    status: 'Pending',
    timestamp: '17 Oct. 2025 - 03.45 PM',
    signature: 'mock-signature-4',
  },
  {
    id: 'mock-5',
    type: 'Receive',
    address: '9mP3...7xKX',
    amount: '1250.00',
    currency: 'USDC',
    status: 'Success',
    timestamp: '16 Oct. 2025 - 09.15 AM',
    signature: 'mock-signature-5',
  },
  {
    id: 'mock-6',
    type: 'Send',
    address: '3aBc...2xYz',
    amount: '50.25',
    currency: 'USDC',
    status: 'Pending',
    timestamp: '15 Oct. 2025 - 02.20 PM',
    signature: 'mock-signature-6',
  },
  {
    id: 'mock-7',
    type: 'Receive',
    address: '8yZw...4vBx',
    amount: '500.75',
    currency: 'USDC',
    status: 'Pending',
    timestamp: '14 Oct. 2025 - 10.10 AM',
    signature: 'mock-signature-7',
  },
  {
    id: 'mock-8',
    type: 'Send',
    address: '2xYz...9mP3',
    amount: '75.00',
    currency: 'USDC',
    status: 'Success',
    timestamp: '13 Oct. 2025 - 04.50 PM',
    signature: 'mock-signature-8',
  },
];

// Variable pour activer/désactiver les données mock (mettre à true pour utiliser les mock data)
const USE_MOCK_DATA = false;

export default function HistoryScreen() {
  const router = useRouter();

  // Use the custom hook for fetching transactions
  // refetch is available for future pull-to-refresh functionality
  const { transactions: realTransactions, loading, error, walletAddress } = useTransactionHistory();

  // Utiliser les mock data ou les vraies données selon USE_MOCK_DATA
  const transactions = USE_MOCK_DATA ? MOCK_TRANSACTIONS : realTransactions;

  // Show error alert if there's an error
  useEffect(() => {
    if (error) {
      Alert.alert(
        error.includes('Rate limit') ? 'Rate Limit' : 'Error',
        error,
        [{ text: 'OK' }]
      );
    }
  }, [error]);
  const handleTransactionPress = (transaction: Transaction) => {
    Alert.alert(
      'Transaction Details',
      `Signature: ${transaction.signature}\n\n${transaction.type} ${transaction.type === 'Send' ? 'to' : 'from'} ${transaction.address}\n\nAmount: ${transaction.amount} ${transaction.currency}\nStatus: ${transaction.status}\nTime: ${transaction.timestamp}`,
      [
        { text: 'Close', style: 'cancel' },
        {
          text: 'View on Explorer',
          onPress: () => {
            console.log('[History] View on explorer:', transaction.signature);
            Alert.alert('Explorer', `https://explorer.solana.com/tx/${transaction.signature}?cluster=devnet`);
          },
        },
      ]
    );
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
          <Text style={styles.headerTitle}>History</Text>
        </View>

        {/* Transaction List */}
        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {!USE_MOCK_DATA && loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#22D3EE" />
              <Text style={styles.loadingText}>Loading transactions...</Text>
            </View>
          ) : transactions.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No transactions found</Text>
              <Text style={styles.emptySubtext}>
                {walletAddress ? 'Your transaction history will appear here' : 'Connect your wallet to view transactions'}
              </Text>
            </View>
          ) : (
            <View style={styles.transactionsList}>
              {transactions.map((transaction) => (
                <TouchableOpacity
                  key={transaction.id}
                  style={styles.transactionItem}
                  onPress={() => handleTransactionPress(transaction)}
                >
                  <View style={styles.transactionLeft}>
                    <View
                      style={[
                        styles.statusBadge,
                        transaction.status === 'Success'
                          ? styles.statusSuccess
                          : styles.statusPending,
                      ]}
                    >
                      <View
                        style={[
                          styles.statusDot,
                          transaction.status === 'Success'
                            ? styles.statusDotSuccess
                            : styles.statusDotPending,
                        ]}
                      />
                      <Text
                        style={[
                          styles.statusText,
                          transaction.status === 'Success'
                            ? styles.statusTextSuccess
                            : styles.statusTextPending,
                        ]}
                      >
                        {transaction.status}
                      </Text>
                    </View>
                    <Text style={styles.transactionType}>
                      {transaction.type} to {transaction.address}
                    </Text>
                    <Text style={styles.transactionTime}>{transaction.timestamp}</Text>

                  </View>
                  <View style={styles.transactionRight}>
                    <Text style={styles.transactionAmount}>
                      {transaction.amount} {transaction.currency}
                    </Text>

                  </View>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </ScrollView>

        {/* Bottom Navigation */}
        <BottomNavWithMenu
          onNavigateToMessages={() => router.push('/chat')}
          onNavigateToWallet={() => router.push('/wallet')}
          onNavigateToHistory={() => router.push('/wallet/history')}
          onNavigateToMeshZone={() => router.push('/zone')}
          onNavigateToProfile={() => router.push('/profile')}
          onDisconnect={() => router.push('/landing')}
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
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: 'transparent',
    borderBottomWidth: 2,
    borderBottomColor: '#22D3EE',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#fff',
  },
  content: {
    flex: 1,
  },
  transactionsList: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 20,
  },
  transactionItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#072B31',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  transactionLeft: {
    flex: 1,
    gap: 6,
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  transactionType: {
    fontSize: 16,
    color: '#FFFFFF',
    fontWeight: '500',
  },
  transactionTime: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  transactionRight: {
    alignItems: 'flex-end',
    gap: 8,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    gap: 6,
  },
  statusSuccess: {
    backgroundColor: '#22D3EE',
    borderWidth: 0,
  },
  statusPending: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#22D3EE',
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusDotSuccess: {
    backgroundColor: '#0D0D0D',
  },
  statusDotPending: {
    backgroundColor: '#22D3EE',
  },
  statusText: {
    fontSize: 12,
    fontWeight: '500',
  },
  statusTextSuccess: {
    color: '#0D0D0D',
  },
  statusTextPending: {
    color: '#FFFFFF',
  },
  transactionAmount: {
    fontSize: 18,
    color: '#FFFFFF',
    fontWeight: '600',
    marginBottom: 4,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#8a9999',
    fontWeight: '500',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
    paddingHorizontal: 40,
  },
  emptyText: {
    fontSize: 18,
    color: '#FFFFFF',
    fontWeight: '600',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#8a9999',
    textAlign: 'center',
    lineHeight: 20,
  },
});

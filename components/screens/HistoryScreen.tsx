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

export default function HistoryScreen() {
  const router = useRouter();
  
  // Use the custom hook for fetching transactions
  // refetch is available for future pull-to-refresh functionality
  const { transactions, loading, error, walletAddress } = useTransactionHistory();

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
          {loading ? (
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
                  <Text style={styles.transactionType}>
                    {transaction.type} to {transaction.address}
                  </Text>
                  <Text style={styles.transactionTime}>{transaction.timestamp}</Text>
                </View>
                <View style={styles.transactionRight}>
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
          onNavigateToProfile={() => router.push('/selection')}
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
    backgroundColor: '#0d3333',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#1a4444',
  },
  transactionLeft: {
    flex: 1,
    gap: 6,
  },
  transactionType: {
    fontSize: 16,
    color: '#FFFFFF',
    fontWeight: '500',
  },
  transactionTime: {
    fontSize: 12,
    color: '#8a9999',
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
    borderRadius: 12,
    gap: 6,
    borderWidth: 1,
  },
  statusSuccess: {
    backgroundColor: 'rgba(34, 211, 238, 0.1)',
    borderColor: '#22D3EE',
  },
  statusPending: {
    backgroundColor: 'rgba(34, 211, 238, 0.1)',
    borderColor: '#22D3EE',
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusDotSuccess: {
    backgroundColor: '#22D3EE',
  },
  statusDotPending: {
    backgroundColor: '#22D3EE',
  },
  statusText: {
    fontSize: 12,
    fontWeight: '500',
  },
  statusTextSuccess: {
    color: '#22D3EE',
  },
  statusTextPending: {
    color: '#22D3EE',
  },
  transactionAmount: {
    fontSize: 16,
    color: '#FFFFFF',
    fontWeight: '600',
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

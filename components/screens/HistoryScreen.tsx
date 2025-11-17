import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
    Alert,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import BottomNavWithMenu from '../ui/BottomNavWithMenu';

// Mock transaction data
const MOCK_TRANSACTIONS = [
  {
    id: '1',
    type: 'Send',
    address: '8nXF...QyaS',
    amount: '99.08',
    currency: 'USDC',
    status: 'Pending',
    timestamp: '18 Oct. 2025 - 11:30 AM',
  },
  {
    id: '2',
    type: 'Send',
    address: '8nXF...QyaS',
    amount: '99.08',
    currency: 'USDC',
    status: 'Success',
    timestamp: '18 Oct. 2025 - 11:30 AM',
  },
  {
    id: '3',
    type: 'Send',
    address: '8nXF...QyaS',
    amount: '99.08',
    currency: 'USDC',
    status: 'Pending',
    timestamp: '18 Oct. 2025 - 11:30 AM',
  },
  {
    id: '4',
    type: 'Send',
    address: '8nXF...QyaS',
    amount: '99.08',
    currency: 'USDC',
    status: 'Success',
    timestamp: '18 Oct. 2025 - 11:30 AM',
  },
  {
    id: '5',
    type: 'Send',
    address: '8nXF...QyaS',
    amount: '99.08',
    currency: 'USDC',
    status: 'Pending',
    timestamp: '18 Oct. 2025 - 11:30 AM',
  },
  {
    id: '6',
    type: 'Send',
    address: '8nXF...QyaS',
    amount: '99.08',
    currency: 'USDC',
    status: 'Success',
    timestamp: '18 Oct. 2025 - 11:30 AM',
  },
  {
    id: '7',
    type: 'Send',
    address: '8nXF...QyaS',
    amount: '99.08',
    currency: 'USDC',
    status: 'Pending',
    timestamp: '18 Oct. 2025 - 11:30 AM',
  },
  {
    id: '8',
    type: 'Send',
    address: '8nXF...QyaS',
    amount: '99.08',
    currency: 'USDC',
    status: 'Success',
    timestamp: '18 Oct. 2025 - 11:30 AM',
  },
];

export default function HistoryScreen() {
  const router = useRouter();
  const [transactions] = useState(MOCK_TRANSACTIONS);

  const handleTransactionPress = (transaction: typeof MOCK_TRANSACTIONS[0]) => {
    Alert.alert(
      'Transaction Details',
      `${transaction.type} to ${transaction.address}\nAmount: ${transaction.amount} ${transaction.currency}\nStatus: ${transaction.status}\nTime: ${transaction.timestamp}`
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
        </ScrollView>

        {/* Bottom Navigation */}
        <BottomNavWithMenu
          onNavigateToMessages={() => router.push('/chat' as any)}
          onNavigateToWallet={() => router.push('/wallet' as any)}
          onNavigateToHistory={() => {}}
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
});

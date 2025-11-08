/**
 * Example: WalletScreen Component
 * 
 * Shows how to use the wallet adapter in a React Native component
 * with auto-detection for Solana Mobile devices.
 */

import React, { useEffect, useState } from 'react';
import { View, Text, Button, StyleSheet, ActivityIndicator } from 'react-native';
import { WalletFactory, DeviceDetector, IWalletAdapter } from './';

export function WalletScreen() {
  const [wallet, setWallet] = useState<IWalletAdapter | null>(null);
  const [loading, setLoading] = useState(true);
  const [balance, setBalance] = useState<number>(0);
  const [deviceInfo, setDeviceInfo] = useState<any>(null);

  useEffect(() => {
    initializeWallet();
  }, []);

  const initializeWallet = async () => {
    try {
      // Get device info
      const info = DeviceDetector.getDeviceInfo();
      setDeviceInfo(info);

      // Auto-create wallet based on device
      const walletAdapter = await WalletFactory.createAuto();
      
      // If MWA, need to connect
      if (walletAdapter.getMode() === 'mwa') {
        await walletAdapter.connect();
      }

      setWallet(walletAdapter);
      
      // Get balance
      const bal = await walletAdapter.getBalance('https://api.devnet.solana.com');
      setBalance(bal);

      setLoading(false);
    } catch (error) {
      console.error('Wallet init failed:', error);
      setLoading(false);
    }
  };

  const handleDisconnect = async () => {
    if (!wallet) return;
    await wallet.disconnect();
    setWallet(null);
  };

  const handleRefreshBalance = async () => {
    if (!wallet) return;
    const bal = await wallet.getBalance('https://api.devnet.solana.com');
    setBalance(bal);
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" />
        <Text style={styles.text}>Initializing wallet...</Text>
      </View>
    );
  }

  if (!wallet) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>Wallet not connected</Text>
        <Button title="Retry" onPress={initializeWallet} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Device Info */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Device</Text>
        <Text style={styles.text}>
          {deviceInfo?.isSolanaMobile ? '📱 Solana Mobile' : '📱 Standard Device'}
        </Text>
        <Text style={styles.subText}>{deviceInfo?.model}</Text>
      </View>

      {/* Wallet Info */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Wallet</Text>
        <Text style={styles.text}>
          Mode: {wallet.getMode() === 'mwa' ? '🔐 Mobile Wallet' : '💾 Local Wallet'}
        </Text>
        <Text style={styles.address}>
          {wallet.getPublicKey()?.toBase58().slice(0, 8)}...
          {wallet.getPublicKey()?.toBase58().slice(-8)}
        </Text>
      </View>

      {/* Balance */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Balance</Text>
        <Text style={styles.balance}>{balance.toFixed(4)} SOL</Text>
        <Button title="Refresh" onPress={handleRefreshBalance} />
      </View>

      {/* Actions */}
      <View style={styles.actions}>
        <Button 
          title="Disconnect" 
          onPress={handleDisconnect}
          color="#e74c3c"
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#1a1a1a',
  },
  section: {
    marginBottom: 30,
    padding: 15,
    backgroundColor: '#2a2a2a',
    borderRadius: 10,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 10,
  },
  text: {
    fontSize: 16,
    color: '#fff',
    marginBottom: 5,
  },
  subText: {
    fontSize: 14,
    color: '#888',
  },
  address: {
    fontSize: 14,
    color: '#3498db',
    fontFamily: 'monospace',
    marginTop: 5,
  },
  balance: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#2ecc71',
    marginBottom: 10,
  },
  errorText: {
    fontSize: 16,
    color: '#e74c3c',
    marginBottom: 20,
  },
  actions: {
    marginTop: 20,
  },
});

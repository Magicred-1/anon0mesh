import SolanaIcon from '@/components/icons/SolanaIcon';
import { useWallet } from '@/src/contexts/WalletContext';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

type DisposableAddress = {
    id: string;
    address: string;
    balances: {
        sol: number;
        usdc: number;
        zec: number;
    };
};

// Mock data
const MOCK_DISPOSABLE_ADDRESSES: DisposableAddress[] = [
    {
        id: '1',
        address: '8nXF...QgaS',
        balances: { sol: 75.89, usdc: 75.89, zec: 75.89 }
    },
    {
        id: '2',
        address: '8nXF...QgaS',
        balances: { sol: 75.89, usdc: 75.89, zec: 75.89 }
    },
    {
        id: '3',
        address: '8nXF...QgaS',
        balances: { sol: 75.89, usdc: 75.89, zec: 75.89 }
    },
];

export default function WalletSettingsScreen() {
    const router = useRouter();
    
    // Use wallet context for auto-detection
    const { 
        publicKey, 
        isLoading, 
        isConnected,
        walletMode,
        isSolanaMobile,
        deviceInfo,
        connect
    } = useWallet();
    
    const [disposableAddresses, setDisposableAddresses] = useState<DisposableAddress[]>(MOCK_DISPOSABLE_ADDRESSES);

    // Format wallet address for display
    const primaryWallet = publicKey 
        ? `${publicKey.toBase58().slice(0, 4)}...${publicKey.toBase58().slice(-4)}`
        : '';

    // For MWA, we might need to connect first
    const handleConnectWallet = async () => {
        try {
            await connect();
        } catch (err) {
            console.error('[WalletSettings] Connect error:', err);
        }
    };

    const handleBack = () => {
        router.back();
    };

    const handleCopyPrimary = () => {
        // TODO: Implement copy to clipboard
        Alert.alert('Copied', 'Primary wallet address copied to clipboard');
    };

    const handleCopyDisposable = (address: string) => {
        // TODO: Implement copy to clipboard
        Alert.alert('Copied', `Address ${address} copied to clipboard`);
    };

    const handleAddFunds = (addressId: string) => {
        // TODO: Implement add funds functionality
        Alert.alert('Add Funds', `Add funds to address ${addressId}`);
    };

    const handleDeleteAddress = (addressId: string) => {
        Alert.alert(
        'Delete Address',
        'Are you sure you want to delete this disposable address?',
        [
            { text: 'Cancel', style: 'cancel' },
            {
            text: 'Delete',
            style: 'destructive',
            onPress: () => {
                setDisposableAddresses(addresses => 
                addresses.filter(addr => addr.id !== addressId)
                );
            }
            }
        ]
        );
    };

    const handleCreateNewAddress = () => {
        // TODO: Implement create new disposable address
        Alert.alert('Create Address', 'Creating new disposable address...');
    };

    return (
        <LinearGradient
        colors={['#0D0D0D', '#06181B', '#072B31']}
        locations={[0, 0.94, 1]}
        start={{ x: 0.2125, y: 0 }}
        end={{ x: 0.7875, y: 1 }}
        style={styles.container}
        >
        <SafeAreaView style={styles.safeArea}>
            {/* Header */}
            <View style={styles.header}>
            <TouchableOpacity onPress={handleBack} style={styles.backButton}>
                <Text style={styles.backIcon}>‹</Text>
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Settings</Text>
            <View style={styles.placeholder} />
            </View>

            {/* Solana Network Badge */}
            <View style={styles.networkBadge}>
            <SolanaIcon size={20} />
            <Text style={styles.networkText}>Solana Network</Text>
            </View>

            <ScrollView 
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            >
            {/* Primary Wallet Section */}
            <View style={styles.section}>
                <View style={styles.sectionHeader}>
                    <Text style={styles.sectionTitle}>Primary Wallet</Text>
                    {walletMode && (
                        <View style={styles.walletModeBadge}>
                            <Text style={styles.walletModeText}>
                                {walletMode === 'mwa' ? '🔐 MWA' : '📱 Local'}
                            </Text>
                        </View>
                    )}
                </View>
                <View style={styles.primaryWalletCard}>
                {isLoading ? (
                    <View style={styles.loadingContainer}>
                    <ActivityIndicator size="small" color="#22D3EE" />
                    <Text style={styles.loadingText}>
                        {walletMode === 'mwa' ? 'Connecting to wallet...' : 'Loading...'}
                    </Text>
                    </View>
                ) : !isConnected && walletMode === 'mwa' ? (
                    <View style={styles.connectContainer}>
                        <Text style={styles.connectText}>MWA Wallet Detected</Text>
                        <TouchableOpacity onPress={handleConnectWallet} style={styles.connectButton}>
                            <Text style={styles.connectButtonText}>Connect Wallet</Text>
                        </TouchableOpacity>
                    </View>
                ) : (
                    <>
                    <Text style={styles.primaryAddress}>{primaryWallet}</Text>
                    <TouchableOpacity onPress={handleCopyPrimary} style={styles.copyButton}>
                        <Text style={styles.copyIcon}>⎘</Text>
                    </TouchableOpacity>
                    </>
                )}
                </View>
                {isSolanaMobile && deviceInfo && (
                    <View style={styles.deviceInfoCard}>
                        <Text style={styles.deviceInfoText}>
                            🎯 Solana Mobile Device: {deviceInfo.device} ({deviceInfo.model})
                        </Text>
                    </View>
                )}
            </View>

            {/* Disposable Addresses Section */}
            <View style={styles.section}>
                <Text style={styles.sectionTitle}>Disposable Addresses</Text>
                
                {disposableAddresses.map((address) => (
                <View key={address.id} style={styles.disposableCard}>
                    {/* Address Header */}
                    <View style={styles.addressHeader}>
                    <Text style={styles.disposableAddress}>{address.address}</Text>
                    <View style={styles.addressActions}>
                        <TouchableOpacity 
                        onPress={() => handleCopyDisposable(address.address)}
                        style={styles.iconButton}
                        >
                        <Text style={styles.copyIconSmall}>⎘</Text>
                        </TouchableOpacity>
                        <TouchableOpacity 
                        onPress={() => handleDeleteAddress(address.id)}
                        style={styles.iconButton}
                        >
                        <Text style={styles.deleteIcon}>🗑</Text>
                        </TouchableOpacity>
                    </View>
                    </View>

                    {/* Balances */}
                    <View style={styles.balancesRow}>
                    <Text style={styles.balanceText}>{address.balances.sol} SOL</Text>
                    <Text style={styles.balanceSeparator}>|</Text>
                    <Text style={styles.balanceText}>{address.balances.usdc} USDC</Text>
                    <Text style={styles.balanceSeparator}>|</Text>
                    <Text style={styles.balanceText}>{address.balances.zec} ZEC</Text>
                    </View>

                    {/* Add Funds Button */}
                    <TouchableOpacity 
                    style={styles.addFundsButton}
                    onPress={() => handleAddFunds(address.id)}
                    >
                    <Text style={styles.addFundsText}>Add Funds</Text>
                    </TouchableOpacity>
                </View>
                ))}

                {/* Create New Address Button */}
                <TouchableOpacity 
                style={styles.createNewButton}
                onPress={handleCreateNewAddress}
                >
                <Text style={styles.createNewIcon}>+</Text>
                <Text style={styles.createNewText}>Create new disposable address</Text>
                </TouchableOpacity>
            </View>
            </ScrollView>
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
    borderBottomColor: '#1a4444',
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backIcon: {
    fontSize: 32,
    color: '#22D3EE',
    fontWeight: '300',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  placeholder: {
    width: 40,
  },
  networkBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(34, 211, 238, 0.1)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    marginHorizontal: 20,
    marginTop: 16,
    marginBottom: 8,
  },
  networkText: {
    color: '#22D3EE',
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 8,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 24,
  },
  section: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 12,
  },
  primaryWalletCard: {
    backgroundColor: '#0d3333',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#22D3EE',
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  primaryAddress: {
    fontSize: 18,
    fontWeight: '500',
    color: '#22D3EE',
  },
  copyButton: {
    padding: 8,
  },
  copyIcon: {
    fontSize: 24,
    color: '#22D3EE',
  },
  disposableCard: {
    backgroundColor: '#0d3333',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#22D3EE',
    padding: 16,
    marginBottom: 16,
  },
  addressHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  disposableAddress: {
    fontSize: 16,
    fontWeight: '500',
    color: '#22D3EE',
    flex: 1,
  },
  addressActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  iconButton: {
    padding: 4,
  },
  copyIconSmall: {
    fontSize: 20,
    color: '#22D3EE',
  },
  deleteIcon: {
    fontSize: 18,
    color: '#ff6b6b',
  },
  balancesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  balanceText: {
    fontSize: 14,
    color: '#8a9999',
    fontWeight: '500',
  },
  balanceSeparator: {
    fontSize: 14,
    color: '#4a5555',
    marginHorizontal: 8,
  },
  addFundsButton: {
    backgroundColor: 'transparent',
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#22D3EE',
    paddingVertical: 10,
    paddingHorizontal: 20,
    alignSelf: 'flex-start',
  },
  addFundsText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#22D3EE',
  },
  createNewButton: {
    backgroundColor: 'transparent',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#22D3EE',
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  createNewIcon: {
    fontSize: 20,
    color: '#22D3EE',
    fontWeight: '600',
  },
  createNewText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#22D3EE',
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  loadingText: {
    fontSize: 14,
    color: '#8a9999',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  walletModeBadge: {
    backgroundColor: '#0a2828',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#22D3EE',
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  walletModeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#22D3EE',
  },
  connectContainer: {
    alignItems: 'center',
    gap: 12,
    paddingVertical: 8,
  },
  connectText: {
    fontSize: 14,
    color: '#8a9999',
    fontWeight: '500',
  },
  connectButton: {
    backgroundColor: '#22D3EE',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 20,
  },
  connectButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0D0D0D',
  },
  deviceInfoCard: {
    backgroundColor: '#0a2828',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#22D3EE',
    padding: 12,
    marginTop: 12,
  },
  deviceInfoText: {
    fontSize: 12,
    color: '#22D3EE',
    fontWeight: '500',
  },
});

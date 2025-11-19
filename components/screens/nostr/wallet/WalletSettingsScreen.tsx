import SolanaIcon from '@/components/icons/SolanaIcon';
import CreateDisposableAddressModal from '@/components/modals/CreateDisposableAddressModal';
import { useWallet } from '@/src/contexts/WalletContext';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { CaretLeft, Copy, Trash } from 'phosphor-react-native';
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
    const [isCreateModalVisible, setIsCreateModalVisible] = useState(false);

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
        setIsCreateModalVisible(true);
    };

    const handleCreateAddress = async (label?: string, amount?: number, token?: 'SOL' | 'USDC' | 'ZEC') => {
        // TODO: Implement actual address creation logic
        // For now, just add a mock address
        const newAddress: DisposableAddress = {
            id: Date.now().toString(),
            address: `${Math.random().toString(36).substring(2, 6)}...${Math.random().toString(36).substring(2, 6)}`,
            balances: { 
                sol: token === 'SOL' ? (amount || 0) : 0, 
                usdc: token === 'USDC' ? (amount || 0) : 0, 
                zec: token === 'ZEC' ? (amount || 0) : 0 
            }
        };
        setDisposableAddresses(prev => [...prev, newAddress]);
        Alert.alert('Success', `New disposable address created${amount ? ` with ${amount} ${token}` : ''}!`);
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
                <CaretLeft size={24} color="#22D3EE" weight="regular" />
                <Text style={styles.headerTitle}>Settings</Text>
            </TouchableOpacity>
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
                    <TouchableOpacity onPress={handleCopyPrimary} style={styles.iconButton}>
                        <Copy size={24} color="#9CA3AF" weight="regular" />
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
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>Disposable Addresses</Text>
                </View>
                
                {disposableAddresses.map((address) => (
                <View key={address.id} style={styles.disposableCard}>
                    {/* Address Header */}
                    <View style={styles.addressHeader}>
                    <TouchableOpacity 
                        onPress={() => handleCopyDisposable(address.address)}
                        style={styles.addressAddressContainer}
                        >
                      <Text style={styles.disposableAddress}>{address.address}</Text>
                      
                        <Copy size={20} color="#9CA3AF" weight="regular" />
                        </TouchableOpacity>
                    <View style={styles.addressActions}>
                        
                        <TouchableOpacity 
                        onPress={() => handleDeleteAddress(address.id)}
                        style={styles.iconButton}
                        >
                        <Trash size={20} color="#ff6b6b" weight="regular" />
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
        
        {/* Create Disposable Address Modal */}
        <CreateDisposableAddressModal
            visible={isCreateModalVisible}
            onClose={() => setIsCreateModalVisible(false)}
            onCreate={handleCreateAddress}
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
    borderBottomWidth: 2,
    borderBottomColor: '#22D3EE',
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  networkBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
    gap: 8,
  },
  networkText: {
    fontSize: 16,
    color: '#9CA3AF',
    fontWeight: '500',
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
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,

  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: '#FFFFFF',
  },
  primaryWalletCard: {
    backgroundColor: '#06181B',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#22D3EE',
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  primaryAddress: {
    fontSize: 18,
    fontWeight: '500',
    color: '#22D3EE',
  },

  disposableCard: {
    backgroundColor: '#06181B',
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
  addressAddressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  disposableAddress: {
    fontSize: 16,
    fontWeight: '500',
    color: '#22D3EE',
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
    backgroundColor: '#0C2425',
    borderRadius: 100,
    borderWidth: 2,
    borderColor: '#22D3EE',
    paddingVertical: 5,
    paddingHorizontal: 20,
    alignSelf: 'flex-start',
  },
  addFundsText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#22D3EE',
  },
  createNewButton: {
    backgroundColor: '#0C2425',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#22D3EE',
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  createNewIcon: {
    fontSize: 20,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  createNewText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#FFFFFF',
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

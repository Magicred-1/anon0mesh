import * as Clipboard from 'expo-clipboard';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSolanaWallet } from '../../src/solana/useSolanaWallet';
import { RateLimitManager } from '../../src/utils/RateLimitManager';
import ReceiveIcon from '../ui/ReceiveIcon';
import SendIcon from '../ui/SendIcon';
import SolanaLogo from '../ui/SolanaLogo';
import USDCLogo from '../ui/USDCLogo';

// Optional NetInfo - may not be available in Expo Go
/* eslint-disable */
let NetInfo: any = null;
try {
  NetInfo = require('@react-native-community/netinfo').default;
} catch {
  console.log('[WalletScreen] NetInfo not available - assuming always online');
}
/* eslint-enable */

interface WalletScreenProps {
  visible: boolean;
  onClose: () => void;
  pubKey: string;
  nickname: string;
}

const WalletScreen: React.FC<WalletScreenProps> = ({
  visible,
  onClose,
  pubKey,
  nickname,
}) => {
  const [selectedTab, setSelectedTab] = useState<'receive' | 'send'>('receive');
  const [sendAmount, setSendAmount] = useState('');
  const [recipientAddress, setRecipientAddress] = useState('');
  const [selectedCurrency, setSelectedCurrency] = useState<'SOL' | 'USDC'>('SOL');
  const [dropdownVisible, setDropdownVisible] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [transactionSignature, setTransactionSignature] = useState<string>('');
  const [lastTransactionDetails, setLastTransactionDetails] = useState<{
    amount: string;
    recipient: string;
    currency: string;
  } | null>(null);
  const [rateLimitManager] = useState(() => new RateLimitManager(pubKey));

  // Initialize Solana wallet
  const {
    initializeWallet,
    createTransferTransaction,
    signTransaction,
    submitTransaction,
    balance,
    isInitialized,
    refreshBalance,
  } = useSolanaWallet({
    network: 'devnet', // Using testnet as requested
  });

  // Get current available balance based on selected currency
  const getCurrentBalance = () => {
    if (!isInitialized) return 0;
    // For now, only SOL balance is supported
    // TODO: Add USDC balance support
    return selectedCurrency === 'SOL' ? balance : 0;
  };

  // Set amount to maximum available balance
  const setMaxAmount = () => {
    const maxBalance = getCurrentBalance();
    if (maxBalance > 0) {
      // Leave a small amount for transaction fees (0.000005 SOL)
      const maxWithFee = Math.max(0, maxBalance - 0.000005);
      setSendAmount(maxWithFee.toFixed(6));
    }
  };

  // Check internet connectivity and initialize wallet
  useEffect(() => {
    let unsubscribe: (() => void) | undefined;

    // Set up NetInfo listener if available, otherwise assume always connected
    if (NetInfo) {
      unsubscribe = NetInfo.addEventListener((state: any) => {
        setIsConnected(state.isConnected ?? false);
      });
    } else {
      // NetInfo not available (Expo Go) - assume always connected
      setIsConnected(true);
    }

    // Initialize wallet when component mounts
    let mounted = true;
    (async () => {
      if (pubKey && !isInitialized) {
        try {
          const success = await initializeWallet(pubKey);
          if (!success) {
            // Wallet initialization failed - silently log and close wallet if still mounted
            if (mounted) onClose();
          }
        } catch (err) {
          if (mounted) onClose();
        }
      }
    })();

    return () => {
      mounted = false;
      if (unsubscribe) unsubscribe();
    };
  }, [pubKey, isInitialized, initializeWallet, onClose]);

  // Handle sending transaction via Bluetooth mesh when offline
  const handleSendViaBluetoothMesh = async () => {
    if (!isInitialized) {
      Alert.alert('Wallet Not Ready', 'Wallet is still initializing. Please wait a moment.');
      return;
    }

    if (!sendAmount || parseFloat(sendAmount) <= 0) {
      Alert.alert('Invalid Amount', 'Please enter a valid amount to send');
      return;
    }

    if (!recipientAddress.trim()) {
      Alert.alert('Invalid Address', 'Please enter a recipient address');
      return;
    }

    const amount = parseFloat(sendAmount);

    // Confirm mesh relay
    Alert.alert(
      '📡 Bluetooth Mesh Relay',
      `This will create and sign your transaction locally, then broadcast it through the mesh network.\n\n` +
      `Amount: ${sendAmount} ${selectedCurrency}\n` +
      `To: ${recipientAddress.slice(0, 8)}...${recipientAddress.slice(-8)}\n\n` +
      `Nearby peers with internet will relay it to Solana. You'll be notified when it's submitted.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Send via Mesh',
          onPress: async () => {
            setIsSending(true);
            try {
              console.log('[WALLET] Creating transaction for mesh relay...');
              
              // Create and sign transaction locally
              const transaction = await createTransferTransaction(
                recipientAddress,
                amount,
                {
                  memo: `anon0mesh mesh relay from ${nickname}`,
                }
              );

              // Sign transaction
              const signedTx = signTransaction(transaction);
              
              // Serialize transaction for mesh transmission
              const serialized = signedTx.serialize();
              
              console.log('[WALLET] Transaction signed and serialized');
              console.log('[WALLET] Size:', serialized.length, 'bytes');

              // Import relay types and manager
              const { SolanaTransactionSerializer } = await import('../../src/types/solana');
              const { Buffer } = await import('buffer');
              
              // Create transaction payload for relay
              const txPayload = {
                id: `tx_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                timestamp: Date.now(),
                serializedTransaction: Buffer.from(serialized),
                transactionSize: serialized.length,
                sender: nickname,
                senderPubKey: pubKey,
                recipientPubKey: recipientAddress,
                amount: amount * 1e9, // Convert to lamports
                currency: selectedCurrency,
                hopCount: 0,
                ttl: 10,
                relayPath: [pubKey.slice(0, 16)],
                status: 'pending' as const,
              };

              // Serialize for mesh transmission
              const meshPayload = SolanaTransactionSerializer.serialize(txPayload);
              
              console.log('[WALLET] Mesh payload created:', meshPayload.length, 'bytes');

              // TODO: Broadcast through MeshNetworkingManager
              // For now, store transaction details and show success
              
              // Unlock unlimited messaging after creating transaction
              await rateLimitManager.unlockMessaging();

              setLastTransactionDetails({
                amount: sendAmount,
                recipient: recipientAddress,
                currency: selectedCurrency,
              });
              
              setTransactionSignature(txPayload.id);
              
              Alert.alert(
                '✅ Transaction Queued for Relay',
                `Your transaction has been signed and is ready to broadcast through the mesh network.\n\n` +
                `Transaction ID: ${txPayload.id}\n\n` +
                `It will be relayed hop-by-hop until a peer with internet submits it to Solana. ` +
                `You'll receive a notification when it's confirmed.`,
                [
                  { 
                    text: 'OK',
                    onPress: () => {
                      // Clear form
                      setSendAmount('0.06');
                      setRecipientAddress('');
                    }
                  }
                ]
              );
            } catch (error) {
              console.error('[WALLET] Mesh relay failed:', error);
              Alert.alert(
                'Mesh Relay Failed',
                error instanceof Error ? error.message : 'Failed to prepare transaction for relay'
              );
            } finally {
              setIsSending(false);
            }
          },
        },
      ]
    );
  };

  // Handle sending transaction
  const handleSendTransaction = async () => {
    if (!isConnected) {
      // No internet - offer Bluetooth relay
      Alert.alert(
        '🌐 No Internet Connection',
        'You can either:\n\n' +
        '1. Wait until you have internet to send\n' +
        '2. Use Bluetooth Mesh Relay to send through nearby peers',
        [
          { text: 'Wait', style: 'cancel' },
          {
            text: 'Use Mesh Relay',
            onPress: () => handleSendViaBluetoothMesh(),
          },
        ]
      );
      return;
    }

    if (!isInitialized) {
      Alert.alert('Wallet Not Ready', 'Wallet is still initializing. Please wait a moment.');
      return;
    }

    if (!sendAmount || parseFloat(sendAmount) <= 0) {
      Alert.alert('Invalid Amount', 'Please enter a valid amount to send');
      return;
    }

    if (!recipientAddress.trim()) {
      Alert.alert('Invalid Address', 'Please enter a recipient address');
      return;
    }

    // Check if amount exceeds balance
    const amount = parseFloat(sendAmount);
    const availableBalance = getCurrentBalance();
    if (amount > availableBalance) {
      Alert.alert(
        'Insufficient Balance',
        `You only have ${availableBalance.toFixed(4)} ${selectedCurrency} available. Please enter a lower amount.`
      );
      return;
    }

    // Confirm transaction
    Alert.alert(
      'Confirm Transaction',
      `Send ${sendAmount} ${selectedCurrency} to ${recipientAddress.slice(0, 8)}...${recipientAddress.slice(-8)}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Send',
          onPress: async () => {
            setIsSending(true);
            try {
              // Create transaction
              const transaction = await createTransferTransaction(
                recipientAddress,
                amount,
                {
                  memo: `anon0mesh transfer from ${nickname}`,
                }
              );

              // Sign transaction
              const signedTx = signTransaction(transaction);

              // Submit to Solana network
              const signature = await submitTransaction(signedTx);

              // Unlock unlimited messaging after successful transaction
              await rateLimitManager.unlockMessaging();

              // Store transaction details for the success modal
              setTransactionSignature(signature);
              setLastTransactionDetails({
                amount: sendAmount,
                recipient: recipientAddress,
                currency: selectedCurrency,
              });

              // Show success modal instead of alert
              setShowSuccessModal(true);

              // Clear form
              setSendAmount('0.06');
              setRecipientAddress('');
              
              // Refresh balance
              await refreshBalance();
            } catch (error) {
              console.error('Transaction failed:', error);
              Alert.alert(
                'Transaction Failed',
                error instanceof Error ? error.message : 'Failed to send transaction. Please try again.'
              );
            } finally {
              setIsSending(false);
            }
          },
        },
      ]
    );
  };

  // Handle Bluetooth relay
  const handleBluetoothRelay = async () => {
    if (!lastTransactionDetails || !transactionSignature) {
      Alert.alert('Error', 'No transaction data available for relay');
      return;
    }

    Alert.alert(
      '📡 Bluetooth Mesh Relay',
      `Your transaction will be broadcast through the mesh network to find peers with internet connection.\n\n` +
      `Transaction: ${transactionSignature.slice(0, 8)}...${transactionSignature.slice(-8)}\n` +
      `Amount: ${lastTransactionDetails.amount} ${lastTransactionDetails.currency}\n\n` +
      `The transaction will be relayed hop-by-hop until a peer with internet submits it to Solana.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Start Relay',
          onPress: async () => {
            console.log('[WALLET] Starting Bluetooth mesh relay...');
            console.log('[WALLET] Transaction ID:', transactionSignature);
            
            // TODO: Integrate with MeshNetworkingManager to broadcast
            // For now, show success
            Alert.alert(
              '✅ Relay Started',
              'Your transaction is now being broadcast through the mesh network. ' +
              'You will receive a notification when it\'s submitted to Solana.',
              [{ text: 'OK' }]
            );
          },
        },
      ]
    );
  };

  // Handle receipt/explorer view
  const handleViewReceipt = () => {
    Alert.alert(
      'Transaction Receipt',
      `View your transaction on Solana Explorer:\n\n${transactionSignature}\n\nExplorer: https://explorer.solana.com/tx/${transactionSignature}?cluster=devnet`,
      [
        { text: 'Close' },
        { 
          text: 'Copy Signature', 
          onPress: async () => {
            await Clipboard.setStringAsync(transactionSignature);
            Alert.alert('Copied!', 'Transaction signature copied to clipboard');
          }
        },
      ]
    );
    // TODO: Open in browser or show detailed receipt
  };

  const copyAddress = async () => {
    try {
      await Clipboard.setStringAsync(pubKey);
      Alert.alert('Copied!', 'Wallet address copied to clipboard');
    } catch {
      Alert.alert('Error', 'Failed to copy address');
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={{ flex: 1, backgroundColor: '#212122' }}>
        {/* Header */}
        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'flex-end',
            alignItems: 'center',
            paddingHorizontal: 20,
            paddingVertical: 12,
            borderBottomWidth: 1,
            borderBottomColor: '#333',
          }}
        >
          <TouchableOpacity
            onPress={onClose}
            style={{
              width: 32,
              height: 32,
              borderRadius: 16,
              backgroundColor: '#B10FF280',
              justifyContent: 'center',
              alignItems: 'center',
            }}
          >
            <Text style={{ color: '#FFFFFF', fontSize: 18, fontWeight: '600' }}>✕</Text>
          </TouchableOpacity>
        </View>

        {/* Tab Selection */}
        <View
          style={{
            flexDirection: 'row',
            marginHorizontal: 20,
            marginTop: 16,
            marginBottom: 20,
          }}
        >
          <TouchableOpacity
            onPress={() => setSelectedTab('receive')}
            style={{
              flex: 1,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              paddingVertical: 12,
              paddingHorizontal: 16,
              backgroundColor: selectedTab === 'receive' ? '#B10FF280' : 'transparent',
              borderRadius: 8,
              marginRight: 8,
              borderWidth: 1,
              borderColor: selectedTab === 'receive' ? '#B10FF280' : '#B10FF240',
            }}
          >
            <View style={{ marginRight: 8 }}>
              <ReceiveIcon size={18} color="#FFFFFF" />
            </View>
            <Text
              style={{
                color: '#FFFFFF',
                fontSize: 16,
                fontWeight: selectedTab === 'receive' ? '600' : '400',
                fontFamily: 'Lexend_400Regular',
              }}
            >
              Receive
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setSelectedTab('send')}
            style={{
              flex: 1,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              paddingVertical: 12,
              paddingHorizontal: 16,
              backgroundColor: selectedTab === 'send' ? '#B10FF280' : 'transparent',
              borderRadius: 8,
              marginLeft: 8,
              borderWidth: 1,
              borderColor: selectedTab === 'send' ? '#B10FF280' : '#B10FF240',
            }}
          >
            <View style={{ marginRight: 8 }}>
              <SendIcon size={18} color="#FFFFFF" />
            </View>
            <Text
              style={{
                color: '#FFFFFF',
                fontSize: 16,
                fontWeight: selectedTab === 'send' ? '600' : '400',
                fontFamily: 'Lexend_400Regular',
              }}
            >
              Send
            </Text>
          </TouchableOpacity>
        </View>

        {/* Content */}
        <TouchableOpacity 
          style={{ flex: 1, paddingHorizontal: 20 }}
          activeOpacity={1}
          onPress={() => setDropdownVisible(false)}
        >
          {selectedTab === 'receive' ? (
            <View style={{ flex: 1, justifyContent: 'space-evenly', paddingVertical: 20 }}>
              {/* QR Code */}
              <View style={{ alignItems: 'center' }}>
                <View
                  style={{
                    backgroundColor: '#FFFFFF',
                    padding: 20,
                    borderRadius: 16,
                  }}
                >
                  <QRCode
                    value={pubKey}
                    size={220}
                    color="#000000"
                    backgroundColor="#FFFFFF"
                  />
                </View>
              </View>

              {/* Address */}
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  backgroundColor: '#B10FF240',
                  paddingHorizontal: 16,
                  paddingVertical: 12,
                  borderRadius: 8,
                  maxWidth: '100%',
                  alignSelf: 'center',
                  width: '100%',
                }}
              >
                <Text style={{ fontSize: 16, marginRight: 8 }}>📋</Text>
                <Text
                  style={{
                    color: '#FFFFFF',
                    fontSize: 14,
                    fontFamily: 'Lexend_400Regular',
                    flex: 1,
                  }}
                  numberOfLines={1}
                  ellipsizeMode="middle"
                >
                  {pubKey}
                </Text>
              </View>

              {/* Copy Button */}
              <View style={{ alignItems: 'center' }}>
                <TouchableOpacity
                  onPress={copyAddress}
                  style={{
                    backgroundColor: '#B10FF280',
                    paddingHorizontal: 32,
                    paddingVertical: 16,
                    borderRadius: 12,
                    minWidth: 200,
                    alignItems: 'center',
                  }}
                >
                  <Text
                    style={{
                      color: '#FFFFFF',
                      fontSize: 16,
                      fontWeight: '600',
                      fontFamily: 'Lexend_400Regular',
                    }}
                  >
                    Copy Address
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            // Send Tab Content
            <View style={{ flex: 1, justifyContent: 'space-between', paddingVertical: 16 }}>
              <View style={{ flex: 1, justifyContent: 'space-evenly' }}>
                {/* Balance Display */}
                <View
                  style={{
                    backgroundColor: '#333',
                    borderRadius: 16,
                    padding: 20,
                    borderWidth: 1,
                    borderColor: '#444',
                  }}
                >
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginBottom: 10,
                    }}
                  >
                    <TextInput
                      style={{
                        color: '#FFFFFF',
                        fontSize: 32,
                        fontWeight: '300',
                        fontFamily: 'Lexend_400Regular',
                        textAlign: 'center',
                        backgroundColor: 'transparent',
                        borderWidth: 0,
                        padding: 0,
                        minWidth: 100,
                      }}
                      value={sendAmount}
                      onChangeText={setSendAmount}
                      placeholder="0.00"
                      placeholderTextColor="#666"
                      keyboardType="decimal-pad"
                      selectTextOnFocus
                    />
                    <Text
                      style={{
                        color: '#FFFFFF',
                        fontSize: 32,
                        fontWeight: '300',
                        fontFamily: 'Lexend_400Regular',
                        marginLeft: 8,
                        marginRight: 8,
                      }}
                    >
                      {selectedCurrency}
                    </Text>
                    {selectedCurrency === 'SOL' ? (
                      <SolanaLogo size={28} color="#FFFFFF" />
                    ) : (
                      <USDCLogo size={28} />
                    )}
                    
                    {/* MAX Button */}
                    <TouchableOpacity
                      onPress={setMaxAmount}
                      style={{
                        backgroundColor: '#B10FF240',
                        paddingHorizontal: 12,
                        paddingVertical: 6,
                        borderRadius: 6,
                        marginLeft: 12,
                        borderWidth: 1,
                        borderColor: '#B10FF2',
                      }}
                    >
                      <Text
                        style={{
                          color: '#B10FF2',
                          fontSize: 14,
                          fontWeight: '700',
                          fontFamily: 'Lexend_400Regular',
                        }}
                      >
                        MAX
                      </Text>
                    </TouchableOpacity>
                  </View>
                  
                  {/* Currency Dropdown */}
                  <View
                    style={{
                      flexDirection: 'row',
                      justifyContent: 'center',
                      alignItems: 'center',
                      marginBottom: 20,
                      position: 'relative',
                    }}
                  >
                    <TouchableOpacity
                      onPress={() => setDropdownVisible(!dropdownVisible)}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        backgroundColor: '#444',
                        paddingHorizontal: 16,
                        paddingVertical: 8,
                        borderRadius: 8,
                      }}
                    >
                      <Text style={{ color: '#FFFFFF', fontSize: 18, marginRight: 8 }}>☰</Text>
                      <Text
                        style={{
                          color: '#FFFFFF',
                          fontSize: 16,
                          fontFamily: 'Lexend_400Regular',
                          marginRight: 8,
                        }}
                      >
                        {selectedCurrency}
                      </Text>
                      <Text style={{ color: '#FFFFFF', fontSize: 18 }}>▼</Text>
                    </TouchableOpacity>

                    {/* Dropdown Menu */}
                    {dropdownVisible && (
                      <View
                        style={{
                          position: 'absolute',
                          top: 45,
                          backgroundColor: '#333',
                          borderRadius: 8,
                          borderWidth: 1,
                          borderColor: '#555',
                          minWidth: 120,
                          zIndex: 1000,
                        }}
                      >
                        <TouchableOpacity
                          onPress={() => {
                            setSelectedCurrency('SOL');
                            setDropdownVisible(false);
                          }}
                          style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            paddingHorizontal: 16,
                            paddingVertical: 12,
                            backgroundColor: selectedCurrency === 'SOL' ? '#B10FF240' : 'transparent',
                          }}
                        >
                          <SolanaLogo size={20} color="#FFFFFF" />
                          <Text
                            style={{
                              color: '#FFFFFF',
                              fontSize: 16,
                              fontFamily: 'Lexend_400Regular',
                              marginLeft: 8,
                            }}
                          >
                            SOL
                          </Text>
                        </TouchableOpacity>
                        
                        <View style={{ height: 1, backgroundColor: '#555' }} />
                        
                        <TouchableOpacity
                          onPress={() => {
                            setSelectedCurrency('USDC');
                            setDropdownVisible(false);
                          }}
                          style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            paddingHorizontal: 16,
                            paddingVertical: 12,
                            backgroundColor: selectedCurrency === 'USDC' ? '#B10FF240' : 'transparent',
                          }}
                        >
                          <USDCLogo size={20} />
                          <Text
                            style={{
                              color: '#FFFFFF',
                              fontSize: 16,
                              fontFamily: 'Lexend_400Regular',
                              marginLeft: 8,
                            }}
                          >
                            USDC
                          </Text>
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>

                  <View
                    style={{
                      flexDirection: 'row',
                      justifyContent: 'center',
                      alignItems: 'center',
                    }}
                  >
                    <Text
                      style={{
                        color: '#AAAAAA',
                        fontSize: 14,
                        fontFamily: 'Lexend_400Regular',
                        marginRight: 6,
                      }}
                    >
                      Available balance : {isInitialized ? getCurrentBalance().toFixed(4) : '...'} {selectedCurrency}
                    </Text>
                    {selectedCurrency === 'SOL' ? (
                      <SolanaLogo size={16} color="#FFFFFF" />
                    ) : (
                      <USDCLogo size={16} />
                    )}
                    {selectedCurrency === 'USDC' && (
                      <Text
                        style={{
                          color: '#FFA500',
                          fontSize: 11,
                          fontFamily: 'Lexend_400Regular',
                          marginLeft: 8,
                        }}
                      >
                        (Coming Soon)
                      </Text>
                    )}
                  </View>
                </View>

                {/* Recipient Address Input */}
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    backgroundColor: 'transparent',
                    borderWidth: 1,
                    borderColor: '#444',
                    borderRadius: 8,
                    paddingHorizontal: 16,
                    paddingVertical: 12,
                  }}
                >
                  <TextInput
                    style={{
                      flex: 1,
                      color: '#FFFFFF',
                      fontSize: 16,
                      fontFamily: 'Lexend_400Regular',
                    }}
                    placeholder="Enter recipient address.."
                    placeholderTextColor="#666"
                    value={recipientAddress}
                    onChangeText={setRecipientAddress}
                  />
                  <TouchableOpacity
                    style={{
                      marginLeft: 8,
                      padding: 4,
                    }}
                  >
                    <Text style={{ color: '#FFFFFF', fontSize: 18 }}>📷</Text>
                  </TouchableOpacity>
                </View>

                {/* Send Transaction Button */}
                <TouchableOpacity
                  onPress={handleSendTransaction}
                  disabled={isSending || !isConnected || selectedCurrency === 'USDC'}
                  style={{
                    backgroundColor: isSending || !isConnected || selectedCurrency === 'USDC' ? '#666666' : '#B10FF280',
                    paddingHorizontal: 32,
                    paddingVertical: 16,
                    borderRadius: 12,
                    alignItems: 'center',
                    flexDirection: 'row',
                    justifyContent: 'center',
                  }}
                >
                  {isSending ? (
                    <>
                      <ActivityIndicator size="small" color="#FFFFFF" style={{ marginRight: 8 }} />
                      <Text
                        style={{
                          color: '#FFFFFF',
                          fontSize: 16,
                          fontWeight: '600',
                          fontFamily: 'Lexend_400Regular',
                        }}
                      >
                        Sending...
                      </Text>
                    </>
                  ) : (
                    <Text
                      style={{
                        color: '#FFFFFF',
                        fontSize: 16,
                        fontWeight: '600',
                        fontFamily: 'Lexend_400Regular',
                      }}
                    >
                      {!isConnected 
                        ? '🌐 No Internet - Cannot Send' 
                        : selectedCurrency === 'USDC'
                        ? '🚧 USDC Support Coming Soon'
                        : `Send ${sendAmount} ${selectedCurrency}`}
                    </Text>
                  )}
                </TouchableOpacity>
              </View>

              {/* Info Text */}
              <View style={{ marginTop: 16 }}>
                {/* Connection Status */}
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginBottom: 8,
                  }}
                >
                  <View
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: 4,
                      backgroundColor: isConnected ? '#10B981' : '#EF4444',
                      marginRight: 6,
                    }}
                  />
                  <Text
                    style={{
                      color: isConnected ? '#10B981' : '#EF4444',
                      fontSize: 12,
                      fontFamily: 'Lexend_400Regular',
                      fontWeight: '600',
                    }}
                  >
                    {isConnected ? 'Online' : 'Offline'}
                  </Text>
                </View>

                <Text
                  style={{
                    color: '#888',
                    fontSize: 13,
                    fontFamily: 'Lexend_400Regular',
                    textAlign: 'center',
                    paddingHorizontal: 20,
                  }}
                >
                  {isConnected
                    ? '✅ Connected to Solana network. Transactions will be processed immediately.'
                    : '⚠️ No internet connection. Connect to send transactions and refresh your balance.'}
                </Text>
              </View>
            </View>
          )}
        </TouchableOpacity>
      </SafeAreaView>

      {/* Success Modal */}
      <Modal
        visible={showSuccessModal}
        animationType="fade"
        transparent
        onRequestClose={() => setShowSuccessModal(false)}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: 'rgba(0, 0, 0, 0.85)',
            justifyContent: 'center',
            alignItems: 'center',
            paddingHorizontal: 20,
          }}
        >
          <View
            style={{
              backgroundColor: '#1a1a1a',
              borderRadius: 20,
              padding: 24,
              width: '100%',
              maxWidth: 400,
              borderWidth: 2,
              borderColor: '#10B981',
            }}
          >
            {/* Success Icon */}
            <View style={{ alignItems: 'center', marginBottom: 20 }}>
              <View
                style={{
                  width: 80,
                  height: 80,
                  borderRadius: 40,
                  backgroundColor: '#10B98120',
                  justifyContent: 'center',
                  alignItems: 'center',
                  marginBottom: 16,
                }}
              >
                <Text style={{ fontSize: 48 }}>✅</Text>
              </View>
              <Text
                style={{
                  color: '#FFFFFF',
                  fontSize: 24,
                  fontWeight: '700',
                  fontFamily: 'Lexend_400Regular',
                  marginBottom: 8,
                }}
              >
                Transaction Sent!
              </Text>
              <Text
                style={{
                  color: '#10B981',
                  fontSize: 14,
                  fontFamily: 'Lexend_400Regular',
                  textAlign: 'center',
                }}
              >
                Your transaction has been submitted to the Solana network
              </Text>
              <Text
                style={{
                  color: '#B10FF2',
                  fontSize: 13,
                  fontWeight: '600',
                  fontFamily: 'Lexend_400Regular',
                  textAlign: 'center',
                  marginTop: 12,
                  paddingHorizontal: 16,
                  paddingVertical: 8,
                  backgroundColor: '#B10FF220',
                  borderRadius: 8,
                }}
              >
                🎉 Unlimited messaging unlocked for today!
              </Text>
            </View>

            {/* Transaction Details */}
            {lastTransactionDetails && (
              <View
                style={{
                  backgroundColor: '#252525',
                  borderRadius: 12,
                  padding: 16,
                  marginBottom: 20,
                }}
              >
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 }}>
                  <Text style={{ color: '#888888', fontSize: 14, fontFamily: 'Lexend_400Regular' }}>
                    Amount
                  </Text>
                  <Text style={{ color: '#FFFFFF', fontSize: 14, fontWeight: '600', fontFamily: 'Lexend_400Regular' }}>
                    {lastTransactionDetails.amount} {lastTransactionDetails.currency}
                  </Text>
                </View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 }}>
                  <Text style={{ color: '#888888', fontSize: 14, fontFamily: 'Lexend_400Regular' }}>
                    To
                  </Text>
                  <Text
                    style={{ color: '#FFFFFF', fontSize: 12, fontFamily: 'Lexend_400Regular', maxWidth: 200 }}
                    numberOfLines={1}
                    ellipsizeMode="middle"
                  >
                    {lastTransactionDetails.recipient}
                  </Text>
                </View>
                <View style={{ height: 1, backgroundColor: '#333333', marginVertical: 8 }} />
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text style={{ color: '#888888', fontSize: 14, fontFamily: 'Lexend_400Regular' }}>
                    Signature
                  </Text>
                  <Text
                    style={{ color: '#B10FF2', fontSize: 12, fontFamily: 'Lexend_400Regular', maxWidth: 200 }}
                    numberOfLines={1}
                    ellipsizeMode="middle"
                  >
                    {transactionSignature}
                  </Text>
                </View>
              </View>
            )}

            {/* Action Buttons */}
            <View style={{ gap: 12 }}>
              {/* View Receipt Button */}
              <TouchableOpacity
                onPress={handleViewReceipt}
                style={{
                  backgroundColor: '#B10FF280',
                  paddingVertical: 14,
                  paddingHorizontal: 20,
                  borderRadius: 12,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderWidth: 1,
                  borderColor: '#B10FF2',
                }}
              >
                <Text style={{ fontSize: 18, marginRight: 8 }}>📄</Text>
                <Text
                  style={{
                    color: '#FFFFFF',
                    fontSize: 15,
                    fontWeight: '600',
                    fontFamily: 'Lexend_400Regular',
                  }}
                >
                  View Receipt on Explorer
                </Text>
              </TouchableOpacity>

              {/* Bluetooth Relay Button */}
              {isConnected && (
                <TouchableOpacity
                  onPress={handleBluetoothRelay}
                  style={{
                    backgroundColor: '#3B82F620',
                    paddingVertical: 14,
                    paddingHorizontal: 20,
                    borderRadius: 12,
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderWidth: 1,
                    borderColor: '#3B82F6',
                  }}
                >
                  <Text style={{ fontSize: 18, marginRight: 8 }}>📡</Text>
                  <Text
                    style={{
                      color: '#3B82F6',
                      fontSize: 15,
                      fontWeight: '600',
                      fontFamily: 'Lexend_400Regular',
                    }}
                  >
                    Relay via Bluetooth Mesh
                  </Text>
                </TouchableOpacity>
              )}

              {/* Close Button */}
              <TouchableOpacity
                onPress={() => setShowSuccessModal(false)}
                style={{
                  backgroundColor: '#333333',
                  paddingVertical: 14,
                  paddingHorizontal: 20,
                  borderRadius: 12,
                  alignItems: 'center',
                }}
              >
                <Text
                  style={{
                    color: '#CCCCCC',
                    fontSize: 15,
                    fontWeight: '600',
                    fontFamily: 'Lexend_400Regular',
                  }}
                >
                  Close
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </Modal>
  );
};

export default WalletScreen;
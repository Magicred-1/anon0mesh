import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  Alert,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import QRCode from 'react-native-qrcode-svg';
import * as Clipboard from 'expo-clipboard';
import { useSolanaWallet } from '../../src/solana/useSolanaWallet';
import SolanaLogo from '../ui/SolanaLogo';
import USDCLogo from '../ui/USDCLogo';
import ReceiveIcon from '../ui/ReceiveIcon';
import SendIcon from '../ui/SendIcon';

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
  const [sendAmount, setSendAmount] = useState('0.06');
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
    if (pubKey && !isInitialized) {
      initializeWallet(pubKey).then(success => {
        if (!success) {
          // Wallet initialization failed - silently log and close wallet
          console.error('Wallet initialization failed - keys may be corrupted');
          onClose();
        }
      }).catch(err => {
        console.error('Failed to initialize wallet:', err);
        onClose();
      });
    }

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [pubKey, isInitialized, initializeWallet, onClose]);

  // Handle sending transaction
  const handleSendTransaction = async () => {
    if (!isConnected) {
      Alert.alert(
        'No Internet Connection',
        'You need an internet connection to send transactions. Please connect to the internet and try again.',
        [{ text: 'OK' }]
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
    if (amount > balance) {
      Alert.alert(
        'Insufficient Balance',
        `You only have ${balance.toFixed(4)} SOL available. Please enter a lower amount.`
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
  const handleBluetoothRelay = () => {
    Alert.alert(
      'Bluetooth Relay',
      'Your transaction will be relayed through the mesh network to peers without internet connection.',
      [{ text: 'OK' }]
    );
    // TODO: Implement actual Bluetooth mesh relay
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
                      Available balance : {isInitialized ? balance.toFixed(4) : '...'} {selectedCurrency}
                    </Text>
                    {selectedCurrency === 'SOL' ? (
                      <SolanaLogo size={16} color="#FFFFFF" />
                    ) : (
                      <USDCLogo size={16} />
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
                  disabled={isSending || !isConnected}
                  style={{
                    backgroundColor: isSending || !isConnected ? '#666666' : '#B10FF280',
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
                      {isConnected ? `Send ${sendAmount} ${selectedCurrency}` : '🌐 No Internet - Cannot Send'}
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
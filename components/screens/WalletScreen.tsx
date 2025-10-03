import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  Alert,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import QRCode from 'react-native-qrcode-svg';
import * as Clipboard from 'expo-clipboard';
import SolanaLogo from '../ui/SolanaLogo';
import USDCLogo from '../ui/USDCLogo';
import ReceiveIcon from '../ui/ReceiveIcon';
import SendIcon from '../ui/SendIcon';

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
            justifyContent: 'space-between',
            alignItems: 'center',
            paddingHorizontal: 20,
            paddingVertical: 12,
            borderBottomWidth: 1,
            borderBottomColor: '#333',
          }}
        >
          <View />
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
                fontFamily: 'System',
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
                fontFamily: 'System',
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
                    fontFamily: 'System',
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
                      fontFamily: 'System',
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
                        fontFamily: 'System',
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
                        fontFamily: 'System',
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
                          fontFamily: 'System',
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
                              fontFamily: 'System',
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
                              fontFamily: 'System',
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
                        fontFamily: 'System',
                        marginRight: 6,
                      }}
                    >
                      Available balance : {selectedCurrency === 'SOL' ? '2.3' : '1,250.00'} {selectedCurrency}
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
                      fontFamily: 'System',
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

                {/* Copy Address Button */}
                <TouchableOpacity
                  onPress={() => {
                    if (!sendAmount || parseFloat(sendAmount) <= 0) {
                      Alert.alert('Invalid Amount', 'Please enter a valid amount to send');
                      return;
                    }
                    if (!recipientAddress.trim()) {
                      Alert.alert('Invalid Address', 'Please enter a recipient address');
                      return;
                    }
                    Alert.alert('Send', `Sending ${sendAmount} ${selectedCurrency} to ${recipientAddress}`);
                  }}
                  style={{
                    backgroundColor: '#B10FF280',
                    paddingHorizontal: 32,
                    paddingVertical: 16,
                    borderRadius: 12,
                    alignItems: 'center',
                  }}
                >
                  <Text
                    style={{
                      color: '#FFFFFF',
                      fontSize: 16,
                      fontWeight: '600',
                      fontFamily: 'System',
                    }}
                  >
                    Send {sendAmount} {selectedCurrency}
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Info Text */}
              <Text
                style={{
                  color: '#888',
                  fontSize: 14,
                  fontFamily: 'System',
                  textAlign: 'center',
                  paddingHorizontal: 20,
                  marginTop: 16,
                }}
              >
                ℹ️ You might need to connect to internet to refresh your live balance
              </Text>
            </View>
          )}
        </TouchableOpacity>
      </SafeAreaView>
    </Modal>
  );
};

export default WalletScreen;
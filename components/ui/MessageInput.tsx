import React, { useEffect, useState } from 'react';
import {
    Alert,
    KeyboardAvoidingView,
    Modal,
    Platform,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import Svg, { Path, Circle, Defs, LinearGradient, Stop } from 'react-native-svg';
import { CameraView, useCameraPermissions } from 'expo-camera';

interface Props {
  onSend: (msg: string) => void;
  onSendAsset: (asset: string, amount: string, address: string) => void;
  placeholder?: string;
}

// Local SVG Components
const USDCLogo = ({ size = 20 }: { size?: number }) => (
  <Svg width={size} height={size} viewBox="0 0 2000 2000">
    <Path
      d="M1000 2000c554.17 0 1000-445.83 1000-1000S1554.17 0 1000 0 0 445.83 0 1000s445.83 1000 1000 1000z"
      fill="#2775CA"
    />
    <Path
      d="M1275 1158.33c0-145.83-87.5-195.83-262.5-216.66-125-16.67-150-50-150-108.34s41.67-95.83 125-95.83c75 0 116.67 25 137.5 87.5 4.17 12.5 16.67 20.83 29.17 20.83h66.66c16.67 0 29.17-12.5 29.17-29.16v-4.17c-16.67-91.67-91.67-162.5-187.5-170.83v-100c0-16.67-12.5-29.17-33.33-33.34h-62.5c-16.67 0-29.17 12.5-33.34 33.34v95.83c-125 16.67-204.16 100-204.16 204.17 0 137.5 83.33 191.66 258.33 212.5 116.67 20.83 154.17 45.83 154.17 112.5s-58.34 112.5-137.5 112.5c-108.34 0-145.84-45.84-158.34-108.34-4.16-16.66-16.66-25-29.16-25h-70.84c-16.66 0-29.16 12.5-29.16 29.17v4.17c16.66 104.16 83.33 179.16 220.83 200v100c0 16.66 12.5 29.16 33.33 33.33h62.5c16.67 0 29.17-12.5 33.34-33.33v-100c125-20.84 208.33-108.34 208.33-220.84z"
      fill="#FFF"
    />
    <Path
      d="M787.5 1595.83c-325-116.66-491.67-479.16-370.83-800 62.5-175 200-308.33 370.83-370.83 16.67-8.33 25-20.83 25-41.67V325c0-16.67-8.33-29.17-25-33.33-4.17 0-12.5 0-16.67 4.16-395.83 125-612.5 545.84-487.5 941.67 75 233.33 254.17 412.5 487.5 487.5 16.67 8.33 33.34 0 37.5-16.67 4.17-4.16 4.17-8.33 4.17-16.66v-58.34c0-12.5-12.5-29.16-25-37.5zM1229.17 295.83c-16.67-8.33-33.34 0-37.5 16.67-4.17 4.17-4.17 8.33-4.17 16.67v58.33c0 16.67 12.5 33.33 25 41.67 325 116.66 491.67 479.16 370.83 800-62.5 175-200 308.33-370.83 370.83-16.67 8.33-25 20.83-25 41.67V1700c0 16.67 8.33 29.17 25 33.33 4.17 0 12.5 0 16.67-4.16 395.83-125 612.5-545.84 487.5-941.67-75-237.5-258.34-416.67-487.5-491.67z"
      fill="#FFF"
    />
  </Svg>
);

const SolanaLogo = ({ size = 20 }: { size?: number }) => (
  <Svg width={size} height={size} viewBox="0 0 397.7 311.7">
    <Defs>
      <LinearGradient id="solGrad1" x1="360.88" y1="351.46" x2="141.21" y2="-69.29" gradientUnits="userSpaceOnUse">
        <Stop offset="0" stopColor="#00ffa3" />
        <Stop offset="1" stopColor="#dc1fff" />
      </LinearGradient>
      <LinearGradient id="solGrad2" x1="264.83" y1="401.6" x2="45.16" y2="-19.15" gradientUnits="userSpaceOnUse">
        <Stop offset="0" stopColor="#00ffa3" />
        <Stop offset="1" stopColor="#dc1fff" />
      </LinearGradient>
      <LinearGradient id="solGrad3" x1="312.86" y1="376.53" x2="93.19" y2="-44.22" gradientUnits="userSpaceOnUse">
        <Stop offset="0" stopColor="#00ffa3" />
        <Stop offset="1" stopColor="#dc1fff" />
      </LinearGradient>
    </Defs>
    <Path
      d="M64.6 237.9c2.4-2.4 5.7-3.8 9.2-3.8h317.4c5.8 0 8.7 7 4.6 11.1l-62.7 62.7c-2.4 2.4-5.7 3.8-9.2 3.8H6.5c-5.8 0-8.7-7-4.6-11.1l62.7-62.7z"
      fill="url(#solGrad1)"
    />
    <Path
      d="M64.6 3.8C67.1 1.4 70.4 0 73.8 0h317.4c5.8 0 8.7 7 4.6 11.1l-62.7 62.7c-2.4 2.4-5.7 3.8-9.2 3.8H6.5c-5.8 0-8.7-7-4.6-11.1L64.6 3.8z"
      fill="url(#solGrad2)"
    />
    <Path
      d="M333.1 120.1c-2.4-2.4-5.7-3.8-9.2-3.8H6.5c-5.8 0-8.7 7-4.6 11.1l62.7 62.7c2.4 2.4 5.7 3.8 9.2 3.8h317.4c5.8 0 8.7-7 4.6-11.1l-62.7-62.7z"
      fill="url(#solGrad3)"
    />
  </Svg>
);

// Token selection button
const TokenButton = ({
  token,
  selected,
  onPress,
}: {
  token: 'USDC' | 'SOL';
  selected: boolean;
  onPress: () => void;
}) => (
  <TouchableOpacity
    onPress={onPress}
    style={{
      flexDirection: 'row',
      alignItems: 'center',
      marginRight: 12,
      backgroundColor: selected ? '#A855F7' : '#1A1A1A',
      paddingVertical: 10,
      paddingHorizontal: 16,
      borderRadius: 14,
      borderWidth: 2,
      borderColor: selected ? '#A855F7' : '#333',
      shadowColor: selected ? '#A855F7' : 'transparent',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: selected ? 0.5 : 0,
      shadowRadius: 4,
      elevation: selected ? 4 : 0,
    }}
  >
    {token === 'USDC' ? <USDCLogo size={24} /> : <SolanaLogo size={24} />}
    <Text
      style={{
        color: selected ? '#0A0A0A' : '#A855F7',
        fontWeight: '700',
        marginLeft: 8,
        fontFamily: 'Courier',
        fontSize: 15,
      }}
    >
      {token}
    </Text>
  </TouchableOpacity>
);

// Send Asset Icon Button with modal
const SendAssetIconButton = ({ onSendAsset }: { onSendAsset: Props['onSendAsset'] }) => {
  const [modalVisible, setModalVisible] = useState(false);
  const [asset, setAsset] = useState<'USDC' | 'SOL'>('USDC');
  const [amount, setAmount] = useState('');
  const [address, setAddress] = useState('');
  const [permission, requestPermission] = useCameraPermissions();
  const [scannerVisible, setScannerVisible] = useState(false);
  const [scanned, setScanned] = useState(false);

  const handleSend = () => {
    if (!amount.trim() || !address.trim()) {
      Alert.alert('Error', 'Please fill in all fields.');
      return;
    }
    onSendAsset(asset, amount.trim(), address.trim());
    setAmount('');
    setAddress('');
    setModalVisible(false);
  };

  const handleBarCodeScanned = ({ data }: { type: string; data: string }) => {
    setScanned(true);
    setAddress(data);
    setScannerVisible(false);
    setTimeout(() => setScanned(false), 500);
  };

  const handleOpenScanner = async () => {
    if (!permission) {
      return;
    }

    if (!permission.granted) {
      const result = await requestPermission();
      if (!result.granted) {
        Alert.alert('Permission Required', 'Camera permission is required to scan QR codes.');
        return;
      }
    }

    setScannerVisible(true);
    setScanned(false);
  };

  return (
    <>
      {/* Small 💰 icon */}
      <TouchableOpacity
        onPress={() => setModalVisible(true)}
        style={{
          marginLeft: 8,
          backgroundColor: '#1A1A1A',
          width: 44,
          height: 44,
          borderRadius: 22,
          justifyContent: 'center',
          alignItems: 'center',
          borderWidth: 2,
          borderColor: '#A855F7',
          shadowColor: '#A855F7',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.6,
          shadowRadius: 4,
          elevation: 4,
        }}
      >
        <Text style={{ fontSize: 22 }}>💰</Text>
      </TouchableOpacity>

      {/* Modal */}
      <Modal visible={modalVisible} transparent animationType="fade">
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={{
            flex: 1,
            justifyContent: 'center',
            alignItems: 'center',
            backgroundColor: 'rgba(0,0,0,0.9)',
          }}
        >
          <View
            style={{
              backgroundColor: '#0F0F0F',
              padding: 24,
              borderRadius: 20,
              width: '90%',
              maxWidth: 400,
              borderWidth: 2,
              borderColor: '#A855F7',
              shadowColor: '#A855F7',
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.8,
              shadowRadius: 12,
              elevation: 8,
            }}
          >
            <Text
              style={{
                color: '#A855F7',
                fontFamily: 'Courier',
                fontSize: 22,
                marginBottom: 20,
                fontWeight: 'bold',
                textAlign: 'center',
                letterSpacing: 1,
              }}
            >
              💸 Send Asset
            </Text>

            {/* Token selection */}
            <Text
              style={{
                color: '#888',
                fontFamily: 'Courier',
                fontSize: 12,
                marginBottom: 8,
                fontWeight: '600',
                textTransform: 'uppercase',
                letterSpacing: 0.5,
              }}
            >
              Select Token
            </Text>
            <View style={{ flexDirection: 'row', marginBottom: 20 }}>
              {(['USDC', 'SOL'] as const).map((token) => (
                <TokenButton
                  key={token}
                  token={token}
                  selected={asset === token}
                  onPress={() => setAsset(token)}
                />
              ))}
            </View>

            {/* Amount */}
            <Text
              style={{
                color: '#888',
                fontFamily: 'Courier',
                fontSize: 12,
                marginBottom: 8,
                fontWeight: '600',
                textTransform: 'uppercase',
                letterSpacing: 0.5,
              }}
            >
              Amount
            </Text>
            <TextInput
              placeholder="0.00"
              placeholderTextColor="#444"
              value={amount}
              onChangeText={setAmount}
              keyboardType="decimal-pad"
              style={{
                backgroundColor: '#1A1A1A',
                color: '#A855F7',
                borderRadius: 14,
                paddingHorizontal: 16,
                paddingVertical: 14,
                marginBottom: 20,
                fontFamily: 'Courier',
                fontSize: 16,
                borderWidth: 2,
                borderColor: '#333',
                fontWeight: '600',
              }}
            />

            {/* Address with inline QR button */}
            <Text
              style={{
                color: '#888',
                fontFamily: 'Courier',
                fontSize: 12,
                marginBottom: 8,
                fontWeight: '600',
                textTransform: 'uppercase',
                letterSpacing: 0.5,
              }}
            >
              Recipient Address
            </Text>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                backgroundColor: '#1A1A1A',
                borderRadius: 14,
                borderWidth: 2,
                borderColor: '#333',
                marginBottom: 20,
              }}
            >
              <TextInput
                placeholder="Enter wallet address"
                placeholderTextColor="#444"
                value={address}
                onChangeText={setAddress}
                style={{
                  flex: 1,
                  color: '#A855F7',
                  paddingHorizontal: 16,
                  paddingVertical: 14,
                  fontFamily: 'Courier',
                  fontSize: 14,
                }}
                multiline
                numberOfLines={2}
              />
              <TouchableOpacity
                onPress={handleOpenScanner}
                style={{
                  paddingHorizontal: 12,
                  paddingVertical: 14,
                  borderLeftWidth: 2,
                  borderLeftColor: '#333',
                  justifyContent: 'center',
                  alignItems: 'center',
                }}
              >
                <Text style={{ fontSize: 24 }}>📷</Text>
              </TouchableOpacity>
            </View>

            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 }}>
              <TouchableOpacity
                onPress={() => setModalVisible(false)}
                style={{
                  backgroundColor: '#1A1A1A',
                  paddingVertical: 14,
                  paddingHorizontal: 32,
                  borderRadius: 14,
                  alignItems: 'center',
                  borderWidth: 2,
                  borderColor: '#333',
                  flex: 1,
                  marginRight: 8,
                }}
              >
                <Text style={{ color: '#888', fontFamily: 'Courier', fontWeight: '700', fontSize: 15 }}>
                  Cancel
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleSend}
                style={{
                  backgroundColor: '#A855F7',
                  paddingVertical: 14,
                  paddingHorizontal: 32,
                  borderRadius: 14,
                  alignItems: 'center',
                  flex: 1,
                  marginLeft: 8,
                  shadowColor: '#A855F7',
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: 0.6,
                  shadowRadius: 8,
                  elevation: 6,
                }}
              >
                <Text style={{ color: '#0A0A0A', fontFamily: 'Courier', fontWeight: 'bold', fontSize: 15 }}>
                  Send 🚀
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* QR Scanner Modal */}
      <Modal visible={scannerVisible} transparent animationType="slide">
        <View style={{ flex: 1, backgroundColor: '#000' }}>
          {permission?.granted && (
            <CameraView
              style={{ flex: 1 }}
              facing="back"
              onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
              barcodeScannerSettings={{
                barcodeTypes: ['qr'],
              }}
            />
          )}
          
          {/* Scanning overlay - absolute positioned */}
          <View
            pointerEvents="none"
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              justifyContent: 'center',
              alignItems: 'center',
            }}
          >
            <View
              style={{
                width: 250,
                height: 250,
                borderWidth: 3,
                borderColor: '#A855F7',
                borderRadius: 20,
                backgroundColor: 'transparent',
              }}
            />
            <Text
              style={{
                color: '#FFF',
                fontFamily: 'Courier',
                fontSize: 16,
                marginTop: 20,
                backgroundColor: 'rgba(0,0,0,0.7)',
                paddingHorizontal: 20,
                paddingVertical: 10,
                borderRadius: 10,
              }}
            >
              {scanned ? '✓ Scanned!' : 'Scan QR Code'}
            </Text>
          </View>

          <TouchableOpacity
            onPress={() => {
              setScannerVisible(false);
              setScanned(false);
            }}
            style={{
              position: 'absolute',
              bottom: 50,
              alignSelf: 'center',
              backgroundColor: '#1A1A1A',
              paddingHorizontal: 32,
              paddingVertical: 16,
              borderRadius: 14,
              borderWidth: 2,
              borderColor: '#A855F7',
            }}
          >
            <Text style={{ color: '#A855F7', fontFamily: 'Courier', fontWeight: '700', fontSize: 16 }}>
              Close
            </Text>
          </TouchableOpacity>
        </View>
      </Modal>
    </>
  );
};

// Main MessageInput
export default function MessageInput({ onSend, onSendAsset, placeholder }: Props) {
  const [text, setText] = useState('');

  const handleSend = () => {
    if (!text.trim()) return;
    onSend(text.trim());
    setText('');
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={80}
      style={{ paddingHorizontal: 12, paddingBottom: 8 }}
    >
      <View
        style={{
          flexDirection: 'row',
          padding: 10,
          backgroundColor: '#111111',
          borderRadius: 28,
          borderWidth: 2,
          borderColor: '#A855F7',
          shadowColor: '#A855F7',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.6,
          shadowRadius: 10,
          elevation: 6,
          marginBottom: 16,
          alignItems: 'center',
        }}
      >
        {/* Text input */}
        <TextInput
          style={{
            flex: 1,
            backgroundColor: '#0F0F0F',
            borderRadius: 22,
            paddingHorizontal: 16,
            paddingVertical: 12,
            color: '#A855F7',
            fontFamily: 'Courier',
            fontSize: 16,
            borderWidth: 1,
            borderColor: '#222',
          }}
          placeholder={placeholder || 'Type a message...'}
          placeholderTextColor="#555"
          value={text}
          onChangeText={setText}
          blurOnSubmit={false}
          onSubmitEditing={handleSend}
          returnKeyType="send"
        />

        {/* 💰 Send Asset */}
        <SendAssetIconButton onSendAsset={onSendAsset} />

        {/* Send message */}
        <TouchableOpacity
          onPress={handleSend}
          style={{
            marginLeft: 8,
            backgroundColor: '#A855F7',
            borderRadius: 22,
            paddingHorizontal: 20,
            paddingVertical: 12,
            justifyContent: 'center',
            alignItems: 'center',
            shadowColor: '#A855F7',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.7,
            shadowRadius: 6,
            elevation: 5,
          }}
        >
          <Text
            style={{
              color: '#0A0A0A',
              fontWeight: 'bold',
              fontFamily: 'Courier',
              fontSize: 16,
            }}
          >
            Send
          </Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}
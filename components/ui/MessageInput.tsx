// import { BarCodeScanner } from 'expo-barcode-scanner';
// import { Camera } from 'expo-camera';
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
import SvgUri from 'react-native-svg-uri';

interface Props {
  onSend: (msg: string) => void;
  onSendAsset: (asset: string, amount: string, address: string) => void;
  placeholder?: string;
}

// SVG logos
const tokenSvgs: Record<'USDC' | 'SOL', string> = {
  USDC: 'https://cryptologos.cc/logos/usd-coin-usdc-logo.svg?v=023',
  SOL: 'https://cryptologos.cc/logos/solana-sol-logo.svg?v=023',
};

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
      marginRight: 10,
      backgroundColor: selected ? '#A855F7' : '#222',
      paddingVertical: 6,
      paddingHorizontal: 12,
      borderRadius: 12,
      borderWidth: selected ? 1 : 0,
      borderColor: '#A855F7',
    }}
  >
    <SvgUri width="20" height="20" source={{ uri: tokenSvgs[token] }} />
    <Text
      style={{
        color: selected ? '#0A0A0A' : '#A855F7',
        fontWeight: 'bold',
        marginLeft: 6,
        fontFamily: 'Courier',
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
  const [cameraPermission, setCameraPermission] = useState<boolean | null>(null);
  const [scannerVisible, setScannerVisible] = useState(false);

  // useEffect(() => {
  //   (async () => {
  //     const { status } = await Camera.requestCameraPermissionsAsync();
  //     setCameraPermission(status === 'granted');
  //   })();
  // }, []);

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

  const handleBarCodeScanned = ({ data }: { data: string }) => {
    setAddress(data);
    setScannerVisible(false);
  };

  return (
    <>
      {/* Small 💰 icon */}
      <TouchableOpacity
        onPress={() => setModalVisible(true)}
        style={{
          marginLeft: 8,
          backgroundColor: '#222222',
          width: 42,
          height: 42,
          borderRadius: 21,
          justifyContent: 'center',
          alignItems: 'center',
          shadowColor: '#A855F7',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.7,
          shadowRadius: 4,
        }}
      >
        <Text style={{ fontSize: 20 }}>💰</Text>
      </TouchableOpacity>

      {/* Modal */}
      <Modal visible={modalVisible} transparent animationType="fade">
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={{
            flex: 1,
            justifyContent: 'center',
            alignItems: 'center',
            backgroundColor: 'rgba(0,0,0,0.85)',
          }}
        >
          <View
            style={{
              backgroundColor: '#0F0F0F',
              padding: 20,
              borderRadius: 16,
              width: '85%',
              borderWidth: 1,
              borderColor: '#A855F7',
            }}
          >
            <Text
              style={{
                color: '#A855F7',
                fontFamily: 'Courier',
                fontSize: 18,
                marginBottom: 12,
                fontWeight: 'bold',
                textAlign: 'center',
              }}
            >
              Send Asset
            </Text>

            {/* Token selection */}
            <View style={{ flexDirection: 'row', marginBottom: 12 }}>
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
            <TextInput
              placeholder="Amount"
              placeholderTextColor="#555"
              value={amount}
              onChangeText={setAmount}
              keyboardType="numeric"
              style={{
                backgroundColor: '#1A1A1A',
                color: '#A855F7',
                borderRadius: 12,
                paddingHorizontal: 12,
                paddingVertical: 10,
                marginBottom: 10,
                fontFamily: 'Courier',
                borderWidth: 1,
                borderColor: '#A855F7',
              }}
            />

            {/* Address */}
            <TextInput
              placeholder="Recipient Address"
              placeholderTextColor="#555"
              value={address}
              onChangeText={setAddress}
              style={{
                backgroundColor: '#1A1A1A',
                color: '#A855F7',
                borderRadius: 12,
                paddingHorizontal: 12,
                paddingVertical: 10,
                marginBottom: 10,
                fontFamily: 'Courier',
                borderWidth: 1,
                borderColor: '#A855F7',
              }}
            />

            {/* QR Scan */}
            {cameraPermission && (
              <TouchableOpacity
                onPress={() => setScannerVisible(true)}
                style={{
                  backgroundColor: '#222',
                  paddingVertical: 10,
                  paddingHorizontal: 20,
                  borderRadius: 12,
                  alignItems: 'center',
                  marginBottom: 10,
                  borderWidth: 1,
                  borderColor: '#A855F7',
                }}
              >
                <Text style={{ color: '#A855F7', fontFamily: 'Courier' }}>Scan QR</Text>
              </TouchableOpacity>
            )}

            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <TouchableOpacity
                onPress={() => setModalVisible(false)}
                style={{
                  backgroundColor: '#222',
                  paddingVertical: 10,
                  paddingHorizontal: 20,
                  borderRadius: 12,
                  alignItems: 'center',
                  borderWidth: 1,
                  borderColor: '#A855F7',
                }}
              >
                <Text style={{ color: '#A855F7', fontFamily: 'Lexend' }}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleSend}
                style={{
                  backgroundColor: '#A855F7',
                  paddingVertical: 10,
                  paddingHorizontal: 20,
                  borderRadius: 12,
                  alignItems: 'center',
                }}
              >
                <Text style={{ color: '#0A0A0A', fontFamily: 'Courier', fontWeight: 'bold' }}>
                  Send
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* QR Scanner Modal */}
      <Modal visible={scannerVisible} transparent animationType="slide">
        <View style={{ flex: 1 }}>
          {/* <BarCodeScanner
            onBarCodeScanned={handleBarCodeScanned}
            style={{ flex: 1 }}
          /> */}
          <TouchableOpacity
            onPress={() => setScannerVisible(false)}
            style={{
              position: 'absolute',
              bottom: 50,
              alignSelf: 'center',
              backgroundColor: '#222',
              paddingHorizontal: 20,
              paddingVertical: 10,
              borderRadius: 12,
              borderWidth: 1,
              borderColor: '#A855F7',
            }}
          >
            <Text style={{ color: '#A855F7', fontFamily: 'Courier' }}>Close</Text>
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
      style={{ paddingHorizontal: 8 }}
    >
      <View
        style={{
          flexDirection: 'row',
          padding: 8,
          backgroundColor: '#111111',
          borderRadius: 24,
          borderWidth: 1,
          borderColor: '#A855F7',
          shadowColor: '#A855F7',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.7,
          shadowRadius: 8,
          marginBottom: 16,
          alignItems: 'center',
        }}
      >
        {/* Text input */}
        <TextInput
          style={{
            flex: 1,
            backgroundColor: '#0F0F0F',
            borderRadius: 20,
            paddingHorizontal: 12,
            paddingVertical: 10,
            color: '#A855F7',
            fontFamily: 'Courier',
            fontSize: 16,
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
            borderRadius: 20,
            paddingHorizontal: 16,
            paddingVertical: 10,
            justifyContent: 'center',
            alignItems: 'center',
            shadowColor: '#A855F7',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.8,
            shadowRadius: 4,
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

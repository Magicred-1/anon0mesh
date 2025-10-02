import React, { useState } from 'react';
import {
    KeyboardAvoidingView,
    Platform,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface Props {
  onSend: (msg: string) => void;
  onSendAsset: (asset: string, amount: string, address: string) => void;
  placeholder?: string;
}

export default function MessageInput({ onSend, onSendAsset, placeholder }: Props) {
  const [text, setText] = useState('');
  const insets = useSafeAreaInsets();

  const handleSend = () => {
    if (!text.trim()) return;
    onSend(text.trim());
    setText('');
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={80}
      style={{ 
        paddingHorizontal: 20, 
        paddingBottom: Math.max(insets.bottom, 16),
        paddingTop: 12,
        backgroundColor: '#212122'
      }}
    >
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: '#404040',
          borderRadius: 24,
          paddingHorizontal: 16,
          paddingVertical: 8,
          marginHorizontal: 4,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.1,
          shadowRadius: 4,
          elevation: 2,
        }}
      >
        <TextInput
          style={{
            flex: 1,
            color: '#FFFFFF',
            fontSize: 16,
            paddingVertical: 12,
            paddingHorizontal: 4,
            fontFamily: 'System',
            minHeight: 44,
          }}
          placeholder={placeholder || "Type message..."}
          placeholderTextColor="#999999"
          value={text}
          onChangeText={setText}
          blurOnSubmit={false}
          onSubmitEditing={handleSend}
          returnKeyType="send"
          multiline={true}
          textAlignVertical="center"
        />

        <TouchableOpacity
          onPress={handleSend}
          style={{
            marginLeft: 12,
            backgroundColor: '#B10FF2',
            borderRadius: 20,
            paddingHorizontal: 16,
            paddingVertical: 10,
            justifyContent: 'center',
            alignItems: 'center',
            minWidth: 60,
            minHeight: 40,
          }}
        >
          <Text
            style={{
              color: '#FFFFFF',
              fontWeight: '600',
              fontSize: 14,
              fontFamily: 'System',
            }}
          >
            Send
          </Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

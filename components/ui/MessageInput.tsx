import React, { useState } from 'react';
import {
    KeyboardAvoidingView,
    Platform,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import SendIcon from './SendIcon';

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
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      style={{ 
        paddingHorizontal: 16, 
        paddingBottom: Math.max(insets.bottom, 12),
        paddingTop: 8,
        backgroundColor: '#212122',
        borderTopWidth: 1,
        borderTopColor: '#333333',
      }}
    >
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'flex-end',
          backgroundColor: '#2a2a2a',
          borderRadius: 24,
          paddingHorizontal: 16,
          paddingVertical: 4,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.15,
          shadowRadius: 6,
          elevation: 3,
          marginBottom: 4,
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
            maxHeight: 120,
            minHeight: 44,
            textAlignVertical: 'top',
          }}
          placeholder={placeholder || "Type message..."}
          placeholderTextColor="#888888"
          value={text}
          onChangeText={setText}
          blurOnSubmit={false}
          onSubmitEditing={handleSend}
          returnKeyType="send"
          multiline={true}
          scrollEnabled={true}
        />

        <TouchableOpacity
          onPress={handleSend}
          style={{
            marginLeft: 8,
            marginBottom: 4,
            backgroundColor: text.trim() ? '#b20ff265' : '#b20ff228',
            borderRadius: 22,
            width: 44,
            height: 44,
            justifyContent: 'center',
            alignItems: 'center',
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 1 },
            shadowOpacity: 0.2,
            shadowRadius: 2,
            elevation: 2,
          }}
          disabled={!text.trim()}
        >
          <SendIcon 
            size={20} 
            color={text.trim() ? '#FFFFFF' : '#999999'} 
          />
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

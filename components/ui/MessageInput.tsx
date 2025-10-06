import React, { useState } from 'react';
import {
    KeyboardAvoidingView,
    Platform,
    TextInput,
    TouchableOpacity,
    View,
    StyleSheet,
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
    const trimmedText = text.trim();
    if (!trimmedText) return;
    
    // Clear text immediately to prevent any trailing newlines
    setText('');
    
    // Send the message
    onSend(trimmedText);
  };

  const handleKeyPress = (e: any) => {
    // On enter key without shift, send the message
    if (e.nativeEvent.key === 'Enter' && !e.nativeEvent.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      style={{ flex: 0 }}
    >
      <View 
        style={[
          styles.container,
          { 
            paddingBottom: Math.max(insets.bottom, 8) + 8,
          }
        ]}
      >
        <View style={styles.inputWrapper}>
          <View style={styles.inputContainer}>
          <TextInput
            style={styles.input}
            placeholder={placeholder || "Message..."}
            placeholderTextColor="#6b7280"
            value={text}
            onChangeText={setText}
            blurOnSubmit={false}
            onSubmitEditing={handleSend}
            onKeyPress={handleKeyPress}
            returnKeyType="send"
            multiline={true}
            scrollEnabled={true}
          />

          <TouchableOpacity
            onPress={handleSend}
            style={[
              styles.sendButton,
              text.trim() && styles.sendButtonActive,
            ]}
            disabled={!text.trim()}
            activeOpacity={0.7}
          >
            <SendIcon 
              size={20} 
              color="#FFFFFF" 
            />
          </TouchableOpacity>
        </View>
      </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingTop: 12,
    backgroundColor: '#0f0f0f',
    borderTopWidth: 1,
    borderTopColor: '#2a2a2a',
  },
  inputWrapper: {
    marginBottom: 4,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    backgroundColor: '#1a1a1a',
    borderRadius: 10,
    paddingLeft: 16,
    paddingRight: 8,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#2a2a2a',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  input: {
    flex: 1,
    color: '#ffffff',
    fontSize: 15,
    paddingVertical: 8,
    paddingRight: 8,
    maxHeight: 100,
    minHeight: 36,
    textAlignVertical: 'center',
    lineHeight: 20,
    fontFamily: 'Lexend_400Regular',
  },
  sendButton: {
    marginLeft: 8,
    marginBottom: 0,
    backgroundColor: '#2a2a2a',
    borderRadius: 8,
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#333333',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0,
    shadowRadius: 2,
    elevation: 0,
  },
  sendButtonActive: {
    backgroundColor: '#B10FF2',
    borderColor: '#C84FFE',
    shadowColor: '#B10FF2',
    shadowOpacity: 0.4,
    elevation: 3,
  },
});

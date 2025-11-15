import React from 'react';
import { StyleSheet, TextInput, TouchableOpacity, View } from 'react-native';
import SendIcon from '../icons/SendIcon';

interface ChatInputProps {
  value: string;
  onChangeText: (text: string) => void;
  onSend: () => void;
  placeholder?: string;
  disabled?: boolean;
}

export default function ChatInput({
  value,
  onChangeText,
  onSend,
  placeholder = 'Type message...',
  disabled = false,
}: ChatInputProps) {
  return (
    <View style={styles.container}>
      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor="#22D3EE"
          multiline={false}
          maxLength={500}
          editable={!disabled}
        />
        <TouchableOpacity
          onPress={onSend}
          style={[styles.sendButton, (!value.trim() || disabled) && styles.sendButtonDisabled]}
          disabled={!value.trim() || disabled}
        >
          {/* <View style={styles.sendIcon}> */}
            <SendIcon width={16} height={16} color={!value.trim() || disabled ? '#333' : '#00CED1'} />
          {/* </View> */}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#000',
    borderTopWidth: 1,
    borderTopColor: '#00CED1',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 50,
    backgroundColor: '#000',
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#00CED1',
    paddingRight: 8,
  },
  input: {
    flex: 1,
    height: '100%',
    backgroundColor: 'transparent',
    paddingHorizontal: 15,
    color: '#00CED1',
    fontSize: 16,
    borderWidth: 0,
    fontFamily: 'monospace',
  },
  sendButton: {
    width: 36,
    height: 36,
    borderRadius: 4,
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#00CED1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonDisabled: {
    borderColor: '#333',
    opacity: 0.5,
  },
  sendIcon: {
    width: 0,
    height: 0,
    borderLeftWidth: 10,
    borderRightWidth: 0,
    borderTopWidth: 7,
    borderBottomWidth: 7,
    borderLeftColor: '#00CED1',
    borderTopColor: 'transparent',
    borderBottomColor: 'transparent',
    marginLeft: 2,
  },
});

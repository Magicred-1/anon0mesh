import React from 'react';
import { StyleSheet, TextInput, TouchableOpacity, View } from 'react-native';
import SendMessageIcon from '../icons/sendMessagesIcon';

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
            <SendMessageIcon size={16} />
          {/* </View> */}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: 'transparent',
    borderTopWidth: 1,
    borderTopColor: '#22D3EE',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 52,
    backgroundColor: 'transparent',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#00CED1',
    paddingLeft: 20,
    paddingRight: 6,
  },
  input: {
    flex: 1,
    height: '100%',
    backgroundColor: 'transparent',
    color: '#00F0FF',
    fontSize: 15,
    borderWidth: 0,
    paddingRight: 12,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: '#00CED1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonDisabled: {
    borderColor: '#333',
    opacity: 0.4,
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

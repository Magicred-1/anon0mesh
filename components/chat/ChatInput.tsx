import React from 'react';
import { StyleSheet, TextInput, TouchableOpacity, View } from 'react-native';

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
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#666"
        multiline
        maxLength={500}
        editable={!disabled}
      />
      <TouchableOpacity
        onPress={onSend}
        style={[styles.sendButton, (!value.trim() || disabled) && styles.sendButtonDisabled]}
        disabled={!value.trim() || disabled}
      >
        <View style={styles.sendIcon} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#000',
    borderTopWidth: 1,
    borderTopColor: '#00d9ff',
  },
  input: {
    flex: 1,
    minHeight: 40,
    maxHeight: 100,
    backgroundColor: 'transparent',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    color: '#fff',
    fontSize: 16,
    marginRight: 12,
    borderWidth: 1,
    borderColor: '#00d9ff',
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#00d9ff',
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
    borderLeftWidth: 12,
    borderRightWidth: 0,
    borderTopWidth: 8,
    borderBottomWidth: 8,
    borderLeftColor: '#00d9ff',
    borderTopColor: 'transparent',
    borderBottomColor: 'transparent',
    marginLeft: 3,
  },
});

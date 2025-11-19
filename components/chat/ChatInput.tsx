import { getCommandSuggestions } from '@/src/utils/chatCommands';
import React, { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
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
  // Get command suggestions
  const suggestions = useMemo(() => {
    return getCommandSuggestions(value);
  }, [value]);

  const showSuggestions = suggestions.length > 0 && value.startsWith('/');

  return (
    <View style={styles.container}>
      {/* Command Suggestions */}
      {showSuggestions && (
        <ScrollView
          horizontal
          style={styles.suggestionsContainer}
          contentContainerStyle={styles.suggestionsContent}
          showsHorizontalScrollIndicator={false}
        >
          {suggestions.map((suggestion, index) => (
            <TouchableOpacity
              key={index}
              style={styles.suggestionChip}
              onPress={() => onChangeText(suggestion)}
            >
              <Text style={styles.suggestionText} numberOfLines={1}>
                {suggestion}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

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
          <SendMessageIcon size={24} color="#FFFFFF" />
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
  suggestionsContainer: {
    marginBottom: 12,
    maxHeight: 40,
  },
  suggestionsContent: {
    gap: 8,
    paddingRight: 8,
  },
  suggestionChip: {
    backgroundColor: 'rgba(34, 211, 238, 0.1)',
    borderWidth: 1,
    borderColor: '#22D3EE',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    maxWidth: 300,
  },
  suggestionText: {
    color: '#22D3EE',
    fontSize: 13,
    fontWeight: '500',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 52,
    backgroundColor: 'transparent',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#22D3EE',
    paddingLeft: 20,
    paddingRight: 6,
  },
  input: {
    flex: 1,
    height: '100%',
    backgroundColor: 'transparent',
    color: '#22D3EE',
    fontSize: 16,
    borderWidth: 0,
    paddingRight: 12,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#0C2425',
    borderWidth: 2,
    borderColor: '#22D3EE',
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
    borderLeftColor: '#22D3EE',
    borderTopColor: 'transparent',
    borderBottomColor: 'transparent',
    marginLeft: 2,
  },
});

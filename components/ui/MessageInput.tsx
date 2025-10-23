import React, { useEffect, useRef, useState } from 'react';
import {
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import SendIcon from './SendIcon';

interface Props {
  onSend: (msg: string) => void;
  placeholder?: string;
  messagesRemaining?: number;
  isUnlocked?: boolean;
}

export default function MessageInput({ onSend, placeholder, messagesRemaining, isUnlocked }: Props) {
  const [text, setText] = useState('');
  const insets = useSafeAreaInsets();
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const inputRef = useRef<TextInput | null>(null);

  const handleSend = () => {
    const trimmedText = text.trim();
    if (!trimmedText) return;
    
    // Clear text immediately to prevent any trailing newlines
    setText('');
    
    // Send the message
    onSend(trimmedText);

    // Re-focus the input after a short delay so the keyboard stays open
    // (blurOnSubmit will have blurred it). This keeps the flow continuous.
    setTimeout(() => {
      inputRef.current?.focus();
    }, 50);
  };

  const handleKeyPress = (e: any) => {
    // On enter key without shift, send the message
    if (e.nativeEvent.key === 'Enter' && !e.nativeEvent.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Determine status message
  const getStatusMessage = () => {
    if (isUnlocked) {
      return { text: '∞ Unlimited', color: '#10B981' }; // Green
    }
    if (messagesRemaining !== undefined) {
      if (messagesRemaining === 0) {
        return { text: '⚠️ Limit reached', color: '#EF4444' }; // Red
      }
      return { text: `${messagesRemaining} msg${messagesRemaining === 1 ? '' : 's'} left`, color: '#F59E0B' }; // Orange
    }
    return null;
  };

  const statusMessage = getStatusMessage();

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const onShow = (e: any) => {
      // Only measure keyboard height on Android. On iOS we rely on
      // KeyboardAvoidingView's 'padding' behavior to avoid double-offsets.
      if (Platform.OS === 'android') {
        const h = e?.endCoordinates?.height || 0;
        setKeyboardHeight(h);
      }
    };
    const onHide = () => setKeyboardHeight(0);

    const showSub = Keyboard.addListener(showEvent, onShow);
    const hideSub = Keyboard.addListener(hideEvent, onHide);

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  return (
    // On Android, using `behavior='height'` generally produces more reliable
    // results for multi-line inputs and different keyboard implementations.
    // We also offset by the bottom safe-area inset so the input doesn't hide
    // behind system gestures or nav bars.
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      // On iOS offset by the bottom safe area so the view aligns with system UI.
      keyboardVerticalOffset={Platform.OS === 'ios' ? Math.max(insets.bottom, 8) + 8 : 0}
      style={{ width: '100%' }}
    >
      <View 
        style={[
          styles.container,
          { 
            // Add measured keyboard height only for Android; iOS uses
            // KeyboardAvoidingView to adjust layout to avoid double-offset.
            paddingBottom: Math.max(insets.bottom, 8) + 8 + (Platform.OS === 'android' ? keyboardHeight : 0),
          }
        ]}
      >
        {/* Rate Limit Status */}
        {statusMessage && (
          <View style={styles.statusContainer}>
            <Text style={[styles.statusText, { color: statusMessage.color }]}>
              {statusMessage.text}
            </Text>
          </View>
        )}

        <View style={styles.inputWrapper}>
          <View style={styles.inputContainer}>
          <TextInput
            style={styles.input}
            placeholder={placeholder || "Message..."}
            placeholderTextColor="#6b7280"
            value={text}
            onChangeText={setText}
            blurOnSubmit={true}
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
  statusContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 8,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600',
    fontFamily: 'Lexend_400Regular',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
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
    // Use 'top' so the cursor and first line don't appear vertically centered
    // on iOS multiline TextInput (fixes common rendering/cursor glitches).
    textAlignVertical: 'top',
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
    backgroundColor: '#26C6DA',
    borderColor: '#21a3b4ff',
    shadowColor: '#26C6DA',
    shadowOpacity: 0.4,
    elevation: 3,
  },
});

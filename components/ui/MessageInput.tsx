import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, Text, TextInput, TouchableOpacity, View } from 'react-native';

interface Props {
    onSend: (msg: string) => void;
    placeholder?: string;
}

export default function MessageInput({ onSend, placeholder }: Props) {
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
            borderColor: '#00FF9C',
            shadowColor: '#00FF9C',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.7,
            shadowRadius: 8,
            marginBottom: 16,
            }}
        >
            <TextInput
            style={{
                flex: 1,
                backgroundColor: '#0F0F0F',
                borderRadius: 20,
                paddingHorizontal: 12,
                paddingVertical: 10,
                color: '#00FF9C',
                fontFamily: 'Courier',
            }}
            placeholder={placeholder || 'Type a message...'}
            placeholderTextColor="#555"
            value={text}
            onChangeText={setText}
            blurOnSubmit={false} // keep focus on input
            onSubmitEditing={handleSend} // send on Enter/Return
            returnKeyType="send"
            />

            <TouchableOpacity
            onPress={handleSend}
            style={{
                marginLeft: 8,
                backgroundColor: '#00FF9C',
                borderRadius: 20,
                paddingHorizontal: 16,
                paddingVertical: 10,
                justifyContent: 'center',
                alignItems: 'center',
                shadowColor: '#00FF9C',
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
                }}
            >
                Send
            </Text>
            </TouchableOpacity>
        </View>
        </KeyboardAvoidingView>
    );
}

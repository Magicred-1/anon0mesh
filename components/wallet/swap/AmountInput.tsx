import React from 'react';
import { StyleSheet, TextInput } from 'react-native';

type Props = {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
};

export default function AmountInput({ value, onChange, placeholder }: Props) {
    return (
        <TextInput
        value={value}
        onChangeText={onChange}
        keyboardType="numeric"
        style={styles.input}
        placeholder={placeholder ?? '0.00'}
        placeholderTextColor="#6ea"
        />
    );
}

const styles = StyleSheet.create({
  input: {
    flex: 1,
    height: 48,
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
});

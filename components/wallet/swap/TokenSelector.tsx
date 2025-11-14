import React from 'react';
import { StyleSheet, Text, TouchableOpacity } from 'react-native';

type Props = {
  token: string;
  onPress?: () => void;
  secondary?: boolean;
};

export default function TokenSelector({ token, onPress, secondary }: Props) {
  return (
    <TouchableOpacity onPress={onPress} style={secondary ? styles.selectorSecondary : styles.selector}>
      <Text style={styles.tokenText}>{token}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  selector: {
    width: 72,
    height: 48,
    borderRadius: 10,
    backgroundColor: 'rgba(0,212,212,0.08)',
    borderWidth: 1,
    borderColor: '#00d4d4',
    justifyContent: 'center',
    alignItems: 'center',
  },
  selectorSecondary: {
    width: 72,
    height: 48,
    borderRadius: 10,
    backgroundColor: 'rgba(0,212,212,0.02)',
    borderWidth: 1,
    borderColor: 'rgba(0,212,212,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  tokenText: {
    color: '#fff',
    fontWeight: '800',
  },
});

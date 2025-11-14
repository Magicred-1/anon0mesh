import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

type Props = {
  rateText?: string;
  onSwap?: () => void;
};

export default function SwapFooter({ rateText, onSwap }: Props) {
  return (
    <View>
      {rateText ? <Text style={styles.rateText}>{rateText}</Text> : null}
      <TouchableOpacity style={styles.swapButton} onPress={onSwap} activeOpacity={0.85}>
        <Text style={styles.swapButtonText}>CONFIRM SWAP</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  rateText: {
    color: '#8fa9a9',
    fontSize: 12,
    marginTop: 8,
    marginBottom: 12,
  },
  swapButton: {
    backgroundColor: '#00d4d4',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  swapButtonText: {
    color: '#042626',
    fontWeight: '900',
    letterSpacing: 1,
  },
});

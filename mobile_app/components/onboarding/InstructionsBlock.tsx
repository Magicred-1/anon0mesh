import React, { memo } from 'react';
import { Text, View, StyleSheet } from 'react-native';
import { fontFamily, fontSize, spacing } from '@/theme';

interface Props { isSolanaMobile: boolean }

export const InstructionsBlock = memo(function InstructionsBlock({ isSolanaMobile }: Props) {
  return (
    <View style={S.container}>
      <Text style={S.text}>
        {isSolanaMobile
          ? 'TO GET STARTED\nCONNECT YOUR SOLANA WALLET\nVIA MOBILE WALLET ADAPTER'
          : 'TO GET STARTED\nCREATE A SECURE WALLET\nYOUR NICKNAME WILL BE GENERATED\nAUTOMATICALLY'}
      </Text>
    </View>
  );
});

const S = StyleSheet.create({
  container: { alignItems: 'center', marginBottom: spacing[12], paddingHorizontal: spacing[6] },
  text: {
    fontFamily: fontFamily.sansMd, fontSize: fontSize.sm, color: '#8fa9a9',
    textAlign: 'center', lineHeight: 24, letterSpacing: 2,
  },
});

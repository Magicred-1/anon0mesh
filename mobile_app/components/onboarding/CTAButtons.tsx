import React, { memo } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { fontFamily } from '@/theme';
import { SolanaIcon } from './SolanaIcon';

interface Props {
  isLoading: boolean;
  onConnect: () => void;
  onCreate:  () => void;
}

export const CTAButtons = memo(function CTAButtons({ isLoading, onConnect, onCreate }: Readonly<Props>) {
  return (
    <View style={S.wrap}>

      {/* CREATE IDENTITY — flat solid cyan pill, no gradient, no glow. */}
      <Pressable
        onPress={onCreate}
        disabled={isLoading}
        style={({ pressed }) => [S.primary, isLoading && S.dim, pressed && S.pressed]}
      >
        <Text style={S.primaryText}>
          {isLoading ? 'CREATING…' : 'CREATE IDENTITY'}
        </Text>
      </Pressable>

      {/* CONNECT WALLET — Android only, cyan outline pill */}
      {Platform.OS === 'android' && (
        <Pressable
          onPress={onConnect}
          disabled={isLoading}
          style={({ pressed }) => [
            S.secondary,
            isLoading && S.dim,
            pressed && S.pressed,
          ]}
        >
          <SolanaIcon size={16} color="#00c8e0" />
          <Text style={S.secondaryText}>CONNECT WALLET</Text>
        </Pressable>
      )}

    </View>
  );
});

const S = StyleSheet.create({
  wrap: { paddingHorizontal: 24, gap: 14 },

  // Primary CTA — flat solid cyan, no gradient, no shadow glow.
  primary: {
    height: 60, borderRadius: 32,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#00c8e0',
  },
  primaryText: {
    fontFamily: fontFamily.sansMd,
    fontSize: 14, fontWeight: '800',
    color: '#001820', letterSpacing: 3,
  },

  secondary: {
    height: 54, borderRadius: 27,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    backgroundColor: 'rgba(0,229,255,0.05)',
    borderWidth: 1, borderColor: 'rgba(0,229,255,0.22)',
  },
  secondaryText: {
    fontFamily: fontFamily.sansMd,
    fontSize: 13, fontWeight: '600',
    color: 'rgba(0,229,255,0.65)', letterSpacing: 2.5,
  },

  dim:     { opacity: 0.45 },
  pressed: { opacity: 0.8 },
});

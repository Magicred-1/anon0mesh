import React, { memo } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
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

      {/* CREATE IDENTITY — cyan gradient pill + glow */}
      <Pressable
        onPress={onCreate}
        disabled={isLoading}
        style={({ pressed }) => [S.primaryShell, isLoading && S.dim, pressed && S.pressed]}
      >
        <LinearGradient
          colors={['#00e5ff', '#0099bb']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={S.primary}
        >
          <Text style={S.primaryText}>
            {isLoading ? 'CREATING…' : 'CREATE IDENTITY'}
          </Text>
        </LinearGradient>
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

  // Outer shell carries the shadow / glow
  primaryShell: {
    borderRadius: 32,
    shadowColor: '#00e5ff',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 18,
    elevation: 10,
  },
  primary: {
    height: 60, borderRadius: 32,
    alignItems: 'center', justifyContent: 'center',
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

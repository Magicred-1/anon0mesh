import React, { memo, useEffect, useRef } from 'react';
import { Animated, Pressable, Text, View, StyleSheet } from 'react-native';
import { fontFamily } from '@/theme';
import { CYAN, DARK } from './constants';
import { SolanaIcon } from './SolanaIcon';

interface Props {
  isLoading: boolean;
  onConnect: () => void;
  onCreate:  () => void;
}

export const CTAButtons = memo(function CTAButtons({ isLoading, onConnect, onCreate }: Props) {
  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.012, duration: 2400, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1,     duration: 2400, useNativeDriver: true }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, [pulse]);

  const dim = isLoading ? '#6a7a7a' : CYAN;

  return (
    <View style={S.wrap}>
      <Animated.View style={{ transform: [{ scale: pulse }], gap: 14 }}>

        {/* CREATE_WALLET */}
        <Pressable
          onPress={onCreate}
          disabled={isLoading}
          style={({ pressed }) => [S.btn, pressed && S.pressed]}
        >
          <View style={S.btnInner}>
            <Text style={[S.btnText, { color: dim }]}>
              {isLoading ? 'LOADING...' : 'CREATE_WALLET'}
            </Text>
          </View>
        </Pressable>

        {/* CONNECT_WALLET */}
        <Pressable
          onPress={onConnect}
          disabled={isLoading}
          style={({ pressed }) => [S.btn, pressed && S.pressed]}
        >
          <View style={[S.btnInner, S.btnRow]}>
            <Text style={[S.btnText, { color: dim }]}>
              {isLoading ? 'LOADING...' : 'CONNECT_WALLET'}
            </Text>
            <View style={S.iconWrap}>
              <SolanaIcon size={28} color={dim} />
            </View>
          </View>
        </Pressable>

      </Animated.View>

      <Text style={S.footer}>🔒 OPEN SOURCE • PRIVATE • DECENTRALIZED</Text>
    </View>
  );
});

const S = StyleSheet.create({
  wrap: {
    paddingHorizontal: 16,
    paddingBottom: 20,
    paddingTop: 8,
    gap: 14,
  },

  btn: {
    height: 64,
    borderRadius: 10,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: CYAN,
    backgroundColor: DARK,
    shadowColor: CYAN,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.7,
    shadowRadius: 10,
    elevation: 6,
  },
  pressed: { opacity: 0.72 },

  btnInner: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,229,255,0.03)',
  },
  btnRow: {
    flexDirection: 'row',
    paddingHorizontal: 20,
  },

  btnText: {
    fontFamily: fontFamily.sansMd,
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: 3,
    textShadowColor: CYAN,
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 8,
  },

  iconWrap: {
    position: 'absolute',
    right: 20,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
  },

  footer: {
    fontFamily: fontFamily.sansMd,
    fontSize: 10,
    color: '#3a6060',
    letterSpacing: 1.5,
    textAlign: 'center',
  },
});

import React, { memo } from 'react';
import { Image, Text, View, StyleSheet } from 'react-native';
import { fontFamily } from '@/theme';
import { CYAN } from './constants';

export const LogoBlock = memo(function LogoBlock() {
  return (
    <View style={S.container}>
      <Image
        source={require('../../assets/images/logos/anonmesh_logo.png')}
        style={S.image}
        resizeMode="contain"
      />
      <Text style={S.tagline}>[ CONFIDENTIAL OFFLINE MODE ]</Text>
    </View>
  );
});

const S = StyleSheet.create({
  container: { paddingHorizontal: 20, alignItems: 'center' },
  image:     { width: '100%', height: 76 },
  tagline:   {
    fontFamily: fontFamily.sansMd,
    fontSize: 12,
    color: CYAN,
    letterSpacing: 2.5,
    marginTop: 10,
    textAlign: 'center',
  },
});

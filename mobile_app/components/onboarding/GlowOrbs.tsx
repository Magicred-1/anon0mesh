import React, { memo } from 'react';
import { View, StyleSheet } from 'react-native';
import { radii } from '@/theme';
import { CYAN } from './constants';

export const GlowOrbs = memo(function GlowOrbs() {
  return (
    <>
      <View style={S.top}    pointerEvents="none" />
      <View style={S.bottom} pointerEvents="none" />
    </>
  );
});

const S = StyleSheet.create({
  top: {
    position: 'absolute', top: -80, alignSelf: 'center',
    width: 500, height: 500, borderRadius: radii.full,
    backgroundColor: CYAN, opacity: 0.055,
  },
  bottom: {
    position: 'absolute', bottom: -120, right: '15%',
    width: 280, height: 280, borderRadius: radii.full,
    backgroundColor: CYAN, opacity: 0.025,
  },
});

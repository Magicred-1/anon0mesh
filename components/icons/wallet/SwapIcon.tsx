import React from 'react';
import { View } from 'react-native';
// @ts-ignore
import SwapSvg from '../../../assets/images/icons/swap_icon.svg';

const SwapIcon = ({ size = 32, color = '#000000' }: { size?: number, color?: string }) => {
  return (
    <View style={{ width: size, height: size, justifyContent: 'center', alignItems: 'center' }}>
      <SwapSvg width={size} height={size} fill={color} />
    </View>
  );
};

export default SwapIcon;

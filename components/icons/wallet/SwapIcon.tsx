import React from 'react';
import { View } from 'react-native';
// @ts-ignore
import SwapSvg from '../../../assets/images/swap_icon.svg';

const SwapIcon = ({ size = 32 }: { size?: number }) => {
  return (
    <View style={{ width: size, height: size, justifyContent: 'center', alignItems: 'center' }}>
      <SwapSvg width={size} height={size} />
    </View>
  );
};

export default SwapIcon;

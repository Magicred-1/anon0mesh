import React from 'react';
import { View } from 'react-native';
// @ts-ignore
import WalletSvg from '../../assets/images/wallet_icon.svg';

const WalletIcon = ({ size = 32 }: { size?: number }) => {
  return (
    <View style={{ width: size, height: size, justifyContent: 'center', alignItems: 'center' }}>
      <WalletSvg width={size} height={size} />
    </View>
  );
};

export default WalletIcon;

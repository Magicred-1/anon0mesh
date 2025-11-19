import { Wallet } from 'phosphor-react-native';
import React from 'react';

const WalletIcon = ({ size = 32, color }: { size?: number; color?: string }) => {
  return <Wallet size={size} color={color} weight="regular" />;
};

export default WalletIcon;

import React from 'react';
import { View } from 'react-native';
// @ts-ignore
import LockSvg from '../../assets/images/locked_icon.svg';

const LockIcon = ({ size = 32 }: { size?: number }) => {
  return (
    <View style={{ width: size, height: size, justifyContent: 'center', alignItems: 'center' }}>
      <LockSvg width={size} height={size} />
    </View>
  );
};

export default LockIcon;

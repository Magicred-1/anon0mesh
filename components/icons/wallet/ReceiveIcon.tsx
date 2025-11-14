import React from 'react';
import { View } from 'react-native';
// @ts-ignore
import ReceiveSvg from '../../../assets/images/receive_icon.svg';

const ReceiveIcon = ({ size = 32 }: { size?: number }) => {
  return (
    <View style={{ width: size, height: size, justifyContent: 'center', alignItems: 'center' }}>
      <ReceiveSvg width={size} height={size} />
    </View>
  );
};

export default ReceiveIcon;

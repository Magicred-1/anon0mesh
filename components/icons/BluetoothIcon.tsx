import React from 'react';
import { View } from 'react-native';
// @ts-ignore
import BluetoothSvg from '../../assets/images/icons/bluetooth_icon.svg';

const BluetoothIcon = ({ size = 32 }: { size?: number }) => {
  return (
    <View style={{ width: size, height: size, justifyContent: 'center', alignItems: 'center' }}>
      <BluetoothSvg width={size} height={size} />
    </View>
  );
};

export default BluetoothIcon;


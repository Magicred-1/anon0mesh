import { Bluetooth } from 'phosphor-react-native';
import React from 'react';

const BluetoothIcon = ({ size = 32, color = "#fff" }: { size?: number; color? : string }) => {
  return <Bluetooth size={size} color={color} weight="regular" />;
};

export default BluetoothIcon;


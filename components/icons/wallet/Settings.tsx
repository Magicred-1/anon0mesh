import React from 'react';
import { View } from 'react-native';
// @ts-ignore
import SettingsSvg from '../../../assets/images/icons/settings_icon.svg';

const SettingsIcon = ({ size = 32 }: { size?: number }) => {
  return (
    <View style={{ width: size, height: size, justifyContent: 'center', alignItems: 'center' }}>
      <SettingsSvg width={size} height={size} />
    </View>
  );
};

export default SettingsIcon;

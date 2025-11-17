import React from 'react';
import { View } from 'react-native';
// @ts-ignore
import ArciumSvg from '../../assets/images/icons/arcium_icon.svg';
const ArciumIcon = ({ size = 32 }: { size?: number }) => {
  return (
    <View style={{ width: size, height: size, justifyContent: 'center', alignItems: 'center' }}>
      <ArciumSvg width={size} height={size} />
    </View>
  );
};

export default ArciumIcon;

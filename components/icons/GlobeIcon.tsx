import React from 'react';
import { View } from 'react-native';
// @ts-ignore
import GlobeSvg from '../../assets/images/icons/Vector.svg';

const GlobeIcon = ({ size = 32 }: { size?: number }) => {
  return (
    <View style={{ width: size, height: size, justifyContent: 'center', alignItems: 'center' }}>
      <GlobeSvg width={size} height={size} />
    </View>
  );
};

export default GlobeIcon;

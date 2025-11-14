import React from 'react';
import { View } from 'react-native';
// @ts-ignore
import GhostSvg from '../../assets/images/Pacman.svg';

const GhostIcon = ({ size = 32 }: { size?: number }) => {
  return (
    <View style={{ width: size, height: size, justifyContent: 'center', alignItems: 'center' }}>
      <GhostSvg width={size} height={size} />
    </View>
  );
};

export default GhostIcon;

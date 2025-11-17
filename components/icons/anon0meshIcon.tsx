import React from 'react';
import { View } from 'react-native';
// @ts-ignore
import AnonmeshSVG from '../../assets/images/icons/anonmesh_icon.svg';

const anonmeshIcon = ({ size = 32 }: { size?: number }) => {
  return (
    <View style={{ width: size, height: size, justifyContent: 'center', alignItems: 'center' }}>
      <AnonmeshSVG width={size} height={size} />
    </View>
  );
};

export default anonmeshIcon;

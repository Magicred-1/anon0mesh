import React from 'react';
import { View } from 'react-native';
// @ts-ignore
import USDCSvg from '../../assets/images/icons/usdc_icon.svg';

type Props = {
  size?: number;
};

const USDCIcon = ({ size = 40 }: Props) => {
  return (
    <View style={{ width: size, height: size }} >
        <USDCSvg width={size} height={size} />
    </View>
  );
};

export default USDCIcon;

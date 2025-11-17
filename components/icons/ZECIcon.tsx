import React from 'react';
import { View } from 'react-native';
// @ts-ignore
import ZECSvg from '../../assets/images/icons/zcash_icon.svg';

type Props = {
    size?: number;
};

const ZECIcon = ({ size = 40 }: Props) => {
    return (
        <View style={{ width: size, height: size }} >
            <ZECSvg width={size} height={size} />
        </View>
    );
};

export default ZECIcon;

import React from 'react';
import { View } from 'react-native';
// @ts-ignore
import SolanaSvg from '../../assets/images/icons/solana_icon.svg';

type Props = {
    size?: number;
    color?: string;
};

const SolanaIcon = ({ size = 32, color }: Props) => {
    return (
        <View style={{ width: size, height: size, justifyContent: 'center', alignItems: 'center' }}>
            <SolanaSvg width={size} height={size} fill={color} />
        </View>
    );
};

export default SolanaIcon;

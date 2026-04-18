import React, { memo } from 'react';
import { View, Text } from 'react-native';
import { fontFamily } from '@/theme';

interface Props {
  asset: { sym: string; color: string };
  size?: number;
}

export const AssetDot = memo(function AssetDot({ asset, size = 28 }: Props) {
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: asset.color, alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
      <Text style={{ fontFamily: fontFamily.sansMd, fontSize: size * 0.32, fontWeight: '600', color: '#fff' }}>
        {asset.sym[0]}
      </Text>
    </View>
  );
});

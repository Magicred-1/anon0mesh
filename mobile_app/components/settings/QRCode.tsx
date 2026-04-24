import React from 'react';
import { View, Image } from 'react-native';
import QRCodeSVG from 'react-native-qrcode-svg';
import { useTheme } from '@/theme';

const BG = '#0B0C10';
const FG = '#EEEEF0';

export function QRCode({ size = 180, data = 'anonmesh' }: Readonly<{ size?: number; data?: string }>) {
  const { colors } = useTheme();
  const logoSize = Math.round(size * 0.22);
  const wrapPad  = 5;
  const wrapSize = logoSize + wrapPad * 2;
  const wrapOff  = (size - wrapSize) / 2;

  return (
    <View style={{ width: size, height: size }}>
      <QRCodeSVG
        value={data || 'anonmesh'}
        size={size}
        color={FG}
        backgroundColor={BG}
        ecl="H"
        quietZone={0}
      />
      {/* Circular logo overlay — cyan tinted, covers ~30% (within ecl H tolerance) */}
      <View style={{
        position: 'absolute',
        left: wrapOff, top: wrapOff,
        width: wrapSize, height: wrapSize,
        backgroundColor: BG,
        borderRadius: wrapSize / 2,
        alignItems: 'center', justifyContent: 'center',
      }}>
        <Image
          // eslint-disable-next-line @typescript-eslint/no-require-imports
          source={require('@/assets/icons/anonmesh_white_icon.png')}
          style={{ width: logoSize, height: logoSize, tintColor: colors.primary }}
          resizeMode="contain"
        />
      </View>
    </View>
  );
}

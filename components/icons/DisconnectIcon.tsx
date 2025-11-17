import React from 'react';
import { StyleSheet, View } from 'react-native';
// @ts-ignore
import DisconnectSvg from '../../assets/images/disconnect_icon.svg';

interface DisconnectIconProps {
  size?: number;
  color?: string;
}

export default function DisconnectIcon({ size = 32, color = '#22D3EE' }: DisconnectIconProps) {
  return (
    <View style={[styles.container, { width: size, height: size }]}>
        <DisconnectSvg width={size} height={size} fill={color} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  leftPlug: {
    position: 'absolute',
  },
  rightPlug: {
    position: 'absolute',
  },
  prong: {
    position: 'absolute',
  },
  hole: {
    position: 'absolute',
  },
});

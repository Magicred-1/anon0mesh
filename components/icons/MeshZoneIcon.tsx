import React from 'react';
import { StyleSheet, View } from 'react-native';
// @ts-ignore
import MeshZoneSvg from '../../assets/images/icons/mesh_icon.svg';

interface MeshZoneIconProps {
  size?: number;
  color?: string;
}

export default function MeshZoneIcon({ size = 32, color = '#22D3EE' }: MeshZoneIconProps) {
  return (
    <View style={[styles.container, { width: size, height: size }]}>
        <MeshZoneSvg width={size} height={size} fill={color} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  circle: {
    position: 'absolute',
  },
  verticalLine: {
    position: 'absolute',
  },
  horizontalLine: {
    position: 'absolute',
  },
  topCurve: {
    position: 'absolute',
  },
  bottomCurve: {
    position: 'absolute',
  },
});

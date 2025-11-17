import React from 'react';
import { StyleSheet, View } from 'react-native';
// @ts-ignore
import ProfileSvg from '../../assets/images/profile_icon.svg';

interface ProfileIconProps {
  size?: number;
  color?: string;
}

export default function ProfileIcon({ size = 32, color = '#22D3EE' }: ProfileIconProps) {
  return (
    <View style={[styles.container, { width: size, height: size }]}>
        <ProfileSvg width={size} height={size} fill={color} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  outerCircle: {
    position: 'absolute',
  },
  head: {
    position: 'absolute',
  },
  body: {
    position: 'absolute',
  },
});

import React from 'react';
import { StyleSheet, View } from 'react-native';
// @ts-ignore
import MessagesSvg from '../../assets/images/icons/messages_icon.svg';
interface MessagesIconProps {
  size?: number;
  color?: string;
}

export default function MessagesIcon({ size = 32, color = '#22D3EE' }: MessagesIconProps) {
  return (
    <View style={[styles.container, { width: size, height: size }]}>
        <MessagesSvg width={size} height={size} fill={color} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  bubble: {
    borderWidth: 2,
    position: 'absolute',
  },
  line1: {
    position: 'absolute',
    borderRadius: 2,
  },
  line2: {
    position: 'absolute',
    borderRadius: 2,
  },
});

import React from 'react';
import { StyleSheet, View } from 'react-native';
// @ts-ignore
import HistorySvg from '../../assets/images/icons/history_icon.svg';

interface HistoryIconProps {
  size?: number;
  color?: string;
}

export default function HistoryIcon({ size = 32, color = '#22D3EE' }: HistoryIconProps) {
  return (
    <View style={[styles.container, { width: size, height: size }]}>
        <HistorySvg width={size} height={size} fill={color} />
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
  hourHand: {
    position: 'absolute',
    transformOrigin: 'bottom center',
    transform: [{ rotate: '90deg' }],
  },
  minuteHand: {
    position: 'absolute',
    transformOrigin: 'bottom center',
    transform: [{ rotate: '180deg' }],
  },
  arrow: {
    position: 'absolute',
    transform: [{ rotate: '45deg' }],
  },
});

import HistoryScreen from '@/components/screens/HistoryScreen';
import React from 'react';
import { StyleSheet, View } from 'react-native';

export default function HistoryPage() {
  return (
    <View style={styles.container}>
      <HistoryScreen />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0D0D0D',
  },
});

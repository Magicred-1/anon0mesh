import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import SettingsIcon from '../icons/wallet/Settings';

type Props = {
  title?: string;
  onBack?: () => void;
  onRightPress?: () => void;
};

export default function WalletHeader({ title = 'Wallet', onBack, onRightPress }: Props) {
  return (
    <View style={styles.header}>
      <TouchableOpacity onPress={onBack} style={styles.backButton}>
        <Text style={styles.backArrow}>←</Text>
      </TouchableOpacity>
      <Text style={styles.headerTitle}>{title}</Text>
      <TouchableOpacity onPress={onRightPress} style={styles.settingsButton}>
        <View style={styles.settingsIcon}>
          <SettingsIcon size={24} />
        </View>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  backButton: {
    padding: 4,
    width: 40,
  },
  backArrow: {
    fontSize: 24,
    color: '#fff',
    fontWeight: 'bold',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#fff',
  },
  settingsButton: {
    padding: 4,
    width: 40,
    alignItems: 'flex-end',
  },
  settingsIcon: {
    width: 24,
    height: 24,
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
});


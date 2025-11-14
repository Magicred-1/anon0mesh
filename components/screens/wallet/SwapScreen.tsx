import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import SwapIcon from '../../icons/wallet/SwapIcon';
import SendSettingsModal from '../../modals/SettingsModal';
import AmountInput from '../../wallet/swap/AmountInput';
import SwapFooter from '../../wallet/swap/SwapFooter';
import TokenSelector from '../../wallet/swap/TokenSelector';
import WalletHeader from '../../wallet/WalletHeader';
import { useWalletTabs } from '../../wallet/WalletTabsContext';

export default function SwapScreen({ hideHeader = false }: { hideHeader?: boolean } = {}) {
  const router = useRouter();
  const tabs = useWalletTabs();
  const [fromToken, setFromToken] = useState('SOL');
  const [toToken, setToToken] = useState('USDC');
  const [fromAmount, setFromAmount] = useState('0.00');
  const [toAmount, setToAmount] = useState('0.00');

  const handleBack = () => router.back();

  const handleSwap = () => {
    Alert.alert('Swap', `Swapping ${fromAmount} ${fromToken} → ${toAmount} ${toToken}`);
  };

  const handleReverse = () => {
    setFromToken(prev => {
      setToToken(prev === toToken ? fromToken : toToken);
      return toToken;
    });
    setFromAmount(toAmount);
    setToAmount(fromAmount);
  };

  return (
    <SafeAreaView style={styles.container} edges={["top", "left", "right"]}>
      {!hideHeader && <WalletHeader title="Swap" onBack={handleBack} />}

      <View style={styles.card}>
        <Text style={styles.label}>From</Text>
        <View style={styles.row}>
          <TokenSelector token={fromToken} />
          <AmountInput value={fromAmount} onChange={setFromAmount} />
        </View>

        <TouchableOpacity style={styles.reverseButton} onPress={handleReverse}>
          <SwapIcon />
        </TouchableOpacity>

        <Text style={[styles.label, { marginTop: 8 }]}>To</Text>
        <View style={styles.row}>
          <TokenSelector token={toToken} secondary />
          <AmountInput value={toAmount} onChange={setToAmount} />
        </View>

        <SwapFooter rateText={`1 ${fromToken} ≈ 22.34 ${toToken}`} onSwap={handleSwap} />
      </View>

      {/* Settings Modal */}
      <SendSettingsModal
        visible={tabs.showSettings}
        onClose={() => tabs.setShowSettings(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a1a1a',
    paddingHorizontal: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
  },
  backButton: {
    width: 40,
  },
  backArrow: {
    color: '#00d9ff',
    fontSize: 22,
    fontWeight: '700',
  },
  headerTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '700',
  },
  card: {
    marginTop: 18,
    backgroundColor: 'rgba(13, 38, 38, 0.6)',
    borderRadius: 14,
    padding: 18,
    borderWidth: 1,
    borderColor: 'rgba(0, 212, 212, 0.25)',
  },
  label: {
    color: '#00d4d4',
    fontWeight: '700',
    marginBottom: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  tokenSelector: {
    width: 72,
    height: 48,
    borderRadius: 10,
    backgroundColor: 'rgba(0,212,212,0.08)',
    borderWidth: 1,
    borderColor: '#00d4d4',
    justifyContent: 'center',
    alignItems: 'center',
  },
  tokenSelectorSecondary: {
    width: 72,
    height: 48,
    borderRadius: 10,
    backgroundColor: 'rgba(0,212,212,0.02)',
    borderWidth: 1,
    borderColor: 'rgba(0,212,212,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  tokenText: {
    color: '#fff',
    fontWeight: '800',
  },
  input: {
    flex: 1,
    height: 48,
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  reverseButton: {
    alignSelf: 'center',
    marginVertical: 8,
  },
  rateText: {
    color: '#8fa9a9',
    fontSize: 12,
    marginTop: 8,
    marginBottom: 12,
  },
  swapButton: {
    backgroundColor: '#00d4d4',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  swapButtonText: {
    color: '#042626',
    fontWeight: '900',
    letterSpacing: 1,
  },
});

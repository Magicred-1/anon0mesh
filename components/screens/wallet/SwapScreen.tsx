import SolanaIcon from '@/components/icons/SolanaIcon';
import USDCIcon from '@/components/icons/USDCIcon';
import SettingsIcon from '@/components/icons/wallet/Settings';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

type TokenType = 'SOL' | 'USDC';

const TOKEN_BALANCES = {
  SOL: 2.8989,
  USDC: 400.8989,
};

const EXCHANGE_RATE = 141.457; // 1 SOL = 141.457 USDC

export default function SwapScreen() {
  const router = useRouter();
  const [fromToken, setFromToken] = useState<TokenType>('SOL');
  const [toToken, setToToken] = useState<TokenType>('USDC');
  const [fromAmount, setFromAmount] = useState('0.00');
  const [toAmount, setToAmount] = useState('0.00');
  const [showFromDropdown, setShowFromDropdown] = useState(false);
  const [showToDropdown, setShowToDropdown] = useState(false);

  const handleBack = () => {
    router.back();
  };

  const handleSettings = () => {
    router.push('/wallet/settings');
  };

  const handleSwapTokens = () => {
    // Swap the tokens
    const tempToken = fromToken;
    const tempAmount = fromAmount;
    setFromToken(toToken);
    setToToken(tempToken);
    setFromAmount(toAmount);
    setToAmount(tempAmount);
  };

  const handleFromAmountChange = (text: string) => {
    setFromAmount(text);
    // Calculate the to amount based on exchange rate
    const numAmount = parseFloat(text) || 0;
    if (fromToken === 'SOL' && toToken === 'USDC') {
      setToAmount((numAmount * EXCHANGE_RATE).toFixed(2));
    } else if (fromToken === 'USDC' && toToken === 'SOL') {
      setToAmount((numAmount / EXCHANGE_RATE).toFixed(2));
    }
  };

  const handleMaxAmount = () => {
    const balance = TOKEN_BALANCES[fromToken];
    setFromAmount(balance.toString());
    handleFromAmountChange(balance.toString());
  };

  const handleSwap = () => {
    if (!fromAmount || parseFloat(fromAmount) <= 0) {
      Alert.alert('Error', 'Please enter a valid amount');
      return;
    }
    Alert.alert('Swap', `Swapping ${fromAmount} ${fromToken} for ${toAmount} ${toToken}`);
  };

  const getTokenIcon = (token: TokenType, size: number = 24) => {
    switch (token) {
      case 'SOL':
        return <SolanaIcon size={size} />;
      case 'USDC':
        return <USDCIcon size={size} />;
      default:
        return null;
    }
  };

  return (
    <LinearGradient
      colors={['#0D0D0D', '#06181B', '#072B31']}
      locations={[0, 0.94, 1]}
      start={{ x: 0.2125, y: 0 }}
      end={{ x: 0.7875, y: 1 }}
      style={styles.container}
    >
      <SafeAreaView style={styles.safeArea}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={handleBack} style={styles.backButton}>
            <Text style={styles.backIcon}>‹</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Swap</Text>
          <TouchableOpacity style={styles.settingsButton} onPress={handleSettings}>
            <View style={styles.settingsIcon}>
              <SettingsIcon />
            </View>
          </TouchableOpacity>
        </View>

        {/* Solana Network Badge */}
          {/* Network Badge */}
          <View style={styles.networkBadge}>
            <View style={styles.networkIcon}>
              <SolanaIcon size={16} color='#22D3EE' />
            </View>
            <Text style={styles.networkText}>Solana Network</Text>
          </View>

        <ScrollView 
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* From Token Card */}
          <View style={styles.tokenCard}>
            <TouchableOpacity 
              style={styles.tokenSelector}
              onPress={() => setShowFromDropdown(!showFromDropdown)}
            >
              {getTokenIcon(fromToken, 24)}
              <Text style={styles.tokenText}>{fromToken}</Text>
              <Text style={styles.dropdownArrow}>▼</Text>
            </TouchableOpacity>

            <TextInput
              style={styles.amountInput}
              value={fromAmount}
              onChangeText={handleFromAmountChange}
              placeholder="0.00"
              placeholderTextColor="#4a5555"
              keyboardType="decimal-pad"
            />

            <View style={styles.balanceRow}>
              <Text style={styles.balanceLabel}>Balance:</Text>
              <Text style={styles.balanceAmount}>
                {TOKEN_BALANCES[fromToken]} {fromToken}
              </Text>
              <TouchableOpacity onPress={handleMaxAmount}>
                <Text style={styles.maxButton}>(Max)</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.usdValue}>+$ {(parseFloat(fromAmount) * (fromToken === 'SOL' ? EXCHANGE_RATE : 1)).toFixed(4)}</Text>
          </View>

          {/* Swap Button */}
          <TouchableOpacity 
            style={styles.swapIconButton}
            onPress={handleSwapTokens}
          >
            <Text style={styles.swapIconText}>⇅</Text>
          </TouchableOpacity>

          {/* To Token Card */}
          <View style={styles.tokenCard}>
            <TouchableOpacity 
              style={styles.tokenSelector}
              onPress={() => setShowToDropdown(!showToDropdown)}
            >
              {getTokenIcon(toToken, 24)}
              <Text style={styles.tokenText}>{toToken}</Text>
              <Text style={styles.dropdownArrow}>▼</Text>
            </TouchableOpacity>

            <TextInput
              style={styles.amountInput}
              value={toAmount}
              placeholder="0.00"
              placeholderTextColor="#4a5555"
              keyboardType="decimal-pad"
              editable={false}
            />

            <View style={styles.balanceRow}>
              <Text style={styles.balanceLabel}>Balance:</Text>
              <Text style={styles.balanceAmount}>
                {TOKEN_BALANCES[toToken]} {toToken}
              </Text>
              <TouchableOpacity>
                <Text style={styles.maxButton}>(Max)</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.usdValue}>+$ {(parseFloat(toAmount) * (toToken === 'SOL' ? EXCHANGE_RATE : 1)).toFixed(4)}</Text>
          </View>

          {/* Exchange Rate */}
          <Text style={styles.exchangeRate}>
            1 SOL = {EXCHANGE_RATE} USDC
          </Text>

          {/* Swap Button */}
          <TouchableOpacity style={styles.swapButton} onPress={handleSwap}>
            <Text style={styles.swapButtonText}>Swap</Text>
          </TouchableOpacity>

          {/* Connectivity Status */}
          <View style={styles.connectivityBanner}>
            <View style={styles.statusDot} />
            <Text style={styles.connectivityText}>Connected to Internet</Text>
          </View>
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1a4444',
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backIcon: {
    fontSize: 32,
    color: '#22D3EE',
    fontWeight: '300',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  settingsButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  settingsIcon: {
    gap: 4,
  },
  settingsLine: {
    width: 20,
    height: 2,
    backgroundColor: '#22D3EE',
    borderRadius: 1,
  },
  networkBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(34, 211, 238, 0.1)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    marginHorizontal: 20,
    marginTop: 16,
    marginBottom: 8,
  },
  networkIcon: {
    width: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  networkText: {
    color: '#22D3EE',
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 8,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 24,
  },
  tokenCard: {
    backgroundColor: '#0d3333',
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#22D3EE',
    padding: 16,
  },
  tokenSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0d4d4d',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    alignSelf: 'flex-start',
    gap: 6,
  },
  tokenText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  dropdownArrow: {
    fontSize: 10,
    color: '#22D3EE',
    marginLeft: 4,
  },
  amountInput: {
    fontSize: 48,
    fontWeight: '300',
    color: '#FFFFFF',
    textAlign: 'right',
    marginTop: 16,
    marginBottom: 8,
  },
  balanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  balanceLabel: {
    fontSize: 14,
    color: '#8a9999',
    fontWeight: '400',
  },
  balanceAmount: {
    fontSize: 14,
    color: '#8a9999',
    fontWeight: '600',
    marginLeft: 4,
  },
  maxButton: {
    fontSize: 14,
    color: '#22D3EE',
    fontWeight: '600',
    marginLeft: 4,
  },
  usdValue: {
    fontSize: 16,
    color: '#22D3EE',
    fontWeight: '500',
  },
  swapIconButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#22D3EE',
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'center',
    marginVertical: 16,
  },
  swapIconText: {
    fontSize: 24,
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  exchangeRate: {
    fontSize: 14,
    color: '#8a9999',
    textAlign: 'right',
    marginTop: 16,
    marginBottom: 24,
  },
  swapButton: {
    backgroundColor: 'transparent',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#22D3EE',
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 16,
  },
  swapButtonText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  connectivityBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#22D3EE',
    marginRight: 8,
  },
  connectivityText: {
    fontSize: 14,
    color: '#22D3EE',
    fontWeight: '500',
  },
});

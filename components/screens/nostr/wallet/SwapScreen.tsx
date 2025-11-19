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
  const [fromAmount, setFromAmount] = useState('');
  const [toAmount, setToAmount] = useState('');
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
      setToAmount((numAmount * EXCHANGE_RATE).toFixed(4));
    } else if (fromToken === 'USDC' && toToken === 'SOL') {
      setToAmount((numAmount / EXCHANGE_RATE).toFixed(4));
    } else {
      setToAmount('0.00');
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
        return <SolanaIcon size={size} color="#14F195" />;
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

        {/* Network Badge */}
        <View style={styles.networkContainer}>
          <View style={styles.networkBadge}>
            <View style={styles.networkIconWrapper}>
              <SolanaIcon size={18} color='#22D3EE' />
            </View>
            <Text style={styles.networkText}>Solana Network</Text>
          </View>
        </View>

        <ScrollView 
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* From Token Card */}
          <View style={styles.tokenCard}>
            <View style={styles.cardHeader}>
              <TouchableOpacity 
                style={styles.tokenSelector}
                onPress={() => setShowFromDropdown(!showFromDropdown)}
              >
                {getTokenIcon(fromToken, 20)}
                <Text style={styles.tokenText}>{fromToken}</Text>
                <Text style={styles.dropdownArrow}>▼</Text>
              </TouchableOpacity>
            </View>

            <TextInput
              style={styles.amountInput}
              value={fromAmount}
              onChangeText={handleFromAmountChange}
              placeholder="0.00"
              placeholderTextColor="#3a5555"
              keyboardType="decimal-pad"
            />

            <View style={styles.bottomRow}>
              <View style={styles.balanceRow}>
                <Text style={styles.balanceLabel}>Balance: </Text>
                <Text style={styles.balanceAmount}>
                  {TOKEN_BALANCES[fromToken]} {fromToken}
                </Text>
                <TouchableOpacity onPress={handleMaxAmount}>
                  <Text style={styles.maxButton}> (Max)</Text>
                </TouchableOpacity>
              </View>
              <Text style={styles.usdValue}>
                +$ {(TOKEN_BALANCES[fromToken] * (fromToken === 'SOL' ? EXCHANGE_RATE : 1)).toFixed(4)}
              </Text>
            </View>
          </View>

          {/* Swap Icon Button */}
          <TouchableOpacity 
            style={styles.swapIconButton}
            onPress={handleSwapTokens}
          >
            <View style={styles.swapArrowUp} />
            <View style={styles.swapArrowDown} />
          </TouchableOpacity>

          {/* To Token Card */}
          <View style={styles.tokenCard}>
            <View style={styles.cardHeader}>
              <TouchableOpacity 
                style={styles.tokenSelector}
                onPress={() => setShowToDropdown(!showToDropdown)}
              >
                {getTokenIcon(toToken, 20)}
                <Text style={styles.tokenText}>{toToken}</Text>
                <Text style={styles.dropdownArrow}>▼</Text>
              </TouchableOpacity>
            </View>

            <TextInput
              style={styles.amountInput}
              value={toAmount}
              placeholder="0.00"
              placeholderTextColor="#3a5555"
              keyboardType="decimal-pad"
              editable={false}
            />

            <View style={styles.bottomRow}>
              <View style={styles.balanceRow}>
                <Text style={styles.balanceLabel}>Balance: </Text>
                <Text style={styles.balanceAmount}>
                  {TOKEN_BALANCES[toToken]} {toToken}
                </Text>
              </View>
              <Text style={styles.usdValue}>
                +$ {(TOKEN_BALANCES[toToken] * (toToken === 'SOL' ? EXCHANGE_RATE : 1)).toFixed(4)}
              </Text>
            </View>
          </View>

          {/* Exchange Rate */}
          <Text style={styles.exchangeRate}>
            1 SOL = {EXCHANGE_RATE.toFixed(3)} USDC
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
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(34, 211, 238, 0.2)',
  },
  backButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  backIcon: {
    fontSize: 36,
    color: '#22D3EE',
    fontWeight: '200',
    marginLeft: -4,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '500',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  settingsButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'flex-end',
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
  networkContainer: {
    alignItems: 'center',
    paddingVertical: 18,
  },
  networkBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'transparent',
    paddingHorizontal: 0,
    paddingVertical: 0,
  },
  networkIconWrapper: {
    width: 18,
    height: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  networkText: {
    color: '#8a9999',
    fontSize: 14,
    fontWeight: '400',
    letterSpacing: 0.3,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 18,
    paddingTop: 8,
    paddingBottom: 32,
  },
  tokenCard: {
    backgroundColor: 'rgba(6, 45, 45, 0.8)',
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: 'rgba(34, 211, 238, 0.25)',
    padding: 18,
  },
  cardHeader: {
    marginBottom: 4,
  },
  tokenSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(8, 60, 60, 0.9)',
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 20,
    alignSelf: 'flex-start',
    gap: 6,
  },
  tokenText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
    letterSpacing: 0.2,
  },
  dropdownArrow: {
    fontSize: 8,
    color: '#22D3EE',
    marginLeft: 2,
    marginTop: 1,
  },
  amountInput: {
    fontSize: 56,
    fontWeight: '200',
    color: '#FFFFFF',
    textAlign: 'right',
    marginTop: 18,
    marginBottom: 10,
    letterSpacing: -2,
    minHeight: 70,
  },
  bottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  balanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  balanceLabel: {
    fontSize: 12,
    color: '#6a8989',
    fontWeight: '400',
  },
  balanceAmount: {
    fontSize: 12,
    color: '#FFFFFF',
    fontWeight: '500',
  },
  maxButton: {
    fontSize: 12,
    color: '#22D3EE',
    fontWeight: '500',
  },
  usdValue: {
    fontSize: 14,
    color: '#22D3EE',
    fontWeight: '400',
  },
  swapIconButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#22D3EE',
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'center',
    marginVertical: 18,
    shadowColor: '#22D3EE',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
    elevation: 5,
  },
  swapArrowUp: {
    width: 0,
    height: 0,
    backgroundColor: 'transparent',
    borderStyle: 'solid',
    borderLeftWidth: 6,
    borderRightWidth: 6,
    borderBottomWidth: 9,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderBottomColor: '#0A2020',
    marginBottom: 1.5,
  },
  swapArrowDown: {
    width: 0,
    height: 0,
    backgroundColor: 'transparent',
    borderStyle: 'solid',
    borderLeftWidth: 6,
    borderRightWidth: 6,
    borderTopWidth: 9,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: '#0A2020',
    marginTop: 1.5,
  },
  exchangeRate: {
    fontSize: 12,
    color: '#6a8989',
    textAlign: 'right',
    marginTop: 18,
    marginBottom: 24,
    fontWeight: '400',
  },
  swapButton: {
    backgroundColor: 'transparent',
    borderRadius: 14,
    borderWidth: 2,
    borderColor: '#22D3EE',
    paddingVertical: 17,
    alignItems: 'center',
    marginBottom: 18,
  },
  swapButtonText: {
    fontSize: 19,
    fontWeight: '500',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  connectivityBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#22D3EE',
    marginRight: 8,
  },
  connectivityText: {
    fontSize: 13,
    color: '#22D3EE',
    fontWeight: '400',
  },
});

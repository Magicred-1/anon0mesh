import SolanaIcon from '@/components/icons/SolanaIcon';
import USDCIcon from '@/components/icons/USDCIcon';
import SwapConfirmationModal from '@/components/modals/SwapConfirmationModal';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { ArrowsDownUp, CaretDown, CaretLeft, CaretUp, SlidersHorizontal } from 'phosphor-react-native';
import React, { useState } from 'react';
import {
  Alert,
  Image,
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
  const [showSwapModal, setShowSwapModal] = useState(false);

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

  const handleSelectFromToken = (selectedToken: TokenType) => {
    setFromToken(selectedToken);
    setShowFromDropdown(false);
    // Recalculate to amount if from amount is set
    if (fromAmount) {
      handleFromAmountChange(fromAmount);
    }
  };

  const handleSelectToToken = (selectedToken: TokenType) => {
    setToToken(selectedToken);
    setShowToDropdown(false);
    // Recalculate to amount if from amount is set
    if (fromAmount) {
      handleFromAmountChange(fromAmount);
    }
  };

  const handleSwap = () => {
    if (!fromAmount || parseFloat(fromAmount) <= 0) {
      Alert.alert('Error', 'Please enter a valid amount');
      return;
    }
    setShowSwapModal(true);
  };

  const handleConfirmSwap = () => {
    // TODO: Implement swap logic
    console.log('Swapping', fromAmount, fromToken, 'for', toAmount, toToken);
    setShowSwapModal(false);
    // Reset form or show success
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
            <CaretLeft size={24} color="#22D3EE" weight="regular" />
            <Text style={styles.headerTitle}>Swap</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.settingsButton} onPress={handleSettings}>
            <SlidersHorizontal size={24} color="#fff" weight="regular" />
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
          {/* Cards Container with Swap Button */}
          <View style={styles.cardsContainer}>
            {/* From Token Card */}
            <View style={styles.amountCard}>
              <View style={styles.amountCardHeader}>
                <View style={styles.tokenSelectorContainer}>
                  <TouchableOpacity 
                    style={styles.tokenSelector}
                    onPress={() => setShowFromDropdown(!showFromDropdown)}
                  >
                    <View style={styles.tokenIconWrapper}>
                      {fromToken === 'SOL' && (
                        <Image 
                          source={require('../../../../assets/images/sol-logo.png')} 
                          style={styles.tokenImage} 
                        />
                      )}
                      {fromToken === 'USDC' && <USDCIcon size={24} />}
                    </View>
                    <Text style={styles.tokenText}>{fromToken}</Text>
                    {showFromDropdown ? (
                      <CaretUp size={20} color="#22D3EE" weight="regular" />
                    ) : (
                      <CaretDown size={20} color="#22D3EE" weight="regular" />
                    )}
                  </TouchableOpacity>

                  {/* Token Dropdown */}
                  {showFromDropdown && (
                    <View style={styles.tokenDropdown}>
                      {(['SOL', 'USDC'] as TokenType[])
                        .filter((t) => t !== fromToken)
                        .map((t, index) => (
                          <TouchableOpacity
                            key={t}
                            style={[
                              styles.tokenOption,
                              index === 0 && styles.tokenOptionFirst
                            ]}
                            onPress={() => handleSelectFromToken(t)}
                          >
                            <View style={styles.tokenIconWrapper}>
                              {t === 'SOL' && (
                                <Image 
                                  source={require('../../../../assets/images/sol-logo.png')} 
                                  style={styles.tokenImage} 
                                />
                              )}
                              {t === 'USDC' && <USDCIcon size={24} />}
                            </View>
                            <Text style={styles.tokenOptionText}>{t}</Text>
                          </TouchableOpacity>
                        ))}
                    </View>
                  )}
                </View>

                <TextInput
                  style={styles.amountInput}
                  value={fromAmount}
                  onChangeText={handleFromAmountChange}
                  keyboardType="decimal-pad"
                  placeholder="0.00"
                  placeholderTextColor="#4a6c6c"
                />
              </View>

              <View style={styles.balanceRow}>
                <View style={styles.balanceLeft}>
                  <Text style={styles.balanceLabel}>Balance:</Text>
                  <Text style={styles.balanceAmount}>
                    {TOKEN_BALANCES[fromToken]} {fromToken}
                  </Text>
                  <TouchableOpacity onPress={handleMaxAmount}>
                    <Text style={styles.maxLabel}>(Max)</Text>
                  </TouchableOpacity>
                </View>
                <Text style={styles.usdValue}>
                  ≈${' '}
                  {(TOKEN_BALANCES[fromToken] * (fromToken === 'SOL' ? EXCHANGE_RATE : 1)).toFixed(2)}
                </Text>
              </View>
            </View>

            {/* Swap Icon Button */}
            <TouchableOpacity 
              style={styles.swapIconButton}
              onPress={handleSwapTokens}
            >
              <ArrowsDownUp size={24} color="#22D3EE" weight="regular" />
            </TouchableOpacity>

            {/* To Token Card */}
            <View style={styles.amountCard}>
            <View style={styles.amountCardHeader}>
              <View style={styles.tokenSelectorContainer}>
                <TouchableOpacity 
                  style={styles.tokenSelector}
                  onPress={() => setShowToDropdown(!showToDropdown)}
                >
                  <View style={styles.tokenIconWrapper}>
                    {toToken === 'SOL' && (
                      <Image 
                        source={require('../../../../assets/images/sol-logo.png')} 
                        style={styles.tokenImage} 
                      />
                    )}
                    {toToken === 'USDC' && <USDCIcon size={24} />}
                  </View>
                  <Text style={styles.tokenText}>{toToken}</Text>
                  {showToDropdown ? (
                    <CaretUp size={20} color="#22D3EE" weight="regular" />
                  ) : (
                    <CaretDown size={20} color="#22D3EE" weight="regular" />
                  )}
                </TouchableOpacity>

                {/* Token Dropdown */}
                {showToDropdown && (
                  <View style={styles.tokenDropdown}>
                    {(['SOL', 'USDC'] as TokenType[])
                      .filter((t) => t !== toToken)
                      .map((t, index) => (
                        <TouchableOpacity
                          key={t}
                          style={[
                            styles.tokenOption,
                            index === 0 && styles.tokenOptionFirst
                          ]}
                          onPress={() => handleSelectToToken(t)}
                        >
                          <View style={styles.tokenIconWrapper}>
                            {t === 'SOL' && (
                              <Image 
                                source={require('../../../../assets/images/sol-logo.png')} 
                                style={styles.tokenImage} 
                              />
                            )}
                            {t === 'USDC' && <USDCIcon size={24} />}
                          </View>
                          <Text style={styles.tokenOptionText}>{t}</Text>
                        </TouchableOpacity>
                      ))}
                  </View>
                )}
              </View>

              <TextInput
                style={styles.amountInput}
                value={toAmount}
                placeholder="0.00"
                placeholderTextColor="#4a6c6c"
                keyboardType="decimal-pad"
                editable={false}
              />
            </View>

            <View style={styles.balanceRow}>
              <View style={styles.balanceLeft}>
                <Text style={styles.balanceLabel}>Balance:</Text>
                <Text style={styles.balanceAmount}>
                  {TOKEN_BALANCES[toToken]} {toToken}
                </Text>
              </View>
              <Text style={styles.usdValue}>
                ≈${' '}
                {(TOKEN_BALANCES[toToken] * (toToken === 'SOL' ? EXCHANGE_RATE : 1)).toFixed(2)}
              </Text>
            </View>
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

      <SwapConfirmationModal
        visible={showSwapModal}
        onClose={() => setShowSwapModal(false)}
        onConfirm={handleConfirmSwap}
        fromToken={fromToken}
        toToken={toToken}
        fromAmount={fromAmount || '1.5'}
        toAmount={toAmount || '212.19'}
        exchangeRate={EXCHANGE_RATE}
      />
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
    borderBottomWidth: 2,
    borderBottomColor: '#22D3EE',
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  settingsButton: {
    padding: 4,
  },
  networkContainer: {
    alignItems: 'center',
    paddingVertical: 18,
  },
  networkBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    gap: 8,
  },
  networkIconWrapper: {
    width: 18,
    height: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  networkText: {
    fontSize: 16,
    color: '#9CA3AF',
    fontWeight: '500',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 24,
  },
  cardsContainer: {
    position: 'relative',
    gap: 10,
  },
  // Amount Card
  amountCard: {
    backgroundColor: '#072B31',
    borderRadius: 16,
    padding: 16,
    overflow: 'visible',
  },
  amountCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
    gap: 12,
  },
  tokenSelectorContainer: {
    position: 'relative',
    width: '40%',
    backgroundColor: '#106471',
    borderRadius: 12,
    overflow: 'visible',
  },
  tokenSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  tokenIconWrapper: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tokenImage: {
    width: 24,
    height: 24,
  },
  tokenText: {
    flex: 1,
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
  },
  amountInput: {
    color: '#fff',
    fontSize: 32,
    fontWeight: '600',
    textAlign: 'right',
    marginBottom: 8,
  },
  balanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  balanceLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  balanceLabel: {
    color: '#9CA3AF',
    fontSize: 14,
  },
  balanceAmount: {
    color: '#9CA3AF',
    fontSize: 14,
  },
  maxLabel: {
    color: '#9CA3AF',
    fontSize: 14,
  },
  usdValue: {
    color: '#9CA3AF',
    fontSize: 14,
  },
  // Token Dropdown
  tokenDropdown: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    backgroundColor: '#106471',
    borderRadius: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(34, 211, 238, 0.3)',
    marginTop: 4,
    zIndex: 100,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  tokenOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(34, 211, 238, 0.2)',
  },
  tokenOptionFirst: {
    borderTopWidth: 0,
  },
  tokenOptionText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
  },
  swapIconButton: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: [{ translateX: -25 }, { translateY: -25 }],
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#072B31',
    borderWidth: 6,
    borderColor: '#0D0D0D',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
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
    backgroundColor: '#0C2425',
    borderRadius: 14,
    borderWidth: 2,
    borderColor: '#22D3EE',
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 18,
    marginTop: 30,
  },
  swapButtonText: {
    fontSize: 20,
    fontWeight: '500',
    color: '#FFFFFF',
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

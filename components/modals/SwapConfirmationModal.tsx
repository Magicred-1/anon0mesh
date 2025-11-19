import { ArrowsDownUp } from 'phosphor-react-native';
import React from 'react';
import {
  Image,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import USDCIcon from '../icons/USDCIcon';

type TokenType = 'SOL' | 'USDC';

type Props = {
  visible: boolean;
  onClose: () => void;
  onConfirm: () => void;
  fromToken: TokenType;
  toToken: TokenType;
  fromAmount: string;
  toAmount: string;
  exchangeRate: number;
};

const SwapConfirmationModal = ({
  visible,
  onClose,
  onConfirm,
  fromToken,
  toToken,
  fromAmount,
  toAmount,
  exchangeRate,
}: Props) => {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <TouchableOpacity 
          style={styles.backdrop} 
          activeOpacity={1} 
          onPress={onClose}
        />
        <View style={styles.bottomSheet}>
          {/* Icon - Swap */}
          <View style={styles.iconContainer}>
            <View style={styles.icon}>
              <ArrowsDownUp size={48} color="#22D3EE" weight="regular" />
            </View>
          </View>

          {/* Title */}
          <Text style={styles.title}>
            Confirm Swap
          </Text>

          {/* Cards Container with Swap Button */}
          <View style={styles.cardsContainer}>
            {/* From Token Card */}
            <View style={styles.amountCard}>
              <View style={styles.amountCardHeader}>
                <View style={styles.tokenSelectorContainer}>
                  <View style={styles.tokenSelector}>
                    <View style={styles.tokenIconWrapper}>
                      {fromToken === 'SOL' && (
                        <Image 
                          source={require('../../assets/images/sol-logo.png')} 
                          style={styles.tokenImage} 
                        />
                      )}
                      {fromToken === 'USDC' && <USDCIcon size={24} />}
                    </View>
                    <Text style={styles.tokenText}>{fromToken}</Text>
                  </View>
                </View>

                <Text style={styles.amountInput}>{fromAmount}</Text>
              </View>
            </View>

            {/* Swap Icon Button */}
            <View style={styles.swapIconButton}>
              <ArrowsDownUp size={24} color="#22D3EE" weight="regular" />
            </View>

            {/* To Token Card */}
            <View style={styles.amountCard}>
              <View style={styles.amountCardHeader}>
                <View style={styles.tokenSelectorContainer}>
                  <View style={styles.tokenSelector}>
                    <View style={styles.tokenIconWrapper}>
                      {toToken === 'SOL' && (
                        <Image 
                          source={require('../../assets/images/sol-logo.png')} 
                          style={styles.tokenImage} 
                        />
                      )}
                      {toToken === 'USDC' && <USDCIcon size={24} />}
                    </View>
                    <Text style={styles.tokenText}>{toToken}</Text>
                  </View>
                </View>

                <Text style={styles.amountInput}>{toAmount}</Text>
              </View>
            </View>
          </View>

          {/* Exchange Rate */}
          <Text style={styles.exchangeRate}>
            1 {fromToken} = {exchangeRate.toFixed(3)} {toToken}
          </Text>

          {/* Buttons */}
          <View style={styles.buttonContainer}>
            <TouchableOpacity style={styles.cancelButton} onPress={onClose}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.confirmButton} onPress={onConfirm}>
              <Text style={styles.confirmText}>Confirm Swap</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
  },
  bottomSheet: {
    backgroundColor: '#041A1D',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: '#22D3EE',
    paddingHorizontal: 20,
    paddingTop: 40,
    paddingBottom: 40,
    alignItems: 'center',
  },
  iconContainer: {
    marginBottom: 24,
  },
  icon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#072B31',
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 22,
    fontWeight: '600',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 24,
  },
  cardsContainer: {
    position: 'relative',
    width: '100%',
    marginBottom: 10,
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
    gap: 12,
  },
  tokenSelectorContainer: {
    position: 'relative',
    width: '40%',
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
    width: 32,
    height: 32,
  },
  tokenText: {
    flex: 1,
    color: '#fff',
    fontSize: 20,
    fontWeight: '500',
  },
  amountInput: {
    color: '#fff',
    fontSize: 25,
    fontWeight: '600',
    textAlign: 'right',
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
    borderColor: '#041A1D',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  exchangeRate: {
    fontSize: 12,
    color: '#6a8989',
    textAlign: 'right',
    width: '100%',
    marginBottom: 32,
    fontWeight: '400',
  },
  buttonContainer: {
    width: '100%',
    flexDirection: 'row',
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    backgroundColor: 'transparent',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#22D3EE',
    paddingVertical: 12,
    alignItems: 'center',
  },
  cancelText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#22D3EE',
  },
  confirmButton: {
    flex: 1,
    backgroundColor: '#22D3EE',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  confirmText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#0D0D0D',
  },
});

export default SwapConfirmationModal;


import SolanaIcon from '@/components/icons/SolanaIcon';
import USDCIcon from '@/components/icons/USDCIcon';
import ZECIcon from '@/components/icons/ZECIcon';
import { SendCommandResult } from '@/src/utils/chatCommands';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useState } from 'react';
import {
    ActivityIndicator,
    Modal,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';

interface PaymentRequestModalProps {
  visible: boolean;
  command: SendCommandResult;
  onConfirm: (token: 'SOL' | 'USDC' | 'ZEC') => Promise<void>;
  onCancel: () => void;
}

export default function PaymentRequestModal({
  visible,
  command,
  onConfirm,
  onCancel,
}: PaymentRequestModalProps) {
  const [selectedToken, setSelectedToken] = useState<'SOL' | 'USDC' | 'ZEC'>(
    command.token === 'multi' ? 'SOL' : (command.token as 'SOL' | 'USDC' | 'ZEC')
  );
  const [isSending, setIsSending] = useState(false);

  const isMultiToken = command.token === 'multi';

  const handleConfirm = async () => {
    setIsSending(true);
    try {
      await onConfirm(selectedToken);
      onCancel(); // Close modal on success
    } catch (error) {
      console.error('[PaymentRequestModal] Send error:', error);
    } finally {
      setIsSending(false);
    }
  };

  const tokens: ('SOL' | 'USDC' | 'ZEC')[] = ['SOL', 'USDC', 'ZEC'];

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onCancel}
    >
      <View style={styles.overlay}>
        <LinearGradient
          colors={['#0D0D0D', '#06181B', '#072B31']}
          locations={[0, 0.94, 1]}
          start={{ x: 0.21, y: 0 }}
          end={{ x: 0.79, y: 1 }}
          style={styles.modalContainer}
        >
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Payment Request</Text>
            <TouchableOpacity onPress={onCancel} style={styles.closeButton}>
              <Text style={styles.closeIcon}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Payment Details */}
          <View style={styles.detailsContainer}>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>To:</Text>
              <Text style={styles.detailValue}>@{command.recipient}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Amount:</Text>
              <Text style={styles.amountValue}>{command.amount}</Text>
            </View>
          </View>

          {/* Token Selector (if multi) or Display (if specific) */}
          {isMultiToken ? (
            <View style={styles.tokenSelector}>
              <Text style={styles.selectorLabel}>Select Token:</Text>
              <View style={styles.tokenButtons}>
                {tokens.map((token) => (
                  <TouchableOpacity
                    key={token}
                    style={[
                      styles.tokenButton,
                      selectedToken === token && styles.tokenButtonSelected,
                    ]}
                    onPress={() => setSelectedToken(token)}
                    disabled={isSending}
                  >
                    <View style={styles.tokenIcon}>
                      {token === 'SOL' && <SolanaIcon size={32} color="#14F195" />}
                      {token === 'USDC' && <USDCIcon size={32} />}
                      {token === 'ZEC' && <ZECIcon size={32} />}
                    </View>
                    <Text style={styles.tokenButtonText}>{token}</Text>
                    {selectedToken === token && (
                      <View style={styles.selectedIndicator}>
                        <Text style={styles.selectedCheck}>✓</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          ) : (
            <View style={styles.singleTokenDisplay}>
              <View style={styles.tokenIcon}>
                {command.token === 'SOL' && <SolanaIcon size={48} color="#14F195" />}
                {command.token === 'USDC' && <USDCIcon size={48} />}
                {command.token === 'ZEC' && <ZECIcon size={48} />}
              </View>
              <Text style={styles.singleTokenText}>{command.token}</Text>
            </View>
          )}

          {/* Summary */}
          <View style={styles.summaryContainer}>
            <Text style={styles.summaryText}>
              You are about to send{' '}
              <Text style={styles.summaryHighlight}>
                {command.amount} {isMultiToken ? selectedToken : command.token}
              </Text>{' '}
              to{' '}
              <Text style={styles.summaryHighlight}>@{command.recipient}</Text>
            </Text>
          </View>

          {/* Action Buttons */}
          <View style={styles.actionButtons}>
            <TouchableOpacity
              style={[styles.button, styles.cancelButton]}
              onPress={onCancel}
              disabled={isSending}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.button, styles.confirmButton]}
              onPress={handleConfirm}
              disabled={isSending}
            >
              {isSending ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.confirmButtonText}>Send Payment</Text>
              )}
            </TouchableOpacity>
          </View>
        </LinearGradient>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContainer: {
    width: '100%',
    maxWidth: 400,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: '#22D3EE',
    padding: 24,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(34, 211, 238, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeIcon: {
    fontSize: 20,
    color: '#22D3EE',
  },
  detailsContainer: {
    backgroundColor: 'rgba(34, 211, 238, 0.05)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  detailLabel: {
    fontSize: 16,
    color: '#8a9999',
    fontWeight: '500',
  },
  detailValue: {
    fontSize: 16,
    color: '#22D3EE',
    fontWeight: '600',
  },
  amountValue: {
    fontSize: 24,
    color: '#FFFFFF',
    fontWeight: '700',
  },
  tokenSelector: {
    marginBottom: 20,
  },
  selectorLabel: {
    fontSize: 16,
    color: '#8a9999',
    fontWeight: '500',
    marginBottom: 12,
  },
  tokenButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  tokenButton: {
    flex: 1,
    backgroundColor: 'rgba(34, 211, 238, 0.05)',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#1a4444',
    padding: 16,
    alignItems: 'center',
    position: 'relative',
  },
  tokenButtonSelected: {
    borderColor: '#22D3EE',
    backgroundColor: 'rgba(34, 211, 238, 0.1)',
  },
  tokenIcon: {
    marginBottom: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tokenButtonText: {
    fontSize: 14,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  selectedIndicator: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#22D3EE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectedCheck: {
    fontSize: 14,
    color: '#0D0D0D',
    fontWeight: 'bold',
  },
  singleTokenDisplay: {
    alignItems: 'center',
    marginBottom: 20,
    padding: 20,
    backgroundColor: 'rgba(34, 211, 238, 0.05)',
    borderRadius: 12,
  },
  singleTokenText: {
    fontSize: 20,
    color: '#FFFFFF',
    fontWeight: '600',
    marginTop: 12,
  },
  summaryContainer: {
    backgroundColor: 'rgba(34, 211, 238, 0.05)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
  },
  summaryText: {
    fontSize: 15,
    color: '#8a9999',
    lineHeight: 22,
    textAlign: 'center',
  },
  summaryHighlight: {
    color: '#22D3EE',
    fontWeight: '600',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  button: {
    flex: 1,
    height: 50,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButton: {
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: '#4a5555',
  },
  cancelButtonText: {
    fontSize: 16,
    color: '#8a9999',
    fontWeight: '600',
  },
  confirmButton: {
    backgroundColor: '#22D3EE',
    borderWidth: 2,
    borderColor: '#22D3EE',
  },
  confirmButtonText: {
    fontSize: 16,
    color: '#0D0D0D',
    fontWeight: '700',
  },
});

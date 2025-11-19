import React from 'react';
import {
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import BluetoothIcon from '../icons/BluetoothIcon';
import InternetIcon from '../icons/InternetIcon';

type Props = {
  visible: boolean;
  onClose: () => void;
  isBluetooth?: boolean;
};

const SendConfirmationModal = ({ visible, onClose, isBluetooth = true }: Props) => {
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
          {/* Icon - Bluetooth or Internet */}
          <View style={styles.iconContainer}>
            <View style={styles.icon}>
              {isBluetooth ? (
                <BluetoothIcon size={48} />
              ) : (
                <Text style={styles.iconSymbol}>
                  <InternetIcon size={48} color="#FFFFFF" />
                </Text>
              )}
            </View>
          </View>

          {/* Success Message */}
          <Text style={styles.title}>
            {isBluetooth 
              ? 'Transaction sent over Bluetooth!' 
              : 'Transaction sent successfully!'}
          </Text>

          <Text style={styles.subtitle}>
            Wait for confirmation on the app.
          </Text>

          {/* Go Back Button */}
          <TouchableOpacity style={styles.goBackButton} onPress={onClose}>
            <Text style={styles.goBackText}>Go Back</Text>
          </TouchableOpacity>
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
    borderColor: '#22D3EE',
  },
  bottomSheet: {
    backgroundColor: '#041A1D',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: '#22D3EE',
    paddingHorizontal: 24,
    paddingTop: 40,
    paddingBottom: 40,
    alignItems: 'center',
    minHeight: 350,
  },
  iconContainer: {
    marginBottom: 28,
  },
  icon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#106471',
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconSymbol: {
    fontSize: 48,
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  title: {
    fontSize: 22,
    fontWeight: '600',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 12,
    paddingHorizontal: 20,
  },
  subtitle: {
    fontSize: 16,
    color: '#8a9999',
    textAlign: 'center',
    marginBottom: 40,
    paddingHorizontal: 20,
  },
  goBackButton: {
    width: '100%',
    backgroundColor: '#09454E',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  goBackText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});

export default SendConfirmationModal;

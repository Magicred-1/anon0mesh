import React from 'react';
import {
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import SolanaIcon from '../icons/SolanaIcon';

type Props = {
  visible: boolean;
  onClose: () => void;
  walletAddress?: string;
};

export default function SettingsModal({ visible, onClose, walletAddress }: Props) {
  const truncatedAddress = walletAddress
    ? `${walletAddress.slice(0, 10)}...${walletAddress.slice(-7)}`
    : 'JDijn6BQvh...DPQqUGU';

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Settings</Text>
            <TouchableOpacity onPress={onClose}>
              <Text style={styles.closeModal}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalBody}>
            <Text style={styles.walletTitle}>Disposable Address(es) (usable offline)</Text>
            <TouchableOpacity style={styles.addressDropdown}>
              <Text style={styles.addressText}>8nXFVo...bPP6kQyaS</Text>
              <Text style={styles.dropdownIcon}>▼</Text>
            </TouchableOpacity>

            <View style={styles.walletSection}>
              <View style={styles.walletHeader}>
                <View style={styles.menuButton}>
                  <SolanaIcon color='#fff'/>
                </View>
                <Text style={styles.walletTitle}>Primary Wallet</Text>
              </View>
              <TouchableOpacity style={styles.walletAddress}>
                <Text style={styles.walletAddressText}>{truncatedAddress}</Text>
                <View style={styles.copyIconSmall}>
                  <View style={styles.copyIconBack} />
                  <View style={styles.copyIconFront} />
                </View>
              </TouchableOpacity>
            </View>

            <TouchableOpacity style={styles.exportButton}>
              <Text style={styles.exportButtonText}>Export Private Key</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#0d2626',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 24,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1a3333',
  },
  modalTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '600',
  },
  closeModal: {
    color: '#7a9999',
    fontSize: 28,
  },
  modalBody: {
    paddingHorizontal: 24,
    paddingTop: 24,
  },
  sectionTitle: {
    color: '#7a9999',
    fontSize: 14,
    marginBottom: 12,
  },
  addressDropdown: {
    backgroundColor: '#0d4d4d',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#00d9ff',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    marginBottom: 24,
  },
  addressText: {
    color: '#fff',
    fontSize: 16,
  },
  dropdownIcon: {
    color: '#00d9ff',
    fontSize: 16,
  },
  walletSection: {
    marginBottom: 24,
  },
  walletHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  menuButton: {
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  menuLine: {
    height: 2,
    backgroundColor: '#00d9ff',
    borderRadius: 1,
  },
  walletTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
    marginLeft: 8,
  },
  walletAddress: {
    backgroundColor: '#0d4d4d',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#00d9ff',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  walletAddressText: {
    color: '#fff',
    fontSize: 16,
  },
  copyIconSmall: {
    width: 20,
    height: 20,
    position: 'relative',
  },
  copyIconBack: {
    position: 'absolute',
    top: 2,
    right: 0,
    width: 14,
    height: 14,
    borderWidth: 2,
    borderColor: '#00d9ff',
    borderRadius: 2,
  },
  copyIconFront: {
    position: 'absolute',
    bottom: 2,
    left: 0,
    width: 14,
    height: 14,
    backgroundColor: '#0d4d4d',
    borderWidth: 2,
    borderColor: '#00d9ff',
    borderRadius: 2,
  },
  exportButton: {
    backgroundColor: '#1a3333',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#00d9ff',
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 24,
  },
  exportButtonText: {
    color: '#00d9ff',
    fontSize: 16,
    fontWeight: '600',
  },
});

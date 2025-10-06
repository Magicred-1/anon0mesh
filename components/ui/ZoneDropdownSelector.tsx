import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { Channel } from '../../src/types/channels';

interface ZoneDropdownSelectorProps {
  channels: Channel[];
  currentChannel: Channel | null;
  onChannelSelect: (channel: Channel) => void;
}

export const ZoneDropdownSelector: React.FC<ZoneDropdownSelectorProps> = ({
  channels,
  currentChannel,
  onChannelSelect,
}) => {
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const zoneChannels = channels.filter(ch => ch.type === 'zone');

  const handleSelect = (channel: Channel) => {
    onChannelSelect(channel);
    setDropdownOpen(false);
  };

  return (
    <>
      {/* Dropdown Button */}
      <TouchableOpacity
        onPress={() => setDropdownOpen(true)}
        style={styles.dropdownButton}
        activeOpacity={0.7}
      >
        <Text style={styles.dropdownIcon}>
          {currentChannel?.icon || '📡'}
        </Text>
        <View style={styles.dropdownTextContainer}>
          <Text style={styles.dropdownLabel}>Mesh Zone</Text>
          <Text style={styles.dropdownValue} numberOfLines={1}>
            {currentChannel?.name || 'Select Zone'}
          </Text>
        </View>
        <Text style={styles.dropdownArrow}>▼</Text>
      </TouchableOpacity>

      {/* Dropdown Modal */}
      <Modal
        visible={dropdownOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setDropdownOpen(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setDropdownOpen(false)}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>📡 Select Mesh Zone</Text>
              <Text style={styles.modalSubtitle}>Self-Healing Network</Text>
            </View>

            <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
              {zoneChannels.map((channel) => {
                const isActive = currentChannel?.id === channel.id;
                
                return (
                  <TouchableOpacity
                    key={channel.id}
                    style={[
                      styles.zoneOption,
                      isActive && styles.zoneOptionActive,
                      { borderLeftColor: channel.colorCode || '#666' }
                    ]}
                    onPress={() => handleSelect(channel)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.zoneOptionLeft}>
                      <Text style={styles.zoneOptionIcon}>{channel.icon}</Text>
                      <View style={styles.zoneOptionInfo}>
                        <Text style={[styles.zoneOptionName, isActive && styles.zoneOptionNameActive]}>
                          {channel.name}
                        </Text>
                        <Text style={styles.zoneOptionDescription} numberOfLines={1}>
                          {channel.description}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.zoneOptionRight}>
                      <View style={styles.zoneStats}>
                        <Text style={styles.zoneStatLabel}>TTL</Text>
                        <Text style={styles.zoneStatValue}>{channel.ttl}</Text>
                      </View>
                      <View style={styles.zoneStats}>
                        <Text style={styles.zoneStatLabel}>Range</Text>
                        <Text style={styles.zoneStatValue}>
                          {channel.maxDistanceKm === Infinity ? '∞' : `${channel.maxDistanceKm}km`}
                        </Text>
                      </View>
                    </View>

                    {isActive && (
                      <View style={[styles.activeIndicator, { backgroundColor: channel.colorCode }]} />
                    )}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => setDropdownOpen(false)}
              activeOpacity={0.8}
            >
              <Text style={styles.closeButtonText}>Close</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  dropdownButton: {
    backgroundColor: '#2a2a2a',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#333333',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  dropdownIcon: {
    fontSize: 14,
    marginRight: 6,
  },
  dropdownTextContainer: {
    flex: 1,
  },
  dropdownLabel: {
    fontSize: 8,
    color: '#888888',
    fontWeight: '600',
    marginBottom: 1,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  dropdownValue: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 12,
    letterSpacing: -0.1,
  },
  dropdownArrow: {
    color: '#666666',
    fontSize: 10,
    marginLeft: 4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#1a1a1a',
    borderRadius: 20,
    width: '88%',
    maxHeight: '75%',
    borderWidth: 1,
    borderColor: '#2a2a2a',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
  modalHeader: {
    padding: 18,
    borderBottomWidth: 1,
    borderBottomColor: '#2a2a2a',
    backgroundColor: '#1f1f1f',
  },
  modalTitle: {
    fontSize: 19,
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: 4,
    letterSpacing: -0.3,
  },
  modalSubtitle: {
    fontSize: 11,
    color: '#999999',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  scrollView: {
    maxHeight: 420,
  },
  zoneOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#252525',
    borderLeftWidth: 3,
    backgroundColor: '#1a1a1a',
    position: 'relative',
  },
  zoneOptionActive: {
    backgroundColor: '#252525',
  },
  zoneOptionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  zoneOptionIcon: {
    fontSize: 22,
    marginRight: 10,
  },
  zoneOptionInfo: {
    flex: 1,
  },
  zoneOptionName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#d1d5db',
    marginBottom: 2,
    letterSpacing: -0.2,
  },
  zoneOptionNameActive: {
    color: '#ffffff',
  },
  zoneOptionDescription: {
    fontSize: 10,
    color: '#888888',
    letterSpacing: 0.1,
  },
  zoneOptionRight: {
    flexDirection: 'row',
    gap: 10,
    marginLeft: 10,
  },
  zoneStats: {
    alignItems: 'center',
    minWidth: 32,
  },
  zoneStatLabel: {
    fontSize: 8,
    color: '#666666',
    fontWeight: '700',
    marginBottom: 2,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  zoneStatValue: {
    fontSize: 12,
    color: '#e5e7eb',
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  activeIndicator: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 6,
    height: 6,
    borderRadius: 3,
    shadowColor: '#B10FF2',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 4,
    elevation: 3,
  },
  closeButton: {
    backgroundColor: '#B10FF280',
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderTopWidth: 1,
    borderTopColor: '#2a2a2a',
  },
  closeButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
});

export default ZoneDropdownSelector;

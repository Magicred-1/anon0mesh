import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { Channel } from '../../src/types/channels';

interface ZoneChannelSelectorProps {
  channels: Channel[];
  currentChannel: Channel | null;
  onChannelSelect: (channel: Channel) => void;
  visible?: boolean;
}

export const ZoneChannelSelector: React.FC<ZoneChannelSelectorProps> = ({
  channels,
  currentChannel,
  onChannelSelect,
  visible = true,
}) => {
  if (!visible) return null;

  const zoneChannels = channels.filter(ch => ch.type === 'zone');

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>📡 Mesh Zones</Text>
        <Text style={styles.headerSubtitle}>Self-Healing Network</Text>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {zoneChannels.map((channel) => {
          const isActive = currentChannel?.id === channel.id;
          
          return (
            <TouchableOpacity
              key={channel.id}
              style={[
                styles.zoneCard,
                isActive && styles.zoneCardActive,
                { borderLeftColor: channel.colorCode || '#666' }
              ]}
              onPress={() => onChannelSelect(channel)}
              activeOpacity={0.7}
            >
              {/* Zone Icon */}
              <Text style={styles.zoneIcon}>{channel.icon}</Text>
              
              {/* Zone Name */}
              <Text style={[styles.zoneName, isActive && styles.zoneNameActive]}>
                {channel.name}
              </Text>
              
              {/* Zone Info */}
              <View style={styles.zoneInfo}>
                <Text style={styles.zoneInfoText}>
                  TTL: {channel.ttl || 0} hops
                </Text>
                <Text style={styles.zoneInfoText}>
                  Priority: {channel.priority || 0}
                </Text>
              </View>

              {/* Distance Range */}
              <Text style={styles.zoneRange}>
                {channel.minDistanceKm === 0 
                  ? `0-${channel.maxDistanceKm}km`
                  : `${channel.minDistanceKm}-${channel.maxDistanceKm === Infinity ? '∞' : channel.maxDistanceKm}km`}
              </Text>

              {/* Active Indicator */}
              {isActive && (
                <View style={[styles.activeIndicator, { backgroundColor: channel.colorCode }]} />
              )}
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Current Zone Description */}
      {currentChannel && (
        <View style={styles.descriptionContainer}>
          <Text style={styles.descriptionText}>
            {currentChannel.description}
          </Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#1a1a1a',
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: 2,
  },
  headerSubtitle: {
    fontSize: 11,
    color: '#9ca3af',
    fontWeight: '500',
  },
  scrollContent: {
    paddingHorizontal: 12,
    paddingVertical: 12,
    gap: 12,
  },
  zoneCard: {
    backgroundColor: '#2a2a2a',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginHorizontal: 4,
    minWidth: 140,
    borderLeftWidth: 4,
    position: 'relative',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  zoneCardActive: {
    backgroundColor: '#374151',
    borderWidth: 2,
    borderColor: '#0084ff',
  },
  zoneIcon: {
    fontSize: 28,
    marginBottom: 6,
    textAlign: 'center',
  },
  zoneName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#e5e7eb',
    textAlign: 'center',
    marginBottom: 8,
  },
  zoneNameActive: {
    color: '#ffffff',
  },
  zoneInfo: {
    gap: 2,
    marginBottom: 6,
  },
  zoneInfoText: {
    fontSize: 10,
    color: '#9ca3af',
    textAlign: 'center',
    fontWeight: '500',
  },
  zoneRange: {
    fontSize: 11,
    color: '#6b7280',
    textAlign: 'center',
    fontWeight: '600',
    marginTop: 4,
  },
  activeIndicator: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  descriptionContainer: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#0f0f0f',
  },
  descriptionText: {
    fontSize: 12,
    color: '#9ca3af',
    textAlign: 'center',
    lineHeight: 16,
  },
});

export default ZoneChannelSelector;

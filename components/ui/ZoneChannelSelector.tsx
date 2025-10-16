import React from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
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
    backgroundColor: '#0a0a0a',
    borderBottomWidth: 2,
    borderBottomColor: '#26C6DA',
    paddingTop: 8,
    paddingBottom: 4,
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 4,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 2,
    fontFamily: 'monospace',
    letterSpacing: 1.2,
    textShadowColor: '#26C6DA',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 6,
    textTransform: 'uppercase',
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#26C6DA',
    fontWeight: '600',
    fontFamily: 'monospace',
    letterSpacing: 1.1,
    marginBottom: 2,
  },
  scrollContent: {
    paddingHorizontal: 12,
    paddingVertical: 12,
    gap: 16,
  },
  zoneCard: {
    backgroundColor: '#111',
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 18,
    marginHorizontal: 4,
    minWidth: 150,
    borderLeftWidth: 4,
    borderLeftColor: '#26C6DA',
    borderWidth: 1.5,
    borderColor: '#26C6DA',
    position: 'relative',
    shadowColor: '#26C6DA',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
    elevation: 7,
    overflow: 'hidden',
    opacity: 0.95,
  },
  zoneCardActive: {
    backgroundColor: '#181c1f',
    borderWidth: 2.5,
    borderColor: '#26C6DA',
    shadowColor: '#26C6DA',
    shadowOpacity: 0.7,
    opacity: 1,
  },
  zoneIcon: {
    fontSize: 32,
    marginBottom: 6,
    textAlign: 'center',
    color: '#26C6DA',
    textShadowColor: '#26C6DA',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 8,
  },
  zoneName: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#26C6DA',
    textAlign: 'center',
    marginBottom: 8,
    fontFamily: 'monospace',
    letterSpacing: 1.1,
    textTransform: 'uppercase',
  },
  zoneNameActive: {
    color: '#fff',
    textShadowColor: '#26C6DA',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 8,
  },
  zoneInfo: {
    gap: 2,
    marginBottom: 6,
    alignItems: 'center',
  },
  zoneInfoText: {
    fontSize: 11,
    color: '#26C6DA',
    textAlign: 'center',
    fontWeight: '600',
    fontFamily: 'monospace',
  },
  zoneRange: {
    fontSize: 12,
    color: '#26C6DA',
    textAlign: 'center',
    fontWeight: 'bold',
    marginTop: 4,
    fontFamily: 'monospace',
    letterSpacing: 1.1,
  },
  activeIndicator: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: '#26C6DA',
    backgroundColor: '#26C6DA',
    shadowColor: '#26C6DA',
    shadowOpacity: 0.7,
    shadowRadius: 6,
  },
  descriptionContainer: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#111',
    borderTopWidth: 1.5,
    borderTopColor: '#26C6DA',
    marginTop: 6,
  },
  descriptionText: {
    fontSize: 13,
    color: '#26C6DA',
    textAlign: 'center',
    lineHeight: 18,
    fontFamily: 'monospace',
    letterSpacing: 1.1,
  },
});

export default ZoneChannelSelector;

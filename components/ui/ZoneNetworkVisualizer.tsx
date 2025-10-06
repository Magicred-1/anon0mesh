import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface ZoneNetworkVisualizerProps {
  connectedDevices: number;
  currentZone: string;
  visible?: boolean;
}

export const ZoneNetworkVisualizer: React.FC<ZoneNetworkVisualizerProps> = ({
  connectedDevices,
  currentZone,
  visible = true,
}) => {
  if (!visible) return null;

  const getZoneEmoji = (zone: string): string => {
    if (zone.includes('local')) return '📍';
    if (zone.includes('neighborhood')) return '🏘️';
    if (zone.includes('city')) return '🏙️';
    if (zone.includes('regional')) return '🗺️';
    if (zone.includes('national')) return '🌐';
    if (zone.includes('global')) return '🌍';
    return '📡';
  };

  return (
    <View style={styles.container}>
      <View style={styles.meshDiagram}>
        {/* Center node (you) */}
        <View style={styles.centerNode}>
          <Text style={styles.nodeText}>YOU</Text>
        </View>

        {/* Connected nodes in a circle */}
        {Array.from({ length: Math.min(connectedDevices, 6) }).map((_, index) => {
          const angle = (index * 360) / Math.min(connectedDevices, 6);
          const radius = 40;
          const x = Math.cos((angle * Math.PI) / 180) * radius;
          const y = Math.sin((angle * Math.PI) / 180) * radius;

          return (
            <View
              key={index}
              style={[
                styles.peerNode,
                {
                  transform: [{ translateX: x }, { translateY: y }],
                },
              ]}
            >
              <Text style={styles.peerNodeText}>•</Text>
            </View>
          );
        })}
      </View>

      {/* Network info */}
      <View style={styles.info}>
        <Text style={styles.infoText}>
          {getZoneEmoji(currentZone)} {connectedDevices} {connectedDevices === 1 ? 'peer' : 'peers'}
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
  },
  meshDiagram: {
    width: 120,
    height: 120,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  centerNode: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#B10FF2',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#B10FF2',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
    elevation: 5,
  },
  nodeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
  },
  peerNode: {
    position: 'absolute',
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#10b981',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#10b981',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 5,
    elevation: 3,
  },
  peerNodeText: {
    color: '#fff',
    fontSize: 16,
    lineHeight: 16,
  },
  info: {
    marginTop: 12,
  },
  infoText: {
    fontSize: 12,
    color: '#9ca3af',
    fontWeight: '600',
  },
});

export default ZoneNetworkVisualizer;

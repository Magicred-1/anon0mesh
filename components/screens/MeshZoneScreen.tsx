import { LinearGradient } from 'expo-linear-gradient';
import React, { useState } from 'react';
import {
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import BottomNavWithMenu from '../ui/BottomNavWithMenu';

type ZoneType = 'local' | 'neighborhood' | 'city' | 'regional' | 'national' | 'global';

interface Zone {
  id: string;
  type: ZoneType;
  label: string;
  range: string;
  icon: string;
}

interface CustomZone {
  id: string;
  name: string;
  range: string;
}

const PRESET_ZONES: Zone[] = [
  { id: 'local', type: 'local', label: 'Local', range: '100m', icon: '📍' },
  { id: 'neighborhood', type: 'neighborhood', label: 'Neighborhood', range: '10km', icon: '🏠' },
  { id: 'city', type: 'city', label: 'City', range: '100km', icon: '🏙️' },
  { id: 'regional', type: 'regional', label: 'Regional', range: '1 000km', icon: '👥' },
  { id: 'national', type: 'national', label: 'National', range: '5 000km', icon: '📖' },
  { id: 'global', type: 'global', label: 'Global', range: '', icon: '🌐' },
];

const MOCK_CUSTOM_ZONES: CustomZone[] = [
  { id: 'custom1', name: 'MyCustomZone #123456', range: '100m' },
  { id: 'custom2', name: 'MyCustomZone #123456', range: '100m' },
];

interface MeshZoneScreenProps {
  onNavigateToMessages?: () => void;
  onNavigateToWallet?: () => void;
  onNavigateToHistory?: () => void;
  onNavigateToMeshZone?: () => void;
  onNavigateToProfile?: () => void;
  onDisconnect?: () => void;
  onCreateZone?: () => void;
}

export default function MeshZoneScreen({
  onNavigateToMessages,
  onNavigateToWallet,
  onNavigateToHistory,
  onNavigateToMeshZone,
  onNavigateToProfile,
  onDisconnect,
  onCreateZone,
}: MeshZoneScreenProps) {
  const [selectedZone, setSelectedZone] = useState<string>('local');
  const [customZones] = useState<CustomZone[]>(MOCK_CUSTOM_ZONES);

  const handleZoneSelect = (zoneId: string) => {
    setSelectedZone(zoneId);
    console.log('Selected zone:', zoneId);
  };

  const handleCreateZone = () => {
    if (onCreateZone) {
      onCreateZone();
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
          <Text style={styles.headerTitle}>Mesh Zone</Text>
        </View>

        <ScrollView 
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Section: Select your Mesh Zone */}
          <Text style={styles.sectionTitle}>Select your Mesh Zone</Text>

          <View style={styles.zonesContainer}>
            {PRESET_ZONES.map((zone) => {
              const isSelected = selectedZone === zone.id;
              
              return (
                <TouchableOpacity
                  key={zone.id}
                  style={[
                    styles.zoneButton,
                    isSelected && styles.zoneButtonSelected,
                  ]}
                  onPress={() => handleZoneSelect(zone.id)}
                  activeOpacity={0.7}
                >
                  <View style={styles.zoneContent}>
                    <Text style={styles.zoneIcon}>{zone.icon}</Text>
                    <View style={styles.zoneTextContainer}>
                      <Text style={styles.zoneLabel}>{zone.label}</Text>
                    </View>
                    {zone.range && (
                      <Text style={styles.zoneRange}>{zone.range}</Text>
                    )}
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Section: Custom Mesh Zone */}
          <Text style={styles.customSectionTitle}>Custom Mesh Zone</Text>

          <View style={styles.zonesContainer}>
            {customZones.map((customZone, index) => {
              const isFirst = index === 0;
              
              return (
                <TouchableOpacity
                  key={customZone.id}
                  style={[
                    styles.zoneButton,
                    isFirst ? styles.customZoneButton : styles.customZoneButtonDim,
                  ]}
                  onPress={() => handleZoneSelect(customZone.id)}
                  activeOpacity={0.7}
                >
                  <View style={styles.zoneContent}>
                    <Text style={[
                      styles.zoneIcon,
                      !isFirst && styles.dimIcon,
                    ]}>
                      #
                    </Text>
                    <View style={styles.zoneTextContainer}>
                      <Text style={[
                        styles.zoneLabel,
                        !isFirst && styles.dimText,
                      ]}>
                        {customZone.name}
                      </Text>
                    </View>
                    <Text style={[
                      styles.zoneRange,
                      !isFirst && styles.dimText,
                    ]}>
                      {customZone.range}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })}

            {/* Create New Zone Button */}
            <TouchableOpacity 
              style={styles.createButton}
              onPress={handleCreateZone}
              activeOpacity={0.7}
            >
              <Text style={styles.createButtonIcon}>+</Text>
              <Text style={styles.createButtonText}>Create new mesh zone</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>

        {/* Bottom Navigation Bar with Menu */}
        <BottomNavWithMenu
          onNavigateToMessages={onNavigateToMessages}
          onNavigateToWallet={onNavigateToWallet}
          onNavigateToHistory={onNavigateToHistory}
          onNavigateToMeshZone={onNavigateToMeshZone}
          onNavigateToProfile={onNavigateToProfile}
          onDisconnect={onDisconnect}
        />
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
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1a4444',
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '600',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 24,
  },
  sectionTitle: {
    color: '#8a9999',
    fontSize: 16,
    fontWeight: '400',
    marginBottom: 16,
  },
  customSectionTitle: {
    color: '#8a9999',
    fontSize: 16,
    fontWeight: '400',
    marginTop: 32,
    marginBottom: 16,
  },
  zonesContainer: {
    gap: 12,
  },
  zoneButton: {
    backgroundColor: '#0d3333',
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#1a4444',
    paddingVertical: 18,
    paddingHorizontal: 20,
  },
  zoneButtonSelected: {
    backgroundColor: '#0d4d4d',
    borderColor: '#22D3EE',
    shadowColor: '#22D3EE',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  customZoneButton: {
    borderColor: '#22D3EE',
  },
  customZoneButtonDim: {
    backgroundColor: '#0a2020',
    borderColor: '#1a3333',
  },
  zoneContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  zoneIcon: {
    fontSize: 24,
    marginRight: 16,
    color: '#fff',
  },
  dimIcon: {
    color: '#4a5555',
  },
  zoneTextContainer: {
    flex: 1,
  },
  zoneLabel: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '500',
  },
  zoneRange: {
    color: '#8a9999',
    fontSize: 16,
    fontWeight: '400',
    marginLeft: 12,
  },
  dimText: {
    color: '#4a5555',
  },
  createButton: {
    backgroundColor: 'transparent',
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#22D3EE',
    paddingVertical: 18,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  createButtonIcon: {
    fontSize: 20,
    color: '#22D3EE',
    marginRight: 8,
    fontWeight: '600',
  },
  createButtonText: {
    color: '#22D3EE',
    fontSize: 16,
    fontWeight: '500',
  },
});

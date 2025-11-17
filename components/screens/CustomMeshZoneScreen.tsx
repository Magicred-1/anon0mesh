import { LinearGradient } from 'expo-linear-gradient';
import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

type ZoneRadius = 'local' | 'neighborhood' | 'city' | 'regional' | 'national' | 'global';

interface Zone {
  id: string;
  label: string;
  range: string;
  icon: string;
}

const ZONES: Zone[] = [
  { id: 'local', label: 'Local', range: '100m', icon: '📍' },
  { id: 'neighborhood', label: 'Neighborhood', range: '10km', icon: '🏠' },
  { id: 'city', label: 'City', range: '100km', icon: '🏙️' },
  { id: 'regional', label: 'Regional', range: '1 000km', icon: '👥' },
  { id: 'national', label: 'National', range: '5 000km', icon: '📖' },
  { id: 'global', label: 'Global', range: '', icon: '🌐' },
];

interface CustomMeshZoneScreenProps {
  onBack?: () => void;
  onCreate?: (zoneName: string, zoneRadius: ZoneRadius) => void;
}

export default function CustomMeshZoneScreen({
  onBack,
  onCreate,
}: CustomMeshZoneScreenProps) {
  const [zoneName, setZoneName] = useState('');
  const [selectedRadius, setSelectedRadius] = useState<string>('local');

  const handleCreate = () => {
    if (zoneName.trim() && onCreate) {
      onCreate(zoneName.trim(), selectedRadius as ZoneRadius);
    }
  };

  const isCreateEnabled = zoneName.trim().length > 0;

  return (
    <LinearGradient
      colors={['#0D0D0D', '#06181B', '#072B31']}
      locations={[0, 0.94, 1]}
      start={{ x: 0.2125, y: 0 }}
      end={{ x: 0.7875, y: 1 }}
      style={styles.container}
    >
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <KeyboardAvoidingView
          style={styles.keyboardAvoid}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity 
              style={styles.backButton}
              onPress={onBack}
              activeOpacity={0.7}
            >
              <Text style={styles.backIcon}>‹</Text>
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Custom Mesh Zone</Text>
            <TouchableOpacity
              style={[
                styles.createButton,
                !isCreateEnabled && styles.createButtonDisabled,
              ]}
              onPress={handleCreate}
              disabled={!isCreateEnabled}
              activeOpacity={0.7}
            >
              <Text style={[
                styles.createButtonText,
                !isCreateEnabled && styles.createButtonTextDisabled,
              ]}>
                Create
              </Text>
            </TouchableOpacity>
          </View>

          <ScrollView 
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {/* Zone Name Section */}
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Zone name</Text>
              <TextInput
                style={styles.input}
                value={zoneName}
                onChangeText={setZoneName}
                placeholder="Type_custom_nickname"
                placeholderTextColor="#22D3EE"
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>

            {/* Mesh Zone Radius Section */}
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Mesh Zone radius</Text>
              <View style={styles.zonesContainer}>
                {ZONES.map((zone) => {
                  const isSelected = selectedRadius === zone.id;
                  
                  return (
                    <TouchableOpacity
                      key={zone.id}
                      style={[
                        styles.zoneButton,
                        isSelected && styles.zoneButtonSelected,
                      ]}
                      onPress={() => setSelectedRadius(zone.id)}
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
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
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
  keyboardAvoid: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1a4444',
  },
  backButton: {
    width: 60,
    height: 40,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  backIcon: {
    color: '#22D3EE',
    fontSize: 32,
    fontWeight: '300',
    marginLeft: -4,
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
    flex: 1,
    textAlign: 'center',
  },
  createButton: {
    width: 80,
    height: 36,
    backgroundColor: '#22D3EE',
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  createButtonDisabled: {
    backgroundColor: '#0a4444',
  },
  createButtonText: {
    color: '#0D0D0D',
    fontSize: 15,
    fontWeight: '600',
  },
  createButtonTextDisabled: {
    color: '#4a5555',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 40,
  },
  section: {
    marginBottom: 32,
  },
  sectionLabel: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '400',
    marginBottom: 12,
  },
  input: {
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: '#22D3EE',
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 20,
    color: '#22D3EE',
    fontSize: 16,
    fontWeight: '400',
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
  zoneContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  zoneIcon: {
    fontSize: 24,
    marginRight: 16,
    color: '#fff',
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
});

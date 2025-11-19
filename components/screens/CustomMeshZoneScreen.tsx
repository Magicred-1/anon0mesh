import { LinearGradient } from 'expo-linear-gradient';
import {
  Book,
  Buildings,
  CaretLeft,
  Globe,
  House,
  MapPin,
  Users,
  type Icon,
} from 'phosphor-react-native';
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
    IconComponent: Icon;
}

const ZONES: Zone[] = [
    { id: 'local', label: 'Local', range: '100m', IconComponent: MapPin },
    { id: 'neighborhood', label: 'Neighborhood', range: '10km', IconComponent: House },
    { id: 'city', label: 'City', range: '100km', IconComponent: Buildings },
    { id: 'regional', label: 'Regional', range: '1 000km', IconComponent: Users },
    { id: 'national', label: 'National', range: '5 000km', IconComponent: Book },
    { id: 'global', label: 'Global', range: '', IconComponent: Globe },
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
                <CaretLeft size={24} color="#22D3EE" weight="regular" />
                <Text style={styles.headerTitle}>Custom Mesh Zone</Text>
                </TouchableOpacity>
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
                    placeholder="Type_custom_channel"
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
                            <View style={styles.zoneIconContainer}>
                                <zone.IconComponent size={24} color="#fff" weight="regular" />
                            </View>
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
    paddingVertical: 16,
    borderBottomWidth: 2,
    borderBottomColor: '#22D3EE',
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  createButton: {
    width: 80,
    height: 36,
    backgroundColor: '#22D3EE',
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  createButtonDisabled: {
    backgroundColor: '#072B31',
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
    backgroundColor: '#072B31',
    borderRadius: 16,
    paddingVertical: 18,
    paddingHorizontal: 20,
  },
  zoneButtonSelected: {
    backgroundColor: '#106471',
    borderWidth: 1,
    borderColor: '#22D3EE',
  },
  zoneContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  zoneIconContainer: {
    marginRight: 16,
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
    color: '#fff',
    fontSize: 16,
    fontWeight: '400',
    marginLeft: 12,
  },
});

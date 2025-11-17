import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect, useState } from 'react';
import {
    Alert,
    Keyboard,
    Modal,
    Switch,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import BottomNavWithMenu from '../ui/BottomNavWithMenu';

interface EditNicknameModalProps {
    visible: boolean;
    currentNickname: string;
    onSave: (newNickname: string) => void;
    onClose: () => void;
    pubKey: string;
}

const EditNicknameModal: React.FC<EditNicknameModalProps> = ({
    visible,
    currentNickname,
    onSave,
    onClose,
    pubKey,
}) => {
    const [nickname, setNickname] = useState(currentNickname);
    const [isValidating, setIsValidating] = useState(false);
    const [useSns, setUseSns] = useState(false);
    const [snsNickname, setSnsNickname] = useState<string | null>(null);
    const [snsDomains, setSnsDomains] = useState<string[]>([]);

    const validateAndSave = async (nick?: string) => {
        const trimmedNickname = (nick ?? nickname).trim();
        // Validation rules
        if (!trimmedNickname) {
            Alert.alert('Invalid Nickname', 'Nickname cannot be empty');
            return;
        }
        if (trimmedNickname.length < 2) {
            Alert.alert('Invalid Nickname', 'Nickname must be at least 2 characters long');
            return;
        }
        if (trimmedNickname.length > 20) {
            Alert.alert('Invalid Nickname', 'Nickname must be 20 characters or less');
            return;
        }
        if (!/^[a-zA-Z0-9\s\-_.]+$/.test(trimmedNickname)) {
            Alert.alert('Invalid Nickname', 'Nickname can only contain letters, numbers, spaces, and basic punctuation');
            return;
        }
        setIsValidating(true);
        try {
            await new Promise(resolve => setTimeout(resolve, 500));
            // Persist nickname to device storage scoped to this pubKey
            const storageKey = `nickname:${pubKey}`;
            try {
                await AsyncStorage.setItem(storageKey, trimmedNickname);
            } catch (e) {
                console.warn('[EditNicknameModal] Failed to persist nickname', e);
            }

            onSave(trimmedNickname);
            onClose();
            Alert.alert('Success', 'Nickname updated successfully!');
        } catch {
            Alert.alert('Error', 'Failed to update nickname. Please try again.');
        } finally {
            setIsValidating(false);
        }
    };

    const handleClose = () => {
        setNickname(currentNickname);
        setSnsNickname(null);
        setUseSns(false);
        setSnsDomains([]);
        onClose();
    };

    // Load any persisted nickname for this pubKey on mount and prefill
    useEffect(() => {
        let mounted = true;
        (async () => {
            try {
                const storageKey = `nickname:${pubKey}`;
                const stored = await AsyncStorage.getItem(storageKey);
                if (mounted && stored) {
                    setNickname(stored);
                }
            } catch (e) {
                console.warn('[EditNicknameModal] Failed to load persisted nickname', e);
            }
        })();
        return () => { mounted = false; };
    }, [pubKey]);



    return (
        <Modal
            visible={visible}
            animationType="slide"
            presentationStyle="pageSheet"
            onRequestClose={handleClose}
        >
            <LinearGradient
                colors={['#0D0D0D', '#06181B', '#072B31']}
                locations={[0, 0.94, 1]}
                start={{ x: 0.21, y: 0 }}
                end={{ x: 0.79, y: 1 }}
                style={{ flex: 1 }}
            >
                <SafeAreaView style={{ flex: 1 }}>
                    {/* Header */}
                    <View
                        style={{
                            flexDirection: 'row',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            paddingHorizontal: 20,
                            paddingVertical: 16,
                            borderBottomWidth: 1,
                            borderBottomColor: '#1a3333',
                        }}
                    >
                        <Text style={{ color: '#FFFFFF', fontSize: 20, fontWeight: '600' }}>
                            Profile
                        </Text>
                        <TouchableOpacity
                            onPress={() => useSns && snsNickname ? validateAndSave(snsNickname) : validateAndSave()}
                            disabled={isValidating || ((useSns && !snsNickname) || (!useSns && nickname.trim() === currentNickname))}
                            style={{
                                paddingHorizontal: 24,
                                paddingVertical: 8,
                                borderRadius: 8,
                                borderWidth: 1,
                                borderColor: '#22D3EE',
                                backgroundColor: 'transparent',
                                opacity: isValidating || ((useSns && !snsNickname) || (!useSns && nickname.trim() === currentNickname)) ? 0.5 : 1
                            }}
                        >
                            <Text style={{ color: '#22D3EE', fontSize: 16, fontWeight: '500' }}>
                                {isValidating ? 'Saving...' : 'Save'}
                            </Text>
                        </TouchableOpacity>
                    </View>
                    {/* Content */}
                    <View style={{ flex: 1, paddingHorizontal: 20, paddingTop: 24 }}>
                        {/* Custom Nickname Section */}
                        <View style={{ marginBottom: 24 }}>
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                                <Text style={{ color: '#FFFFFF', fontSize: 16, fontWeight: '500' }}>
                                    Custom Nickname
                                </Text>
                                <Text style={{ color: '#6b7280', fontSize: 14 }}>
                                    {nickname.length}/20
                                </Text>
                            </View>
                            <TextInput
                                style={{
                                    backgroundColor: 'transparent',
                                    borderRadius: 12,
                                    paddingHorizontal: 16,
                                    paddingVertical: 14,
                                    color: '#22D3EE',
                                    fontSize: 16,
                                    borderWidth: 2,
                                    borderColor: '#22D3EE',
                                    fontFamily: 'monospace',
                                }}
                                value={nickname}
                                onChangeText={setNickname}
                                placeholder="Type_custom_nickname"
                                placeholderTextColor="#22D3EE"
                                maxLength={20}
                                autoFocus={true}
                                selectTextOnFocus={true}
                                returnKeyType="done"
                                onSubmitEditing={() => Keyboard.dismiss()}
                                blurOnSubmit={true}
                            />
                        </View>

                        {/* Guidelines */}
                        <View style={{ marginBottom: 32 }}>
                            <Text style={{ color: '#6b7280', fontSize: 14, marginBottom: 6 }}>
                                • Letters, numbers and basic punctuation only
                            </Text>
                            <Text style={{ color: '#6b7280', fontSize: 14, marginBottom: 6 }}>
                                • Will be visible to other mesh users
                            </Text>
                            <Text style={{ color: '#6b7280', fontSize: 14, marginBottom: 6 }}>
                                • Choose something memorable and appropriate
                            </Text>
                        </View>

                        {/* SNS Domain Section */}
                        <View style={{ marginBottom: 24 }}>
                            <Text style={{ color: '#FFFFFF', fontSize: 16, fontWeight: '500', marginBottom: 16 }}>
                                SNS Domain
                            </Text>
                            
                            {/* SNS Domain Items */}
                            <View style={{ gap: 12 }}>
                                {snsDomains.length > 0 ? (
                                    snsDomains.map((domain, index) => (
                                        <View
                                            key={index}
                                            style={{
                                                flexDirection: 'row',
                                                alignItems: 'center',
                                                justifyContent: 'space-between',
                                                paddingVertical: 8,
                                            }}
                                        >
                                            <Text style={{ color: '#FFFFFF', fontSize: 16 }}>
                                                {domain}
                                            </Text>
                                            <Switch
                                                value={useSns && snsNickname === domain}
                                                onValueChange={(val) => {
                                                    setUseSns(val);
                                                    if (val) {
                                                        setSnsNickname(domain);
                                                    } else {
                                                        setSnsNickname(null);
                                                    }
                                                }}
                                                trackColor={{ false: '#374151', true: '#22D3EE' }}
                                                thumbColor={useSns && snsNickname === domain ? '#FFFFFF' : '#9ca3af'}
                                            />
                                        </View>
                                    ))
                                ) : (
                                    <Text style={{ color: '#6b7280', fontSize: 14, fontStyle: 'italic' }}>
                                        No SNS domains found for this wallet.
                                    </Text>
                                )}
                            </View>
                        </View>

                        {/* Seeker Domain Address Section */}
                        <View style={{ marginBottom: 24 }}>
                            <Text style={{ color: '#FFFFFF', fontSize: 16, fontWeight: '500', marginBottom: 16 }}>
                                Seeker Domain Address
                            </Text>
                            
                            <View
                                style={{
                                    flexDirection: 'row',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    paddingVertical: 8,
                                }}
                            >
                                <Text style={{ color: '#FFFFFF', fontSize: 16 }}>
                                    popo.skr
                                </Text>
                                <Switch
                                    value={false}
                                    onValueChange={() => {}}
                                    trackColor={{ false: '#374151', true: '#22D3EE' }}
                                    thumbColor='#9ca3af'
                                />
                            </View>
                        </View>
                    </View>

                    {/* Bottom Navigation Bar with Menu */}
                    <BottomNavWithMenu
                        onNavigateToMessages={handleClose}
                        onNavigateToWallet={handleClose}
                        onNavigateToHistory={handleClose}
                        onNavigateToMeshZone={handleClose}
                        onNavigateToProfile={() => {
                            // Already on profile, just close modal
                        }}
                        onDisconnect={handleClose}
                    />
                </SafeAreaView>
            </LinearGradient>
        </Modal>
    );
};

export default EditNicknameModal;
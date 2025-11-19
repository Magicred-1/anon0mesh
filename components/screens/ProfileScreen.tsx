import { WalletFactory } from '@/src/infrastructure/wallet';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect, useState } from 'react';
import {
    Alert,
    Keyboard,
    Switch,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import BottomNavWithMenu from '../ui/BottomNavWithMenu';

interface ProfileScreenProps {
    onNavigateToMessages?: () => void;
    onNavigateToWallet?: () => void;
    onNavigateToHistory?: () => void;
    onNavigateToMeshZone?: () => void;
    onNavigateToProfile?: () => void;
    onDisconnect?: () => void;
}

const ProfileScreen: React.FC<ProfileScreenProps> = ({
    onNavigateToMessages,
    onNavigateToWallet,
    onNavigateToHistory,
    onNavigateToMeshZone,
    onNavigateToProfile,
    onDisconnect,
}) => {
    const [nickname, setNickname] = useState('');
    const [pubKey, setPubKey] = useState<string>('');
    const [isValidating, setIsValidating] = useState(false);
    const [useSns, setUseSns] = useState(false);
    const [snsNickname, setSnsNickname] = useState<string | null>(null);
    const [snsDomains, setSnsDomains] = useState<string[]>([]);

    // Load wallet and nickname on mount
    useEffect(() => {
        let mounted = true;
        (async () => {
            try {
                // Get wallet public key
                const walletAdapter = await WalletFactory.createAuto();
                const publicKey = await walletAdapter.getPublicKey();
                
                if (publicKey && mounted) {
                    const pubKeyString = publicKey.toBase58 ? publicKey.toBase58() : publicKey.toString();
                    setPubKey(pubKeyString);

                    // Load persisted nickname for this pubKey
                    const storageKey = `nickname:${pubKeyString}`;
                    try {
                        const stored = await AsyncStorage.getItem(storageKey);
                        if (mounted && stored) {
                            setNickname(stored);
                        } else {
                            // Fallback to SecureStore nickname
                            const { default: SecureStore } = await import('expo-secure-store');
                            const storedNickname = await SecureStore.getItemAsync('nickname');
                            if (mounted && storedNickname) {
                                setNickname(storedNickname);
                            } else if (mounted) {
                                setNickname('Anonymous');
                            }
                        }
                    } catch (e) {
                        console.warn('[ProfileScreen] Failed to load persisted nickname', e);
                        if (mounted) {
                            setNickname('Anonymous');
                        }
                    }

                    // Set fake SNS domains for design testing
                    if (mounted) {
                        setSnsDomains([
                            'example.sol',
                            'testdomain.sol',
                        ]);
                    }
                }
            } catch (e) {
                console.warn('[ProfileScreen] Failed to initialize', e);
                if (mounted) {
                    setNickname('Anonymous');
                    // Set fake SNS domains even if wallet init fails (for design testing)
                    setSnsDomains([
                        'example.sol',
                        'testdomain.sol',
                    ]);
                }
            }
        })();
        return () => { mounted = false; };
    }, []);

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
            if (pubKey) {
                const storageKey = `nickname:${pubKey}`;
                try {
                    await AsyncStorage.setItem(storageKey, trimmedNickname);
                } catch (e) {
                    console.warn('[ProfileScreen] Failed to persist nickname', e);
                }
            }

            setNickname(trimmedNickname);
            Alert.alert('Success', 'Nickname updated successfully!');
        } catch {
            Alert.alert('Error', 'Failed to update nickname. Please try again.');
        } finally {
            setIsValidating(false);
        }
    };

    return (
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
                        borderBottomWidth: 2,
                        borderBottomColor: '#22D3EE',
                    }}
                >
                    <Text style={{ color: '#FFFFFF', fontSize: 20, fontWeight: '600' }}>
                        Profile
                    </Text>
                    <TouchableOpacity
                        onPress={() => useSns && snsNickname ? validateAndSave(snsNickname) : validateAndSave()}
                        disabled={isValidating || ((useSns && !snsNickname) || (!useSns && nickname.trim().length === 0))}
                        style={{
                            width: 80,
                            height: 36,
                            backgroundColor: isValidating || ((useSns && !snsNickname) || (!useSns && nickname.trim().length === 0)) ? '#072B31' : '#22D3EE',
                            borderRadius: 10,
                            justifyContent: 'center',
                            alignItems: 'center',
                        }}
                        activeOpacity={0.7}
                    >
                        <Text style={{
                            color: isValidating || ((useSns && !snsNickname) || (!useSns && nickname.trim().length === 0)) ? '#4a5555' : '#0D0D0D',
                            fontSize: 15,
                            fontWeight: '600'
                        }}>
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
                            <Text style={{ color: '#9CA3AF', fontSize: 14 }}>
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
                            autoFocus={false}
                            selectTextOnFocus={true}
                            returnKeyType="done"
                            onSubmitEditing={() => Keyboard.dismiss()}
                            blurOnSubmit={true}
                        />
                    </View>

                    {/* Guidelines */}
                    <View style={{ marginBottom: 32 }}>
                        <Text style={{ color: '#9CA3AF', fontSize: 14, marginBottom: 6 }}>
                            • Letters, numbers and basic punctuation only
                        </Text>
                        <Text style={{ color: '#9CA3AF', fontSize: 14, marginBottom: 6 }}>
                            • Will be visible to other mesh users
                        </Text>
                        <Text style={{ color: '#9CA3AF', fontSize: 14, marginBottom: 6 }}>
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
                                            paddingVertical: 8,
                                            gap: 8,
                                        }}
                                    >
                                          <View style={{ transform: [{ scale: 0.75 }] }}>
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
                                              trackColor={{ false: '#9CA3AF', true: '#22D3EE' }}
                                              thumbColor={useSns && snsNickname === domain ? '#FFFFFF' : '#fff'}
                                            />
                                          </View>
                                        <Text style={{ color: '#FFFFFF', fontSize: 16 }}>
                                            {domain}
                                        </Text>
                                      
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
                                paddingVertical: 8,
                                gap: 8,
                            }}
                        >
                              <View style={{ transform: [{ scale: 0.75 }] }}>
                                <Switch
                                  value={false}
                                  onValueChange={() => {}}
                                  trackColor={{ false: '#9CA3AF', true: '#22D3EE' }}
                                  thumbColor='#fff'
                                />
                              </View>
                            <Text style={{ color: '#FFFFFF', fontSize: 16 }}>
                                popo.skr
                            </Text>
                          
                        </View>
                    </View>
                </View>

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
};

export default ProfileScreen;


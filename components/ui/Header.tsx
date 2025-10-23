import { useRouter } from 'expo-router';
import React, { useRef } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useChannels } from '../../src/contexts/ChannelContext';
import PenIcon from './PenIcon';
import { ZoneDropdownSelector } from './ZoneDropdownSelector';

interface Props {
    pubKey: string;
    nickname: string;
    displayNickname?: string;
    toggleSidebar: () => void;
    onWalletPress?: () => void;
    onNicknameEdit?: () => void;
    zoneSelector?: React.ReactNode;
}

export default function Header({ 
    nickname, 
    displayNickname, 
    onWalletPress, 
    onNicknameEdit,
    zoneSelector,
}: Props) {
    const navigation = useRouter();
    const tapCount = useRef(0);
    const tapTimeout = useRef<NodeJS.Timeout | number | null>(null);
    const { channels, currentChannel, setCurrentChannel } = useChannels();

    const handleTitleTap = () => {
        tapCount.current += 1;

        if (tapTimeout.current) clearTimeout(tapTimeout.current);

        tapTimeout.current = setTimeout(() => {
            if (tapCount.current === 3 || tapCount.current > 3) {
                navigation.navigate('/landing');
            }
            tapCount.current = 0;
        }, 400);
    };

    const displayName = displayNickname || `${nickname || ''}`;

    return (
        <SafeAreaView style={styles.safeArea} edges={['top']}>
            <View style={styles.container}>
                {/* Top Row - Identity and Wallet */}
                <View style={styles.topRow}>
                    {/* Left - User Identity */}
                    <View style={styles.identityContainer}>
                        <TouchableOpacity onPress={handleTitleTap} activeOpacity={0.7}>
                            <Text style={styles.displayName} numberOfLines={1}>
                                {displayName}
                            </Text>
                        </TouchableOpacity>
                        
                        <TouchableOpacity
                            onPress={onNicknameEdit}
                            style={styles.editButton}
                            activeOpacity={0.6}
                        >
                            <PenIcon size={11} color="#999999" />
                        </TouchableOpacity>
                    </View>

                    {/* Right group: selector (left) + wallet (right) */}
                    <View style={styles.rightGroup}>
                        <View style={styles.selectorContainer}>
                            <ZoneDropdownSelector
                                channels={channels}
                                currentChannel={currentChannel}
                                onChannelSelect={(ch) => setCurrentChannel(ch)}
                                useAntennaIcon={true}
                                iconOnly={true}
                            />
                        </View>

                        {/* Right - Wallet Button */}
                        <TouchableOpacity
                            onPress={onWalletPress || (() => {})}
                            style={styles.walletButton}
                            activeOpacity={0.7}
                        >
                            <Text style={styles.buttonEmoji}>💰</Text>
                            <Text style={styles.walletText}>Wallet</Text>
                        </TouchableOpacity>
                    </View>
                </View>
                {/* Dropdown is self-contained; no modal needed here */}
                
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safeArea: {
        backgroundColor: '#0f0f0f',
    },
    container: {
        paddingTop: 0,
        paddingBottom: 8,
        paddingHorizontal: 14,
        backgroundColor: '#0f0f0f',
        flexDirection: 'column',
        borderBottomWidth: 1,
        borderBottomColor: '#1f1f1f',
    },
    topRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    identityContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
        marginRight: 10,
    },
    displayName: {
        fontWeight: '600',
        fontSize: 14.5,
        color: '#FFFFFF',
        letterSpacing: -0.2,
        fontFamily: 'Lexend_400Regular',
    },
    editButton: {
        marginLeft: 6,
        padding: 5,
        borderRadius: 6,
        backgroundColor: '#1a1a1a',
    },
    walletButton: {
        backgroundColor: '#1a1a1a',
        paddingVertical: 7,
        paddingHorizontal: 12,
        borderRadius: 8,
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#252525',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.3,
        shadowRadius: 2,
        elevation: 2,
    },
    buttonEmoji: {
        fontSize: 13,
        marginRight: 5,
    },
    walletText: {
        color: '#E0E0E0',
        fontWeight: '600',
        fontSize: 12.5,
        fontFamily: 'Lexend_400Regular',
        letterSpacing: 0.2,
    },
    bottomRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: 8,
    },
    peersButton: {
        backgroundColor: '#1a1a1a',
        paddingVertical: 6,
        paddingHorizontal: 10,
        borderRadius: 8,
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#252525',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.3,
        shadowRadius: 2,
        elevation: 2,
    },
    peersText: {
        color: '#E0E0E0',
        fontWeight: '600',
        fontSize: 11.5,
        fontFamily: 'Lexend_400Regular',
        letterSpacing: 0.2,
    },
    channelButton: {
        marginRight: 8,
        width: 36,
        height: 36,
        borderRadius: 8,
        backgroundColor: '#1a1a1a',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#252525',
    },
    channelIcon: {
        color: '#E0E0E0',
        fontSize: 14,
        fontWeight: '700',
    },
    rightGroup: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    selectorContainer: {
        marginRight: 8,
        width: 48,
    },
});

import React, { useRef, useState } from 'react';
import { Modal, Text, TouchableOpacity, View, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import QRCode from 'react-native-qrcode-svg';
import PenIcon from './PenIcon';
import { useRouter } from 'expo-router';

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
    pubKey, 
    nickname, 
    displayNickname, 
    toggleSidebar, 
    onWalletPress, 
    onNicknameEdit,
    zoneSelector
}: Props) {
    const navigation = useRouter();
    const tapCount = useRef(0);
    const tapTimeout = useRef<NodeJS.Timeout | number | null>(null);
    const [qrVisible, setQrVisible] = useState(false);

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

    const displayName = displayNickname || `anon0mesh/${nickname || 'AliceAndBob'}`;

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

                {/* Bottom Row - Zone and Peers */}
                <View style={styles.bottomRow}>
                    {/* Zone Selector (if provided) */}
                    {zoneSelector}

                    {/* Peers Button */}
                    <TouchableOpacity
                        onPress={toggleSidebar}
                        style={styles.peersButton}
                        activeOpacity={0.7}
                    >
                        <Text style={styles.buttonEmoji}>👥</Text>
                        <Text style={styles.peersText}>Peers</Text>
                    </TouchableOpacity>
                </View>
            </View>

            <Modal visible={qrVisible} transparent animationType="fade">
                <View
                    style={{
                        flex: 1,
                        backgroundColor: 'rgba(0,0,0,0.8)',
                        justifyContent: 'center',
                        alignItems: 'center',
                    }}
                >
                    <View
                        style={{
                            backgroundColor: '#0A0A0A',
                            padding: 20,
                            borderRadius: 16,
                            alignItems: 'center',
                            borderWidth: 2,
                            borderColor: '#B10FF2',
                        }}
                    >
                        <Text
                            style={{
                                color: '#B10FF2',
                                fontFamily: 'Lexend_400Regular',
                                marginBottom: 16,
                                fontSize: 16,
                                fontWeight: 'regular',
                            }}
                        >
                            Your PubKey
                        </Text>
                        <QRCode
                            value={pubKey}
                            size={200}
                            color="#A855F7"
                            backgroundColor="#0A0A0A"
                        />
                        <TouchableOpacity
                            onPress={() => setQrVisible(false)}
                            style={{
                                marginTop: 20,
                                paddingVertical: 8,
                                paddingHorizontal: 16,
                                borderRadius: 12,
                                backgroundColor: '#B10FF2',
                            }}
                        >
                            <Text
                                style={{
                                    color: '#FFFFFF',
                                    fontFamily: 'Lexend_400Regular',
                                    fontWeight: 'regular',
                                }}
                            >
                                Close
                            </Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safeArea: {
        backgroundColor: '#0f0f0f',
    },
    container: {
        paddingTop: 8,
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
});

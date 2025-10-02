import { useNavigation } from '@react-navigation/native';
import React, { useRef, useState } from 'react';
import { Modal, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import QRCode from 'react-native-qrcode-svg';

interface Props {
    pubKey: string;
    nickname: string;
    toggleSidebar: () => void;
    onWalletPress?: () => void;
    onNicknameEdit?: () => void;
}

export default function Header({ pubKey, nickname, toggleSidebar, onWalletPress, onNicknameEdit }: Props) {
    const navigation = useNavigation<any>();
    const tapCount = useRef(0);
    const tapTimeout = useRef<NodeJS.Timeout | number | null>(null);
    const [qrVisible, setQrVisible] = useState(false);

    const handleTitleTap = () => {
        tapCount.current += 1;

        if (tapTimeout.current) clearTimeout(tapTimeout.current);

        tapTimeout.current = setTimeout(() => {
            if (tapCount.current === 3) {
                // 🔧 Instead of onboarding navigation, show QR modal
                navigation.navigate('onboarding');
            }
            tapCount.current = 0;
        }, 400);
    };

    const displayName = `anon0mesh/${nickname || 'AliceAndBob'}`;

    return (
        <SafeAreaView style={{ backgroundColor: '#212122' }} edges={['top']}>
        <View
            style={{
                paddingTop: 8,
                paddingBottom: 12,
                paddingHorizontal: 20,
                backgroundColor: '#212122',
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
                minHeight: 56,
            }}
        >
            {/* Title / Nickname */}
            <TouchableOpacity onPress={handleTitleTap} activeOpacity={0.7}>
                <View>
                    <Text
                        style={{
                            fontWeight: '400',
                            fontSize: 17,
                            color: '#FFFFFF',
                            fontFamily: 'System',
                        }}
                    >
                        {displayName}
                    </Text>
                </View>
            </TouchableOpacity>

                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                {/* Wallet Button */}
                <TouchableOpacity
                    onPress={onWalletPress || (() => {})}
                    style={{
                        backgroundColor: '#404040',
                        paddingVertical: 8,
                        paddingHorizontal: 16,
                        borderRadius: 8,
                        flexDirection: 'row',
                        alignItems: 'center',
                    }}
                >
                    <Text style={{ fontSize: 14, marginRight: 6 }}>💰</Text>
                    <Text
                        style={{
                            color: '#FFFFFF',
                            fontWeight: '500',
                            fontFamily: 'System',
                            fontSize: 15,
                        }}
                    >
                        Wallet
                    </Text>
                </TouchableOpacity>
            </View>

            {/* QR Modal */}
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
                                fontFamily: 'Lexend',
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
                                    fontFamily: 'Lexend',
                                    fontWeight: 'regular',
                                }}
                            >
                                Close
                            </Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
        </View>
        </SafeAreaView>
    );
}

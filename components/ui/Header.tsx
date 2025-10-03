import { useNavigation } from '@react-navigation/native';
import React, { useRef, useState } from 'react';
import { Modal, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import QRCode from 'react-native-qrcode-svg';
import PenIcon from './PenIcon';

interface Props {
    pubKey: string;
    nickname: string;
    displayNickname?: string;
    currentChannelName?: string;
    toggleSidebar: () => void;
    onWalletPress?: () => void;
    onNicknameEdit?: () => void;
    onChannelPress?: () => void;
}

export default function Header({ 
    pubKey, 
    nickname, 
    displayNickname, 
    currentChannelName = 'General',
    toggleSidebar, 
    onWalletPress, 
    onNicknameEdit,
    onChannelPress 
}: Props) {
    const navigation = useNavigation<any>();
    const tapCount = useRef(0);
    const tapTimeout = useRef<NodeJS.Timeout | number | null>(null);
    const [qrVisible, setQrVisible] = useState(false);

    const handleTitleTap = () => {
        tapCount.current += 1;

        if (tapTimeout.current) clearTimeout(tapTimeout.current);

        tapTimeout.current = setTimeout(() => {
            if (tapCount.current === 3) {
                navigation.navigate('onboarding');
            }
            tapCount.current = 0;
        }, 400);
    };

    const displayName = displayNickname || `anon0mesh/${nickname || 'AliceAndBob'}`;

    return (
        <SafeAreaView style={{ backgroundColor: '#212122' }} edges={['top']}>
            <View
                style={{
                    paddingTop: 8,
                    paddingBottom: 12,
                    paddingHorizontal: 20,
                    backgroundColor: '#212122',
                    flexDirection: 'column',
                    minHeight: 76,
                }}
            >
                <View style={{
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: 8,
                }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                        <TouchableOpacity onPress={handleTitleTap} activeOpacity={0.7}>
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
                        </TouchableOpacity>
                        
                        <TouchableOpacity
                            onPress={onNicknameEdit}
                            style={{
                                marginLeft: 8,
                                padding: 4,
                                borderRadius: 4,
                            }}
                            activeOpacity={0.6}
                        >
                            <PenIcon size={16} color="#888888" />
                        </TouchableOpacity>
                    </View>

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

                <View style={{
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                }}>
                    <TouchableOpacity
                        onPress={onChannelPress}
                        style={{
                            backgroundColor: '#333333',
                            paddingVertical: 6,
                            paddingHorizontal: 12,
                            borderRadius: 6,
                            flexDirection: 'row',
                            alignItems: 'center',
                            flex: 1,
                            marginRight: 12,
                        }}
                        activeOpacity={0.7}
                    >
                        <Text style={{ fontSize: 16, marginRight: 8 }}>💬</Text>
                        <Text
                            style={{
                                color: '#FFFFFF',
                                fontWeight: '500',
                                fontFamily: 'System',
                                fontSize: 14,
                                flex: 1,
                            }}
                            numberOfLines={1}
                        >
                            #{currentChannelName}
                        </Text>
                        <Text style={{ color: '#888888', fontSize: 12 }}>▼</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        onPress={toggleSidebar}
                        style={{
                            backgroundColor: '#333333',
                            paddingVertical: 6,
                            paddingHorizontal: 12,
                            borderRadius: 6,
                            flexDirection: 'row',
                            alignItems: 'center',
                        }}
                        activeOpacity={0.7}
                    >
                        <Text style={{ fontSize: 16, marginRight: 6 }}>👥</Text>
                        <Text
                            style={{
                                color: '#FFFFFF',
                                fontWeight: '500',
                                fontFamily: 'System',
                                fontSize: 14,
                            }}
                        >
                            Peers
                        </Text>
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
        </SafeAreaView>
    );
}

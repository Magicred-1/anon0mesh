import { useNavigation } from '@react-navigation/native';
import React, { useRef, useState } from 'react';
import { Modal, Text, TouchableOpacity, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';

interface Props {
    pubKey: string;
    nickname: string;
    toggleSidebar: () => void;
}

export default function Header({ pubKey, nickname, toggleSidebar }: Props) {
    const navigation = useNavigation<any>();
    const tapCount = useRef(0);
    const tapTimeout = useRef<number | null>(null);
    const [qrVisible, setQrVisible] = useState(false);

    const handleTitleTap = () => {
        tapCount.current += 1;

        if (tapTimeout.current) clearTimeout(tapTimeout.current);

        tapTimeout.current = setTimeout(() => {
            if (tapCount.current === 3) {
                navigation.navigate('IndexScreen'); // Triple tap action
            }
            tapCount.current = 0;
        }, 400);
    };

    const displayName = nickname ? `anon0mesh/@${nickname}` : '';

    return (
        <View
            style={{
                padding: 12,
                backgroundColor: '#121212',
                borderBottomWidth: 1,
                borderColor: '#333',
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
                shadowColor: '#00FF9C',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.5,
                shadowRadius: 4,
                elevation: 5,
            }}
        >
            {/* Title / PubKey */}
            <TouchableOpacity onPress={handleTitleTap} activeOpacity={0.7}>
                <View>
                    <Text
                        style={{
                            fontWeight: 'bold',
                            fontSize: 18,
                            color: '#00FF9C',
                            fontFamily: 'Courier',
                        }}
                    >
                        {displayName}
                    </Text>
                    {/* <Text
                        style={{
                            fontSize: 12,
                            color: '#AAAAAA',
                            fontFamily: 'Courier',
                            marginTop: 2,
                        }}
                    >
                        PubKey: {pubKey}
                    </Text> */}
                </View>
            </TouchableOpacity>

            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                {/* QR Button */}
                <TouchableOpacity
                    onPress={() => setQrVisible(true)}
                    style={{
                        backgroundColor: '#1E1E1E',
                        paddingVertical: 6,
                        paddingHorizontal: 12,
                        borderRadius: 12,
                        borderWidth: 1,
                        borderColor: '#00FF9C',
                        marginRight: 8,
                    }}
                >
                    <Text
                        style={{
                            color: '#00FF9C',
                            fontWeight: 'bold',
                            fontFamily: 'Courier',
                        }}
                    >
                        QR
                    </Text>
                </TouchableOpacity>

                {/* DMs Button */}
                <TouchableOpacity
                    onPress={toggleSidebar}
                    style={{
                        backgroundColor: '#1E1E1E',
                        paddingVertical: 6,
                        paddingHorizontal: 16,
                        borderRadius: 12,
                        borderWidth: 1,
                        borderColor: '#00FF9C',
                    }}
                >
                    <Text
                        style={{
                            color: '#00FF9C',
                            fontWeight: 'bold',
                            fontFamily: 'Courier',
                        }}
                    >
                        DMs
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
                            backgroundColor: '#1A1A1A',
                            padding: 20,
                            borderRadius: 16,
                            alignItems: 'center',
                        }}
                    >
                        <Text
                            style={{
                                color: '#00FF9C',
                                fontFamily: 'Courier',
                                marginBottom: 16,
                            }}
                        >
                            Your PubKey
                        </Text>
                        <QRCode value={pubKey} size={200} color="#00FF9C" backgroundColor="#1A1A1A" />
                        <TouchableOpacity
                            onPress={() => setQrVisible(false)}
                            style={{
                                marginTop: 20,
                                paddingVertical: 8,
                                paddingHorizontal: 16,
                                borderRadius: 12,
                                borderWidth: 1,
                                borderColor: '#00FF9C',
                            }}
                        >
                            <Text style={{ color: '#00FF9C', fontFamily: 'Courier' }}>Close</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
        </View>
    );
}

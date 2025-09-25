import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';

interface Props {
    peers: string[];
    onSelectPeer: (peer: string) => void;
    onClose: () => void;
}

export default function PrivateSidebar({ peers, onSelectPeer, onClose }: Props) {
    return (
        <View
        style={{
            flex: 1,
            paddingTop: 50,
            backgroundColor: '#111111',
            paddingHorizontal: 12,
        }}
        >
        <Text
            style={{
            color: '#00FF9C',
            fontWeight: 'bold',
            fontSize: 18,
            fontFamily: 'Courier',
            marginBottom: 16,
            textAlign: 'right', // 👈 optional to feel “right-side”
            }}
        >
            Private Chats
        </Text>

        {peers.map((peer, i) => (
            <TouchableOpacity
            key={i}
            onPress={() => onSelectPeer(peer)}
            style={{
                paddingVertical: 12,
                paddingHorizontal: 12,
                marginBottom: 8,
                borderWidth: 1,
                borderColor: '#00FF9C',
                borderRadius: 12,
                backgroundColor: '#0F0F0F',
                shadowColor: '#00FF9C',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.6,
                shadowRadius: 4,
            }}
            >
            <Text
                style={{
                color: '#00FF9C',
                fontFamily: 'Courier',
                fontSize: 14,
                }}
            >
                {peer}
            </Text>
            </TouchableOpacity>
        ))}

        <TouchableOpacity
            onPress={onClose}
            style={{
            marginTop: 24,
            backgroundColor: '#00FF9C',
            paddingVertical: 12,
            borderRadius: 12,
            justifyContent: 'center',
            alignItems: 'center',
            shadowColor: '#00FF9C',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.8,
            shadowRadius: 6,
            }}
        >
            <Text
            style={{
                color: '#0A0A0A',
                fontWeight: 'bold',
                fontFamily: 'Courier',
                fontSize: 16,
            }}
            >
            Close
            </Text>
        </TouchableOpacity>
        </View>
    );
}

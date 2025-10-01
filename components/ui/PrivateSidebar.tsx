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
            backgroundColor: '#0A0A0A',
            paddingHorizontal: 12,
        }}
        >
        <Text
            style={{
            color: '#A855F7',
            fontWeight: 'bold',
            fontSize: 18,
            fontFamily: 'Courier',
            marginBottom: 16,
            textAlign: 'right',
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
                borderColor: '#A855F7',
                borderRadius: 12,
                backgroundColor: '#000000',
                shadowColor: '#A855F7',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.6,
                shadowRadius: 4,
            }}
            >
            <Text
                style={{
                color: '#C084FC',
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
            backgroundColor: '#A855F7',
            paddingVertical: 12,
            borderRadius: 12,
            justifyContent: 'center',
            alignItems: 'center',
            shadowColor: '#A855F7',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.8,
            shadowRadius: 6,
            }}
        >
            <Text
            style={{
                color: '#FFFFFF',
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
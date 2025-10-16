import React from 'react';
import {
    Animated,
    Dimensions,
    Modal,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    TouchableWithoutFeedback,
    View,
} from 'react-native';
import { Channel } from '../../src/types/channels';

interface Props {
    visible: boolean;
    peers: string[];
    channels: Channel[];
    currentChannel: Channel | null;
    onSelectPeer: (peer: string) => void;
    onSelectChannel: (channel: Channel) => void;
    onClose: () => void;
    // Optional: currently selected private target (so sidebar can offer a quick return)
    currentPrivate?: string | null;
    // Handler to clear private target / return to general chat
    onClearPrivate?: () => void;
}

const { width } = Dimensions.get('window');
const SIDEBAR_WIDTH = width * 0.85;

export default function PrivateSidebar({
    visible,
    peers,
    channels,
    currentChannel,
    onSelectPeer,
    onSelectChannel,
    onClose,
    currentPrivate,
    onClearPrivate,
}: Props) {
    const slideAnim = React.useRef(new Animated.Value(SIDEBAR_WIDTH)).current;
    const opacityAnim = React.useRef(new Animated.Value(0)).current;
    const [activeTab, setActiveTab] = React.useState<'channels' | 'peers'>('channels');

    // Generate random mock peers if none exist
    const generateMockPeers = (count: number) => {
        const adjectives = ['Swift', 'Calm', 'Brave', 'Lucky', 'Mighty', 'Silent', 'Bright', 'Witty', 'Chill', 'Bold'];
        const animals = ['Tiger', 'Eagle', 'Panda', 'Wolf', 'Otter', 'Falcon', 'Fox', 'Bear', 'Dolphin', 'Hawk'];
        const emojis = ['🦊', '🐻', '🐼', '🐺', '🐯', '🦅', '🐬', '🦉', '🐧', '🐙'];
        const randomPeers = Array.from({ length: count }, () => {
            const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
            const animal = animals[Math.floor(Math.random() * animals.length)];
            const emoji = emojis[Math.floor(Math.random() * emojis.length)];
            const num = Math.floor(Math.random() * 900 + 100);
            return { name: `${adj}${animal}${num}`, emoji };
        });
        return randomPeers;
    };

    // Stable random list so it doesn’t change each render
    const mockPeers = React.useMemo(() => generateMockPeers(8), []);
    const displayPeers =
        peers && peers.length > 0
            ? peers.map((p) => ({ name: p, emoji: '👤' }))
            : mockPeers;

    React.useEffect(() => {
        if (visible) {
            Animated.parallel([
                Animated.timing(slideAnim, { toValue: 0, duration: 300, useNativeDriver: true }),
                Animated.timing(opacityAnim, { toValue: 1, duration: 300, useNativeDriver: true }),
            ]).start();
        } else {
            Animated.parallel([
                Animated.timing(slideAnim, { toValue: SIDEBAR_WIDTH, duration: 250, useNativeDriver: true }),
                Animated.timing(opacityAnim, { toValue: 0, duration: 250, useNativeDriver: true }),
            ]).start();
        }
    }, [visible, slideAnim, opacityAnim]);

    const handleSelectPeer = (peer: string) => {
        onSelectPeer(peer);
        onClose();
    };

    return (
        <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
            <View style={{ flex: 1 }}>
                {/* Backdrop */}
                <TouchableWithoutFeedback onPress={onClose}>
                    <Animated.View
                        style={{
                            ...StyleSheet.absoluteFillObject,
                            backgroundColor: '#000',
                            opacity: opacityAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 0.6] }),
                        }}
                        pointerEvents={visible ? 'auto' : 'none'}
                    />
                </TouchableWithoutFeedback>

                {/* Sidebar */}
                <Animated.View
                    style={{
                        position: 'absolute',
                        right: 0,
                        top: 0,
                        bottom: 0,
                        width: SIDEBAR_WIDTH,
                        backgroundColor: '#121212',
                        transform: [{ translateX: slideAnim }],
                        borderLeftWidth: 2,
                        borderLeftColor: '#26C6DA',
                        shadowColor: '#000',
                        shadowOffset: { width: -3, height: 0 },
                        shadowOpacity: 0.4,
                        shadowRadius: 6,
                    }}
                >
                    {/* Header */}
                    <View style={{ paddingTop: 60, paddingHorizontal: 24, paddingBottom: 24, borderBottomWidth: 1, borderBottomColor: '#2a2a2a' }}>
                        <Text style={{ color: '#26C6DA', fontSize: 26, fontWeight: '700', fontFamily: 'monospace', marginBottom: 4 }}>
                            Mesh Network
                        </Text>
                        <Text style={{ color: '#aaa', fontSize: 13, fontFamily: 'monospace' }}>
                            {channels.length} channels • {displayPeers.length} peers online
                        </Text>
                    </View>

                    {/* Tabs */}
                    <View style={{ flexDirection: 'row', margin: 16, backgroundColor: '#1E1E1E', borderRadius: 12 }}>
                        {['channels', 'peers'].map((tab) => (
                            <TouchableOpacity
                                key={tab}
                                onPress={() => setActiveTab(tab as 'channels' | 'peers')}
                                style={{
                                    flex: 1,
                                    paddingVertical: 10,
                                    borderRadius: 12,
                                    backgroundColor: activeTab === tab ? '#26C6DA' : 'transparent',
                                }}
                            >
                                <Text
                                    style={{
                                        color: activeTab === tab ? '#fff' : '#888',
                                        fontFamily: 'monospace',
                                        fontSize: 14,
                                        fontWeight: '600',
                                        textAlign: 'center',
                                    }}
                                >
                                    {tab.charAt(0).toUpperCase() + tab.slice(1)}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>

                    {/* Content */}
                    <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 32 }}>
                        {activeTab === 'channels' ? (
                            channels.length === 0 ? (
                                <View style={{ alignItems: 'center', paddingVertical: 60 }}>
                                    <Text style={{ fontSize: 48, marginBottom: 12 }}>💬</Text>
                                    <Text style={{ color: '#666', fontFamily: 'monospace', fontSize: 14, textAlign: 'center' }}>
                                        No channels available
                                    </Text>
                                </View>
                            ) : (
                                channels.map((channel) => (
                                    <TouchableOpacity
                                        key={channel.id}
                                        onPress={() => {
                                            onSelectChannel(channel);
                                            onClose();
                                        }}
                                        style={{
                                            flexDirection: 'row',
                                            alignItems: 'center',
                                            padding: 16,
                                            marginBottom: 12,
                                            borderRadius: 16,
                                            backgroundColor: currentChannel?.id === channel.id ? '#1f3f3f' : '#1A1A1A',
                                            borderWidth: 1,
                                            borderColor: currentChannel?.id === channel.id ? '#10B981' : '#333',
                                        }}
                                        activeOpacity={0.8}
                                    >
                                        <View
                                            style={{
                                                width: 44,
                                                height: 44,
                                                borderRadius: 22,
                                                backgroundColor: '#26C6DA',
                                                justifyContent: 'center',
                                                alignItems: 'center',
                                                marginRight: 12,
                                            }}
                                        >
                                            <Text style={{ fontSize: 20 }}>{channel.icon || '💬'}</Text>
                                        </View>
                                        <View style={{ flex: 1 }}>
                                            <Text style={{ color: '#26C6DA', fontFamily: 'Lexend_400Regular', fontSize: 15, fontWeight: '600' }}>
                                                #{channel.name}
                                            </Text>
                                            {channel.description && (
                                                <Text style={{ color: '#b0b0b0', fontSize: 11, fontFamily: 'monospace' }}>{channel.description}</Text>
                                            )}
                                        </View>
                                        {currentChannel?.id === channel.id && (
                                            <Text style={{ color: '#10B981', fontSize: 20 }}>✓</Text>
                                        )}
                                    </TouchableOpacity>
                                ))
                            )
                        ) : displayPeers.length === 0 ? (
                            <View style={{ alignItems: 'center', paddingVertical: 60 }}>
                                <Text style={{ fontSize: 48, marginBottom: 12 }}>👥</Text>
                                <Text style={{ color: '#666', fontFamily: 'monospace', fontSize: 14, textAlign: 'center' }}>
                                    No peers online yet
                                </Text>
                            </View>
                        ) : (
                            <>
                                {/* Quick return to general chat when in a private convo */}
                                {currentPrivate ? (
                                    <TouchableOpacity
                                        onPress={() => {
                                            if (onClearPrivate) onClearPrivate();
                                            onClose();
                                        }}
                                        style={{
                                            padding: 12,
                                            marginBottom: 12,
                                            borderRadius: 12,
                                            backgroundColor: '#222',
                                            borderWidth: 1,
                                            borderColor: '#444',
                                            alignItems: 'center',
                                        }}
                                    >
                                        <Text style={{ color: '#fff', fontFamily: 'monospace', fontWeight: '700' }}>
                                            ← Return to general chat
                                        </Text>
                                    </TouchableOpacity>
                                ) : null}
                                {displayPeers.map((peer, i) => (
                                    <TouchableOpacity
                                    key={i}
                                    onPress={() => handleSelectPeer(peer.name)}
                                    style={{
                                        flexDirection: 'row',
                                        alignItems: 'center',
                                        padding: 16,
                                        marginBottom: 12,
                                        borderRadius: 16,
                                        backgroundColor: '#1A1A1A',
                                        borderWidth: 1,
                                        borderColor: '#333',
                                    }}
                                    activeOpacity={0.8}
                                >
                                    <View
                                        style={{
                                            width: 44,
                                            height: 44,
                                            borderRadius: 22,
                                            backgroundColor: '#26C6DA',
                                            justifyContent: 'center',
                                            alignItems: 'center',
                                            marginRight: 12,
                                        }}
                                    >
                                        <Text style={{ fontSize: 20 }}>{peer.emoji}</Text>
                                    </View>
                                    <View style={{ flex: 1 }}>
                                        <Text style={{ color: '#26C6DA', fontFamily: 'Lexend_400Regular', fontSize: 15, fontWeight: '600' }}>
                                            {peer.name.length > 20
                                                ? `${peer.name.slice(0, 8)}...${peer.name.slice(-8)}`
                                                : peer.name}
                                        </Text>
                                        <Text style={{ color: '#10B981', fontSize: 11 }}>Online</Text>
                                    </View>
                                    <Text style={{ color: '#26C6DA', fontSize: 20 }}>→</Text>
                                </TouchableOpacity>
                            ))}
                        </>
                    )}
                    </ScrollView>

                    {/* Footer */}
                    <View style={{ padding: 16, borderTopWidth: 1, borderTopColor: '#2a2a2a' }}>
                        <TouchableOpacity
                            onPress={onClose}
                            style={{
                                backgroundColor: '#26C6DA',
                                paddingVertical: 14,
                                borderRadius: 14,
                                alignItems: 'center',
                            }}
                        >
                            <Text
                                style={{
                                    color: '#fff',
                                    fontWeight: '700',
                                    fontFamily: 'monospace',
                                    fontSize: 16,
                                }}
                            >
                                Close Sidebar
                            </Text>
                        </TouchableOpacity>
                    </View>
                </Animated.View>
            </View>
        </Modal>
    );
}

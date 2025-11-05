import React from 'react';
import {
    Animated,
    Dimensions,
    Modal,
    PanResponder,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    TouchableWithoutFeedback,
    View,
} from 'react-native';
import { Channel } from '../../src/types/channels';

interface Props {
    visible: boolean;
    peers: string[];
    onSelectPeer: (peer: string) => void;
    onSelectChannel: (channel: Channel) => void;
    channels: Channel[];
    currentChannel?: Channel | null;
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
    const slideAnim = React.useRef(new Animated.Value(-SIDEBAR_WIDTH)).current;
    const opacityAnim = React.useRef(new Animated.Value(0)).current;
    // Tabs removed: always show peers
    const [activePeer, setActivePeer] = React.useState<string | null>(null);
    const [messagesMap, setMessagesMap] = React.useState<Record<string, { from: 'me' | 'them'; text: string; }[]>>({});
    const [composed, setComposed] = React.useState('');

    // PanResponder to prevent Android back gesture
    const panResponder = React.useRef(
        PanResponder.create({
            onStartShouldSetPanResponder: () => true,
            onMoveShouldSetPanResponder: (evt, gestureState) => {
                // Capture horizontal gestures
                return Math.abs(gestureState.dx) > Math.abs(gestureState.dy);
            },
            onPanResponderGrant: () => {
                // Prevent default
            },
            onPanResponderMove: () => {
                // Do nothing, just capture
            },
            onPanResponderRelease: () => {
                // Do nothing
            },
        })
    ).current;

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
                Animated.timing(slideAnim, { toValue: -SIDEBAR_WIDTH, duration: 250, useNativeDriver: true }),
                Animated.timing(opacityAnim, { toValue: 0, duration: 250, useNativeDriver: true }),
            ]).start();
        }
    }, [visible, slideAnim, opacityAnim]);

    const handleSelectPeer = (peer: string) => {
        // open inline private chat inside the sidebar
        setActivePeer(peer);
        onSelectPeer(peer);

        // seed mock conversation if none
        setMessagesMap((prev) => {
            if (prev[peer]) return prev;
            return {
                ...prev,
                [peer]: [
                    { from: 'them', text: `Hey — this is ${peer}.` },
                    { from: 'me', text: 'Hello! This is a private chat.' },
                ],
            };
        });
    };

    const handleSendMessage = () => {
        if (!activePeer || !composed.trim()) return;
        const text = composed.trim();
        setMessagesMap((prev) => ({
            ...prev,
            [activePeer]: [...(prev[activePeer] || []), { from: 'me', text }],
        }));
        setComposed('');
    };

    // handleCloseChat removed; use setActivePeer(null) directly where needed

    // When returning from a private convo, prefer switching back to the 'general'
    // channel (if present) and keep the sidebar open so the user can continue
    // navigating. Only close as a last resort.
    const handleReturnToGeneral = () => {
        if (onClearPrivate) onClearPrivate();

        const generalChannel = channels.find(
            (c) => (c.name && c.name.toLowerCase() === 'general') || c.id === 'general'
        );

        if (generalChannel) {
            onSelectChannel(generalChannel);
            // Keep the sidebar open so the user can pick another channel or inspect
            // channel details.
            return;
        }

        if (channels.length > 0) {
            onSelectChannel(channels[0]);
            return;
        }

        // Fallback: close sidebar
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
                        left: 0,
                        top: 0,
                        bottom: 0,
                        width: SIDEBAR_WIDTH,
                        backgroundColor: '#121212',
                        transform: [{ translateX: slideAnim }],
                        borderRightWidth: 2,
                        borderRightColor: '#444',
                        shadowColor: '#000',
                        shadowOffset: { width: 3, height: 0 },
                        shadowOpacity: 0.4,
                        shadowRadius: 6,
                    }}
                    pointerEvents="auto"
                    {...panResponder.panHandlers}
                >
                    {/* Header */}
                    <View style={{ paddingTop: 60, paddingHorizontal: 24, paddingBottom: 24, borderBottomWidth: 1, borderBottomColor: '#2a2a2a' }}>
                        <Text style={{ color: '#aaa', fontSize: 13, fontFamily: 'monospace' }}>
                            🛜 {displayPeers.length} peers online
                        </Text>
                        {/* Quick return to general chat (visible whenever in a private convo) */}
                        {currentPrivate ? (
                            <TouchableOpacity
                                onPress={handleReturnToGeneral}
                                style={{
                                    marginTop: 12,
                                    alignSelf: 'flex-start',
                                    paddingVertical: 8,
                                    paddingHorizontal: 12,
                                    borderRadius: 10,
                                    backgroundColor: '#222',
                                    borderWidth: 1,
                                    borderColor: '#444',
                                }}
                            >
                                <Text style={{ color: '#fff', fontFamily: 'monospace', fontWeight: '700' }}>← Back to general</Text>
                            </TouchableOpacity>
                        ) : null}
                    </View>

                    {/* Tabs removed - peers-only sidebar */}

                    {/* Content: peers or inline private chat */}
                    {activePeer ? (
                        <View style={{ flex: 1 }}>
                            <View style={{ padding: 16, borderBottomWidth: 1, borderBottomColor: '#222', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                                <View>
                                    <Text style={{ color: '#26C6DA', fontSize: 16, fontWeight: '700' }}>{activePeer}</Text>
                                    <Text style={{ color: '#999', fontSize: 12 }}>Private conversation</Text>
                                </View>
                                <TouchableOpacity onPress={() => setActivePeer(null)} style={{ padding: 8 }}>
                                    <Text style={{ color: '#fff' }}>← Back</Text>
                                </TouchableOpacity>
                            </View>

                            <ScrollView contentContainerStyle={{ padding: 16, flexGrow: 1 }}>
                                {(messagesMap[activePeer] || []).map((m, i) => (
                                    <View key={i} style={{ marginBottom: 8, alignItems: m.from === 'me' ? 'flex-end' : 'flex-start' }}>
                                        <View style={{ backgroundColor: m.from === 'me' ? '#26C6DA' : '#222', padding: 10, borderRadius: 12, maxWidth: '80%' }}>
                                            <Text style={{ color: m.from === 'me' ? '#000' : '#fff' }}>{m.text}</Text>
                                        </View>
                                    </View>
                                ))}
                            </ScrollView>

                            <View style={{ padding: 12, borderTopWidth: 1, borderTopColor: '#222', flexDirection: 'row', alignItems: 'center' }}>
                                <TextInput
                                    value={composed}
                                    onChangeText={setComposed}
                                    placeholder="Message"
                                    placeholderTextColor="#888"
                                    style={{ flex: 1, color: '#fff', backgroundColor: '#111', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, marginRight: 8 }}
                                />
                                <TouchableOpacity onPress={handleSendMessage} style={{ paddingVertical: 10, paddingHorizontal: 14, backgroundColor: '#26C6DA', borderRadius: 10 }}>
                                    <Text style={{ fontWeight: '700' }}>Send</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    ) : (
                        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 32 }}>
                            {displayPeers.length === 0 ? (
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
                                            onPress={handleReturnToGeneral}
                                            style={{
                                                paddingVertical: 10,
                                                paddingHorizontal: 14,
                                                marginBottom: 12,
                                                borderRadius: 10,
                                                backgroundColor: '#222',
                                                borderWidth: 1,
                                                borderColor: '#444',
                                                alignItems: 'center',
                                                flexDirection: 'row',
                                                justifyContent: 'center',
                                            }}
                                        >
                                            <Text style={{ color: '#fff', fontFamily: 'monospace', fontWeight: '700', marginRight: 8 }}>
                                                ←
                                            </Text>
                                            <Text style={{ color: '#fff', fontFamily: 'monospace', fontWeight: '700' }}>
                                                Back to general
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
                    )}
                </Animated.View>
            </View>
        </Modal>
    );
}

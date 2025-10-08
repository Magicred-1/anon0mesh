import React from 'react';
import { 
    Text, 
    TouchableOpacity, 
    View, 
    Modal, 
    Animated,
    Dimensions,
    TouchableWithoutFeedback,
    ScrollView,
    StyleSheet,
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
}

const { width } = Dimensions.get('window');
const SIDEBAR_WIDTH = width * 0.85;

export default function PrivateSidebar({ visible, peers, channels, currentChannel, onSelectPeer, onSelectChannel, onClose }: Props) {
    const slideAnim = React.useRef(new Animated.Value(SIDEBAR_WIDTH)).current;
    const opacityAnim = React.useRef(new Animated.Value(0)).current;
    const [activeTab, setActiveTab] = React.useState<'channels' | 'peers'>('channels');

    React.useEffect(() => {
        if (visible) {
            Animated.parallel([
                Animated.timing(slideAnim, {
                    toValue: 0,
                    duration: 300,
                    useNativeDriver: true,
                }),
                Animated.timing(opacityAnim, {
                    toValue: 1,
                    duration: 300,
                    useNativeDriver: true,
                }),
            ]).start();
        } else {
            Animated.parallel([
                Animated.timing(slideAnim, {
                    toValue: SIDEBAR_WIDTH,
                    duration: 250,
                    useNativeDriver: true,
                }),
                Animated.timing(opacityAnim, {
                    toValue: 0,
                    duration: 250,
                    useNativeDriver: true,
                }),
            ]).start();
        }
    }, [visible, opacityAnim, slideAnim]);

    const handleSelectPeer = (peer: string) => {
        onSelectPeer(peer);
        onClose();
    };

    return (
        <Modal
            visible={visible}
            transparent
            animationType="none"
            onRequestClose={onClose}
        >
            <View style={{ flex: 1 }}>
                {/* Backdrop */}
                <TouchableWithoutFeedback onPress={onClose}>
                    <Animated.View
                        style={{
                            ...StyleSheet.absoluteFillObject,
                            backgroundColor: '#000',
                            opacity: opacityAnim.interpolate({
                                inputRange: [0, 1],
                                outputRange: [0, 0.7],
                            }),
                        }}
                        pointerEvents={visible ? "auto" : "none"}
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
                        backgroundColor: '#0A0A0A',
                        transform: [{ translateX: slideAnim }], // slide from right
                        borderLeftWidth: 2,
                        borderLeftColor: '#A855F7',
                    }}
                >
                    {/* Header */}
                    <View
                        style={{
                            paddingTop: 60,
                            paddingHorizontal: 20,
                            paddingBottom: 20,
                            borderBottomWidth: 2,
                            borderBottomColor: '#A855F7',
                            backgroundColor: '#0F0F0F',
                        }}
                    >
                        <View
                            style={{
                                flexDirection: 'row',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                            }}
                        >
                            <View>
                                <Text
                                    style={{
                                        color: '#A855F7',
                                        fontWeight: 'bold',
                                        fontSize: 24,
                                        fontFamily: 'Courier',
                                        letterSpacing: 1,
                                    }}
                                >
                                    � Mesh Network
                                </Text>
                                <Text
                                    style={{
                                        color: '#888',
                                        fontSize: 12,
                                        fontFamily: 'Courier',
                                        marginTop: 4,
                                    }}
                                >
                                    {channels.length} channels • {peers.length} peers online
                                </Text>
                            </View>
                            <TouchableOpacity
                                onPress={onClose}
                                style={{
                                    width: 36,
                                    height: 36,
                                    borderRadius: 18,
                                    backgroundColor: '#1A1A1A',
                                    justifyContent: 'center',
                                    alignItems: 'center',
                                    borderWidth: 2,
                                    borderColor: '#A855F7',
                                }}
                            >
                                <Text style={{ color: '#A855F7', fontSize: 20, fontWeight: 'bold' }}>×</Text>
                            </TouchableOpacity>
                        </View>
                    </View>

                        {/* Tab Navigation */}
                        <View style={{
                            flexDirection: 'row',
                            marginTop: 16,
                            backgroundColor: '#1A1A1A',
                            borderRadius: 8,
                            padding: 4,
                            marginHorizontal: 20,
                        }}>
                            <TouchableOpacity
                                onPress={() => setActiveTab('channels')}
                                style={{
                                    flex: 1,
                                    paddingVertical: 8,
                                    paddingHorizontal: 12,
                                    borderRadius: 6,
                                    backgroundColor: activeTab === 'channels' ? '#A855F7' : 'transparent',
                                }}
                            >
                                <Text style={{
                                    color: activeTab === 'channels' ? '#FFFFFF' : '#888888',
                                    fontFamily: 'Courier',
                                    fontSize: 14,
                                    fontWeight: '600',
                                    textAlign: 'center',
                                }}>
                                    Channels
                                </Text>
                            </TouchableOpacity>
                            
                            <TouchableOpacity
                                onPress={() => setActiveTab('peers')}
                                style={{
                                    flex: 1,
                                    paddingVertical: 8,
                                    paddingHorizontal: 12,
                                    borderRadius: 6,
                                    backgroundColor: activeTab === 'peers' ? '#A855F7' : 'transparent',
                                }}
                            >
                                <Text style={{
                                    color: activeTab === 'peers' ? '#FFFFFF' : '#888888',
                                    fontFamily: 'Courier',
                                    fontSize: 14,
                                    fontWeight: '600',
                                    textAlign: 'center',
                                }}>
                                    Peers
                                </Text>
                            </TouchableOpacity>
                        </View>

                        {/* Content Area */}
                        <ScrollView
                            style={{ flex: 1 }}
                            contentContainerStyle={{
                                paddingHorizontal: 16,
                                paddingTop: 16,
                                paddingBottom: 24,
                            }}
                            showsVerticalScrollIndicator={true}
                        >
                            {activeTab === 'channels' ? (
                                // Channels List
                                channels.length === 0 ? (
                                    <View
                                        style={{
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            paddingVertical: 60,
                                        }}
                                    >
                                        <Text style={{ fontSize: 48, marginBottom: 12 }}>💬</Text>
                                        <Text
                                            style={{
                                                color: '#666',
                                                fontFamily: 'Courier',
                                                fontSize: 14,
                                                textAlign: 'center',
                                            }}
                                        >
                                            No channels available
                                        </Text>
                                    </View>
                                ) : (
                                    channels.map((channel, i) => (
                                        <TouchableOpacity
                                            key={channel.id}
                                            onPress={() => {
                                                onSelectChannel(channel);
                                                onClose();
                                            }}
                                            style={{
                                                paddingVertical: 16,
                                                paddingHorizontal: 16,
                                                marginBottom: 12,
                                                borderWidth: 2,
                                                borderColor: currentChannel?.id === channel.id ? '#10B981' : '#A855F7',
                                                borderRadius: 16,
                                                backgroundColor: currentChannel?.id === channel.id ? '#065F46' : '#111111',
                                                flexDirection: 'row',
                                                alignItems: 'center',
                                            }}
                                            activeOpacity={0.7}
                                        >
                                            {/* Channel Icon */}
                                            <View
                                                style={{
                                                    width: 44,
                                                    height: 44,
                                                    borderRadius: 22,
                                                    backgroundColor: currentChannel?.id === channel.id ? '#10B981' : '#A855F7',
                                                    justifyContent: 'center',
                                                    alignItems: 'center',
                                                    marginRight: 12,
                                                }}
                                            >
                                                <Text style={{ fontSize: 20 }}>{channel.icon || '💬'}</Text>
                                            </View>

                                            {/* Channel Info */}
                                            <View style={{ flex: 1 }}>
                                                <Text
                                                    style={{
                                                        color: currentChannel?.id === channel.id ? '#10B981' : '#C084FC',
                                                        fontFamily: 'Courier',
                                                        fontSize: 15,
                                                        fontWeight: '600',
                                                        marginBottom: 2,
                                                    }}
                                                    numberOfLines={1}
                                                >
                                                    #{channel.name}
                                                </Text>
                                                {channel.description && (
                                                    <Text
                                                        style={{
                                                            color: '#888888',
                                                            fontFamily: 'Courier',
                                                            fontSize: 11,
                                                            marginBottom: 4,
                                                        }}
                                                        numberOfLines={2}
                                                    >
                                                        {channel.description}
                                                    </Text>
                                                )}
                                                <View
                                                    style={{
                                                        flexDirection: 'row',
                                                        alignItems: 'center',
                                                    }}
                                                >
                                                    <View
                                                        style={{
                                                            width: 8,
                                                            height: 8,
                                                            borderRadius: 4,
                                                            backgroundColor: channel.isActive ? '#10B981' : '#6B7280',
                                                            marginRight: 6,
                                                        }}
                                                    />
                                                    <Text
                                                        style={{
                                                            color: channel.isActive ? '#10B981' : '#6B7280',
                                                            fontFamily: 'Courier',
                                                            fontSize: 11,
                                                        }}
                                                    >
                                                        {channel.isActive ? 'Active' : 'Inactive'}
                                                    </Text>
                                                </View>
                                            </View>

                                            {/* Current Channel Indicator */}
                                            {currentChannel?.id === channel.id && (
                                                <Text
                                                    style={{
                                                        color: '#10B981',
                                                        fontSize: 20,
                                                        fontWeight: 'bold',
                                                    }}
                                                >
                                                    ✓
                                                </Text>
                                            )}
                                        </TouchableOpacity>
                                    ))
                                )
                            ) : (
                                // Peers List
                                peers.length === 0 ? (
                                    <View
                                        style={{
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            paddingVertical: 60,
                                        }}
                                    >
                                        <Text style={{ fontSize: 48, marginBottom: 12 }}>👥</Text>
                                        <Text
                                            style={{
                                                color: '#666',
                                                fontFamily: 'Courier',
                                                fontSize: 14,
                                                textAlign: 'center',
                                            }}
                                        >
                                            No peers online yet
                                        </Text>
                                    </View>
                                ) : (
                                    peers.map((peer, i) => (
                                        <TouchableOpacity
                                            key={i}
                                            onPress={() => handleSelectPeer(peer)}
                                            style={{
                                                paddingVertical: 16,
                                                paddingHorizontal: 16,
                                                marginBottom: 12,
                                                borderWidth: 2,
                                                borderColor: '#A855F7',
                                                borderRadius: 16,
                                                backgroundColor: '#111111',
                                                flexDirection: 'row',
                                                alignItems: 'center',
                                            }}
                                            activeOpacity={0.7}
                                        >
                                            {/* Avatar */}
                                            <View
                                                style={{
                                                    width: 44,
                                                    height: 44,
                                                    borderRadius: 22,
                                                    backgroundColor: '#A855F7',
                                                    justifyContent: 'center',
                                                    alignItems: 'center',
                                                    marginRight: 12,
                                                }}
                                            >
                                                <Text style={{ fontSize: 20 }}>👤</Text>
                                            </View>

                                            {/* Peer Info */}
                                            <View style={{ flex: 1 }}>
                                                <Text
                                                    style={{
                                                        color: '#C084FC',
                                                        fontFamily: 'Courier',
                                                        fontSize: 15,
                                                        fontWeight: '600',
                                                        marginBottom: 2,
                                                    }}
                                                    numberOfLines={1}
                                                >
                                                    {peer.length > 20
                                                        ? `${peer.slice(0, 8)}...${peer.slice(-8)}`
                                                        : peer}
                                                </Text>
                                                <View
                                                    style={{
                                                        flexDirection: 'row',
                                                        alignItems: 'center',
                                                    }}
                                                >
                                                    <View
                                                        style={{
                                                            width: 8,
                                                            height: 8,
                                                            borderRadius: 4,
                                                            backgroundColor: '#10B981',
                                                            marginRight: 6,
                                                        }}
                                                    />
                                                    <Text
                                                        style={{
                                                            color: '#10B981',
                                                            fontFamily: 'Courier',
                                                            fontSize: 11,
                                                        }}
                                                    >
                                                        Online
                                                    </Text>
                                                </View>
                                            </View>

                                            {/* Arrow */}
                                            <Text
                                                style={{
                                                    color: '#A855F7',
                                                    fontSize: 20,
                                                    fontWeight: 'bold',
                                                }}
                                            >
                                                →
                                            </Text>
                                        </TouchableOpacity>
                                    ))
                                )
                            )}
                        </ScrollView>

                        {/* Footer */}
                        <View
                            style={{
                                paddingHorizontal: 16,
                                paddingVertical: 20,
                                paddingBottom: 40,
                                borderTopWidth: 2,
                                borderTopColor: '#A855F7',
                                backgroundColor: '#0F0F0F',
                            }}
                        >
                            <TouchableOpacity
                                onPress={onClose}
                                style={{
                                    backgroundColor: '#A855F7',
                                    paddingVertical: 14,
                                    borderRadius: 14,
                                    justifyContent: 'center',
                                    alignItems: 'center',
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
                                    Close Sidebar
                                </Text>
                            </TouchableOpacity>
                        </View>
                    </Animated.View>
                </View>
            </Modal>
        );
    }

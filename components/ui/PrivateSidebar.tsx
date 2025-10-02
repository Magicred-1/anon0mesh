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

interface Props {
    visible: boolean;
    peers: string[];
    onSelectPeer: (peer: string) => void;
    onClose: () => void;
}

const { width } = Dimensions.get('window');
const SIDEBAR_WIDTH = width * 0.85;

export default function PrivateSidebar({ visible, peers, onSelectPeer, onClose }: Props) {
    const slideAnim = React.useRef(new Animated.Value(SIDEBAR_WIDTH)).current;
    const opacityAnim = React.useRef(new Animated.Value(0)).current;

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
    }, [visible]);

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
                                    💬 Private Chats
                                </Text>
                                <Text
                                    style={{
                                        color: '#888',
                                        fontSize: 12,
                                        fontFamily: 'Courier',
                                        marginTop: 4,
                                    }}
                                >
                                    {peers.length} {peers.length === 1 ? 'peer' : 'peers'} online
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

                    {/* Peers List */}
                    <ScrollView
                        style={{ flex: 1 }}
                        contentContainerStyle={{
                            paddingHorizontal: 16,
                            paddingTop: 16,
                            paddingBottom: 24,
                        }}
                        showsVerticalScrollIndicator={false}
                    >
                        {peers.length === 0 ? (
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

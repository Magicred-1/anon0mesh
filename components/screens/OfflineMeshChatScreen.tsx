import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
    Alert,
    Animated,
    Dimensions,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useChannels } from '../../src/contexts/ChannelContext';
import { BeaconCapabilities } from '../../src/solana/BeaconManager';
import { RateLimitManager } from '../../src/utils/RateLimitManager';
import { useMeshNetworking } from '../networking/MeshNetworkingManager';
import BLEPermissionRequest from '../ui/BLEPermissionRequest';
import BLEStatusIndicator from '../ui/BLEStatusIndicator';
import BackgroundMeshStatusIndicator from '../ui/BackgroundMeshStatusIndicator';
import EditNicknameModal from '../ui/EditNicknameModal';
import Header from '../ui/Header';
import { MeshBackground } from '../ui/MeshBackground';
import MessageInput from '../ui/MessageInput';
import MessageList, { Message } from '../ui/MessageList';
import WalletScreen from './WalletScreen';

const SCREEN_WIDTH = Dimensions.get('window').width;

interface OfflineMeshChatScreenProps {
    pubKey: string;
    nickname: string;
    onNicknameChange?: (newNickname: string) => void;
    onBackToIndex?: () => void;
}

interface PeerInfo {
    id: string;
    nickname: string;
    lastSeen: number;
    isOnline: boolean;
}

const OfflineMeshChatScreen: React.FC<OfflineMeshChatScreenProps> = ({
    pubKey,
    nickname: initialNickname,
    onNicknameChange,
    onBackToIndex,
}) => {
    const [messages, setMessages] = useState<Message[]>([]);
    const [activePeers, setActivePeers] = useState<PeerInfo[]>([]);
    const [selectedPeer, setSelectedPeer] = useState<string | null>(null);
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [receiveMoneyVisible, setReceiveMoneyVisible] = useState(false);
    const [editNicknameVisible, setEditNicknameVisible] = useState(false);
    const [nickname, setNickname] = useState(initialNickname);
    const [bleStats, setBleStats] = useState({ connectedDevices: 0, isScanning: false });
    const [bleAvailable, setBleAvailable] = useState(true);
    const [rateLimitManager] = useState(() => new RateLimitManager(pubKey));
    const [messagesRemaining, setMessagesRemaining] = useState<number>(3);
    const [isUnlocked, setIsUnlocked] = useState<boolean>(false);

    // Channel management
    const { channels, currentChannel, setCurrentChannel } = useChannels();

    // Generate stable random number for this session (persists across nickname changes)
    const [randomNumber] = useState(() => Math.floor(1000 + Math.random() * 9000));

    // Generate display nickname with the stable random number
    const displayNickname = `${nickname || 'AliceAndBob'}#${randomNumber}`;

    // Full display name for header
    const fullDisplayName = `${displayNickname}`;

    // Get safe area insets to calculate proper header height
    const insets = useSafeAreaInsets();
    
    // Calculate header height: safe area top + padding + content height (refined, more compact)
    const headerHeight = insets.top + 14 + 46;

    // Sidebar animation - starts off-screen to the right
    const slideAnim = useRef(new Animated.Value(SCREEN_WIDTH * 0.6)).current;

    // Use display nickname (with #number) for messages - this is what gets stored in messages
    const currentUser = displayNickname;

    // Handle incoming messages
    const handleMessageReceived = useCallback((messageData: any) => {
        const newMessage: Message = {
        from: messageData.from,
        to: messageData.to,
        msg: messageData.message,
        ts: messageData.timestamp,
        };

        setMessages(prev => [...prev, newMessage].slice(-100)); // Keep last 100 messages

        // Update peer list if it's a new peer
        if (messageData.from !== nickname) {
        setActivePeers(prev => {
            const existing = prev.find(p => p.id === messageData.from);
            if (existing) {
            return prev.map(p => 
                p.id === messageData.from 
                ? { ...p, lastSeen: Date.now(), isOnline: true }
                : p
            );
            } else {
            return [...prev, {
                id: messageData.from,
                nickname: messageData.from,
                lastSeen: Date.now(),
                isOnline: true,
            }];
            }
        });
        }
    }, [nickname]);

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

    // --- Mock data for demo mode ---
    // Seed mock messages when there are no messages yet
    useEffect(() => {
        if (messages.length === 0) {
            const demoMsgs: Message[] = [
                { from: 'Alice', msg: 'Hey there! Welcome to the mesh chat 👋', ts: Date.now() - 120000 },
                { from: 'Bob', msg: 'This is a mock conversation to showcase the UI.', ts: Date.now() - 90000 },
                { from: currentUser, msg: "Hey, I'm testing offline mesh chat! 🚀", ts: Date.now() - 60000 },
            ];
            setMessages(demoMsgs);
        }
    }, [currentUser, messages.length]);

    // Seed mock peers when none are present (use generateMockPeers helper)
    useEffect(() => {
        if (activePeers.length === 0) {
            const now = Date.now();
            const generated = generateMockPeers(6);
            const demoPeers: PeerInfo[] = generated.map((p, i) => ({
                id: p.name,
                nickname: p.name,
                // Spread lastSeen times so some appear recently online
                lastSeen: now - Math.floor(Math.random() * 10) * 60000,
                isOnline: Math.random() > 0.3,
            }));
            setActivePeers(demoPeers);
        }
    }, [activePeers.length]);

    // Initialize mesh networking with offline focus
    const offlineCaps: BeaconCapabilities = {
        hasInternetConnection: false,
        supportedNetworks: [],
        supportedTokens: [],
        maxTransactionSize: 0,
        priorityFeeSupport: false,
        rpcEndpoints: [],
        lastOnlineTimestamp: 0,
    };

    const meshNetworking = useMeshNetworking(
        pubKey,
        displayNickname, // Use display nickname with #number for mesh networking
        handleMessageReceived,
        undefined, // No transaction handling for offline mode
        undefined, // No transaction status updates
        undefined, // No Solana connection
        offlineCaps,
    );

    // Use ref to store mesh networking to avoid dependency issues
    const meshNetworkingRef = useRef(meshNetworking);
    meshNetworkingRef.current = meshNetworking;

    const toggleSidebar = () => {
        // Animate translateX: 0 = visible, SCREEN_WIDTH * 0.6 = hidden off-screen to the right
        const toValue = sidebarOpen ? SCREEN_WIDTH * 0.6 : 0;
        Animated.timing(slideAnim, {
        toValue,
        duration: 300,
        useNativeDriver: true, // Use native driver for better performance
        }).start();
        setSidebarOpen((prev) => !prev);
    };

    const handleWalletPress = () => {
        setReceiveMoneyVisible(true);
    };

    const handleNicknameEdit = () => {
        setEditNicknameVisible(true);
    };

    const handleNicknameSave = (newNickname: string) => {
        setNickname(newNickname);
        // Update mesh networking with the display nickname (including #number)
        const newDisplayNickname = `${newNickname}#${randomNumber}`;
        meshNetworking.updateNickname(newDisplayNickname);
        if (onNicknameChange) {
            onNicknameChange(newNickname);
        }
        // Announce presence with new display nickname
        setTimeout(() => {
            meshNetworking.announcePresence();
        }, 500);
    };

    // Send message through P2P mesh
    const sendMessage = async (msg: string) => {
        if (!msg.trim()) return;

        // Check rate limit before sending
        try {
            const canSend = await rateLimitManager.canSendMessage();
            if (!canSend) {
                const timeRemaining = await rateLimitManager.getTimeUntilReset();
                Alert.alert(
                    '📨 Daily Message Limit Reached',
                    `You've reached your daily limit of 3 messages.\n\n` +
                    `💡 Tip: Send a Solana transaction to unlock unlimited messaging!\n\n` +
                    `Limit resets in: ${timeRemaining}`,
                    [{ text: 'OK' }]
                );
                return;
            }
        } catch (err) {
            console.warn('[RATE_LIMIT] check failed, allowing send by default', err);
        }

        const targetPeer = selectedPeer;

        // Use offline messaging method with zone-based TTL
        const ttl = currentChannel?.ttl || 5;
        meshNetworking.sendOfflineMessage(msg.trim(), targetPeer || undefined, ttl, currentChannel?.id);

        // Record the message send
        try {
            await rateLimitManager.recordMessageSent();
            const status = await rateLimitManager.getStatus();
            setMessagesRemaining(status.messagesRemaining === Infinity ? Number.MAX_SAFE_INTEGER : status.messagesRemaining);
            setIsUnlocked(status.isUnlocked);
        } catch (err) {
            console.warn('[RATE_LIMIT] failed to record message sent', err);
        }

        // Add to our local message list
        const newMessage: Message = {
            from: currentUser,
            to: targetPeer || undefined,
            msg: msg.trim(),
            ts: Date.now(),
        };

        setMessages(prev => [...prev, newMessage]);
    };

    // Mark peers as offline after 5 minutes of inactivity
    useEffect(() => {
        const interval = setInterval(() => {
        const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
        setActivePeers(prev => 
            prev.map(peer => ({
            ...peer,
            isOnline: peer.lastSeen > fiveMinutesAgo
            }))
        );
        }, 30000); // Check every 30 seconds

        return () => clearInterval(interval);
    }, []);

    // Auto-announce presence every 2 minutes
    useEffect(() => {
        const interval = setInterval(() => {
        meshNetworkingRef.current.announcePresence();
        }, 120000);

        return () => clearInterval(interval);
    }, []); // Empty dependency array is safe since we use ref

    // Load rate limit status on mount
    useEffect(() => {
        const load = async () => {
            try {
                const status = await rateLimitManager.getStatus();
                setMessagesRemaining(status.messagesRemaining === Infinity ? Number.MAX_SAFE_INTEGER : status.messagesRemaining);
                setIsUnlocked(status.isUnlocked);
            } catch (err) {
                console.warn('[RATE_LIMIT] failed to load status', err);
            }
        };
        load();
    }, [rateLimitManager]);

    // Update BLE stats periodically
    useEffect(() => {
        const updateStats = () => {
            try {
                const stats = meshNetworkingRef.current.getBLEStats();
                if (stats) {
                    setBleStats(stats);
                }
                
                // Check if BLE is available
                const available = meshNetworkingRef.current.isBLEAvailable();
                if (available !== undefined) {
                    setBleAvailable(available);
                }
            } catch (error) {
                console.warn('[UI] Error getting BLE stats:', error);
            }
        };

        // Initial check
        updateStats();

        const interval = setInterval(updateStats, 5000); // Update every 5 seconds
        
        return () => clearInterval(interval);
    }, []); // Empty dependency array is safe since we use ref

    // Get list of peer names for the sidebar
    const peers = activePeers.filter(p => p.isOnline).map(p => p.nickname);

    return (
        <MeshBackground>
            <View style={{ flex: 1 }}>
            {/* Header with Zone Selector */}
            <Header 
                pubKey={pubKey} 
                nickname={nickname}
                displayNickname={fullDisplayName}
                toggleSidebar={toggleSidebar} 
                onWalletPress={handleWalletPress}
                onNicknameEdit={handleNicknameEdit}
            />

        {/* Private sidebar (slides from RIGHT) - Full height */}
        <Animated.View
            style={{
            position: 'absolute',
            top: 0, // Start from the very top for full height
            bottom: 0,
            right: 0, // Position at the right edge
            width: SCREEN_WIDTH * 0.6,
            backgroundColor: '#1a1a1a',
            zIndex: 10,
            borderLeftWidth: 1,
            borderColor: '#444444',
            paddingTop: headerHeight + 20, // Add top padding to account for header
            paddingHorizontal: 16,
            paddingBottom: 20,
            transform: [{ translateX: slideAnim }], // Use transform for smooth animation
            }}
        >
            {/* Simple Sidebar Content */}
            <View style={{ flex: 1 }}>
            <TouchableOpacity
                onPress={toggleSidebar}
                style={{
                alignSelf: 'flex-end',
                padding: 8,
                backgroundColor: '#333',
                borderRadius: 4,
                marginBottom: 20,
                }}
            >
                <Text style={{ color: '#FFFFFF' }}>✕</Text>
            </TouchableOpacity>

            {/* BLE Permission Request */}
            <BLEPermissionRequest />

            {/* BLE Status */}
            <BLEStatusIndicator
                isConnected={bleStats.connectedDevices > 0}
                connectedDevices={bleStats.connectedDevices}
                isScanning={bleStats.isScanning}
                bleAvailable={bleAvailable}
            />

            {/* Background Mesh Status */}
            <BackgroundMeshStatusIndicator
                getBackgroundStatus={() => meshNetworking.getBackgroundMeshStatus() || Promise.resolve({ isActive: false, relayEnabled: false, gossipEnabled: false, backgroundFetchStatus: 'available' })}
            />

            {/* Rate limit status */}
            <View style={{ paddingVertical: 12, borderTopWidth: 1, borderTopColor: '#222', marginTop: 12 }}>
                <Text style={{ color: '#C084FC', fontFamily: 'Courier', fontSize: 12, marginBottom: 4 }}>Messages</Text>
                {isUnlocked ? (
                    <Text style={{ color: '#10B981', fontSize: 12 }}>Unlimited for today (unlocked)</Text>
                ) : (
                    <Text style={{ color: '#AAAAAA', fontSize: 12 }}>{messagesRemaining} messages remaining today</Text>
                )}
            </View>

            {peers.length > 0 ? (
                peers.map((peer, index) => (
                <TouchableOpacity
                    key={index}
                    onPress={() => {
                    setSelectedPeer(peer);
                    toggleSidebar();
                    }}
                    style={{
                    padding: 12,
                    backgroundColor: selectedPeer === peer ? '#444' : 'transparent',
                    borderRadius: 8,
                    marginBottom: 8,
                    }}
                >
                    <Text style={{ color: '#FFFFFF' }}>{peer}</Text>
                </TouchableOpacity>
                ))
            ) : (
                <Text style={{ color: '#888', fontStyle: 'italic' }}>
                No peers online
                </Text>
            )}
            </View>
        </Animated.View>

        {/* Messages Area - Clean and minimal */}
        <View style={{ flex: 1, backgroundColor: '#0f0f0f' }}>
            <MessageList
            messages={messages.filter((m) =>
                selectedPeer ? (m.to === selectedPeer || m.from === selectedPeer) : !m.to
            )}
            currentUser={currentUser}
            showUsername={true}
            />
        </View>

        {/* Backdrop overlay when sidebar is open */}
        {sidebarOpen && (
            <TouchableOpacity
            onPress={toggleSidebar}
            style={{
                position: 'absolute',
                top: 0,
                bottom: 0,
                left: 0,
                right: SCREEN_WIDTH * 0.6, // Leave space for sidebar
                backgroundColor: 'rgba(0, 0, 0, 0.5)',
                zIndex: 8,
            }}
            activeOpacity={1}
            />
        )}

        {/* Right edge swipe area to open sidebar - Full height */}
        {!sidebarOpen && (
            <TouchableOpacity
            onPress={toggleSidebar}
            style={{
                position: 'absolute',
                top: 0, // Full height from top
                bottom: 0,
                right: 0,
                width: 30, // Slightly wider for easier access
                backgroundColor: 'transparent',
                zIndex: 5,
            }}
            activeOpacity={1}
            />
        )}

        {/* Input */}
        <MessageInput
            onSend={sendMessage}
            placeholder={selectedPeer ? `Message ${selectedPeer}` : 'Type message...'}
        />

        {/* Wallet Screen */}
        <WalletScreen
            visible={receiveMoneyVisible}
            onClose={() => setReceiveMoneyVisible(false)}
            pubKey={pubKey}
            nickname={nickname}
        />

        {/* Edit Nickname Modal */}
        <EditNicknameModal
                    visible={editNicknameVisible}
                    currentNickname={nickname}
                    onSave={handleNicknameSave}
                    onClose={() => setEditNicknameVisible(false)} pubKey={pubKey}        />
        </View>
        </MeshBackground>
    );
};

export default OfflineMeshChatScreen;
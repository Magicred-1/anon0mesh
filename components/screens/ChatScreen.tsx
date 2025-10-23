import React, { useEffect, useRef, useState } from 'react';
import { Alert, Animated, Dimensions, View } from 'react-native';

import { Channel } from '@/src/types/channels';
import { RateLimitManager } from '@/src/utils/RateLimitManager';
import Header from '../ui/Header';
import MessageInput from '../ui/MessageInput';
import MessageList, { Message } from '../ui/MessageList';
import NicknameInput from '../ui/NicknameInput';
import PrivateSidebar from '../ui/PrivateSidebar';

const SCREEN_WIDTH = Dimensions.get('window').width;
const DAILY_MESSAGE_LIMIT = 3;

const MOCKUP_MODE = process.env.EXPO_PUBLIC_MOCKUP_MODE === 'true';

type ChatScreenProps = {
    pubKey: string;
    nickname: string;
    updateNickname: (newName: string) => Promise<void> | void;
};

const ChatScreen: React.FC<ChatScreenProps> = ({ pubKey, nickname, updateNickname }) => {
    const [messages, setMessages] = useState<Message[]>([]);
    const [privateTarget, setPrivateTarget] = useState<string | null>(null);
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [rateLimitManager] = useState(() => new RateLimitManager(pubKey));
    const [messagesRemaining, setMessagesRemaining] = useState<number>(DAILY_MESSAGE_LIMIT);
    const [isUnlocked, setIsUnlocked] = useState<boolean>(false);

    // Right offset animated; start hidden to the right
    const slideAnim = useRef(new Animated.Value(SCREEN_WIDTH * 0.6)).current;

    const currentUser = nickname && nickname.trim() ? nickname : pubKey.slice(0, 8);

    const peers = Array.from(
        new Set(messages.map((m) => m.from).filter((f) => f !== currentUser))
    );

    // Load rate limit status on mount and after each message
    useEffect(() => {
        const loadRateLimitStatus = async () => {
            const status = await rateLimitManager.getStatus();
            setMessagesRemaining(status.messagesRemaining);
            setIsUnlocked(status.isUnlocked);
        };
        loadRateLimitStatus();
    }, [rateLimitManager]);

    useEffect(() => {
        // Seed some mock messages by default when the chat is empty.
        // If real messages are already present, do not overwrite them.
        if (messages.length === 0) {
            const mockMsgs: Message[] = [
                { from: 'Alice', msg: 'Hey there! Welcome to the chat 👋', ts: Date.now() - 100000 },
                { from: 'Bob', msg: 'Hi Alice, nice to see you here!', ts: Date.now() - 90000 },
                { from: currentUser, msg: 'Hello everyone, I just joined 🚀', ts: Date.now() - 80000 },
            ];
            setMessages(mockMsgs);
        }
    }, [currentUser, messages.length]);

    const toggleSidebar = () => {
        const toValue = sidebarOpen ? SCREEN_WIDTH * 0.6 : 0;
        Animated.timing(slideAnim, {
        toValue,
        duration: 250,
        useNativeDriver: false,
        }).start();
        setSidebarOpen((prev) => !prev);
    };

    const sendMessage = (msg: string) => {
        console.log('[CHAT] sendMessage called with:', msg);
        if (!msg.trim()) return;
        
        console.log('[CHAT] Checking rate limit...');
        
        // Check rate limit before sending
        rateLimitManager.canSendMessage().then(async (canSend) => {
            console.log('[CHAT] canSend result:', canSend);
            
            if (!canSend) {
                console.log('[CHAT] BLOCKED - showing alert');
                const timeRemaining = await rateLimitManager.getTimeUntilReset();
                
                Alert.alert(
                    '📨 Daily Message Limit Reached',
                    `You've reached your daily limit of ${DAILY_MESSAGE_LIMIT} messages.\n\n` +
                    `💡 Tip: Send a Solana transaction to unlock unlimited messaging!\n\n` +
                    `Limit resets in: ${timeRemaining}`,
                    [{ text: 'OK' }]
                );
                return;
            }
            
            console.log('[CHAT] ALLOWED - creating message payload');
            
            const payload: Message = {
                from: currentUser,
                to: privateTarget || undefined,
                msg,
                ts: Date.now(),
            };

            // Record the message send
            console.log('[CHAT] Recording message sent...');
            const recorded = await rateLimitManager.recordMessageSent();
            console.log('[CHAT] Record result:', recorded);
            
            // Update rate limit status
            const status = await rateLimitManager.getStatus();
            console.log('[CHAT] Rate limit status:', status);
            setMessagesRemaining(status.messagesRemaining);
            setIsUnlocked(status.isUnlocked);
            
            console.log('[CHAT] Adding message to state');
            setMessages((prev) => [...prev, payload]);

            if (MOCKUP_MODE) {
                console.log('[MOCKUP] Message sent:', payload);
            }
            // Real implementation would send payload to backend/P2P here
        }).catch(error => {
            console.error('[CHAT] Rate limit check failed:', error);
        });
    };

    const handleWalletPress = () => {
        console.log('Wallet pressed in ChatScreen');
    };

    return (
        <View style={{ flex: 1, backgroundColor: '#212122' }}>
        {/* Header */}
        <Header 
            pubKey={pubKey} 
            nickname={nickname} 
            toggleSidebar={toggleSidebar} 
            onWalletPress={handleWalletPress}
        />

        {/* Private sidebar (slides from RIGHT) */}
        <Animated.View
            style={{
            position: 'absolute',
            top: 0,
            bottom: 0,
            right: -slideAnim,
            width: SCREEN_WIDTH * 0.6,
            backgroundColor: '#0A0A0A',
            zIndex: 10,
            borderLeftWidth: 2,
            borderColor: '#A855F7',
            shadowOffset: { width: -2, height: 0 },
            shadowOpacity: 0.8,
            shadowRadius: 8,
            }}
        >
            <PrivateSidebar
                    peers={peers}
                    onSelectPeer={(peer) => {
                        setPrivateTarget(peer);
                        toggleSidebar();
                    }}
                    onClose={toggleSidebar}
                    visible={sidebarOpen}
                    currentPrivate={privateTarget}
                    onClearPrivate={() => setPrivateTarget(null)}
                    channels={[]}
                    currentChannel={null}
                    onSelectChannel={(channel: Channel) => {
                        console.log('[CHAT] selected channel', channel);
                        // Future: navigate to channel or set currentChannel
                    }}
            />
        </Animated.View>

        {/* Nickname input */}
        <NicknameInput onSave={updateNickname} pubKey={pubKey} />

        {/* Messages */}
        <MessageList
            messages={messages.filter((m) =>
            privateTarget ? (m.to === privateTarget || m.from === privateTarget) : !m.to
            )}
            currentUser={currentUser}
            showUsername={true}
        />

        {/* Input */}
        <MessageInput
                onSend={sendMessage}
                placeholder={privateTarget ? `Message ${privateTarget}` : 'Type a message...'}
                messagesRemaining={messagesRemaining}
                isUnlocked={isUnlocked}
        />
        </View>
    );
};

export default ChatScreen;
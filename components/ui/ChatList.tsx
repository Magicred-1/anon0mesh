import React, { useRef, useState } from 'react';
import { Animated, Dimensions, View } from 'react-native';
import Header from './Header';
import MessageInput from './MessageInput';
import MessageList, { Message } from './MessageList';
import NicknameInput from './NicknameInput';
import PrivateSidebar from './PrivateSidebar';
import { Channel } from '@/src/types/channels';

const SCREEN_WIDTH = Dimensions.get('window').width;

interface Props {
    messages: Message[];
    pubKey: string;
    nickname: string;
    updateNickname: (name: string) => void;
}

export default function ChatScreen({ pubKey, nickname, updateNickname }: Props) {
    const [messages, setMessages] = useState<Message[]>([]);
    const [privateTarget, setPrivateTarget] = useState<string | null>(null);
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const slideAnim = useRef(new Animated.Value(-SCREEN_WIDTH * 0.6)).current;

    const peers = Array.from(new Set(messages.map(m => m.from).filter(f => f !== (nickname || pubKey.slice(0,8)))));

    const toggleSidebar = () => {
        Animated.timing(slideAnim, {
        toValue: sidebarOpen ? -SCREEN_WIDTH * 0.6 : 0,
        duration: 250,
        useNativeDriver: false
        }).start();
        setSidebarOpen(!sidebarOpen);
    };

    const sendMessage = (msg: string) => {
        const fromName = nickname || pubKey.slice(0,8);
        const payload: Message = {
        from: fromName,
        to: privateTarget || undefined,
        msg,
        ts: Date.now()
        };
        setMessages(prev => [...prev, payload]);
        console.log('[ExpoGo] Simulated broadcast:', payload);
    };

    const handleWalletPress = () => {
        console.log('Wallet pressed in ChatList - not implemented');
    };

    return (
        <View style={{ flex:1, backgroundColor:'#000000' }}>
        <Header 
            pubKey={pubKey} 
            nickname={nickname} 
            toggleSidebar={toggleSidebar}
            onWalletPress={handleWalletPress}
        />
        <Animated.View style={{
            position:'absolute', top:0, bottom:0,
            left:slideAnim, width:SCREEN_WIDTH * 0.6,
            backgroundColor:'#0A0A0A', zIndex:10,
            borderRightWidth: 2,
            borderColor: '#A855F7',
            shadowOffset: { width: 2, height: 0 },
            shadowOpacity: 0.8,
            shadowRadius: 8,
        }}>
            <PrivateSidebar
                    peers={peers}
                    onSelectPeer={(peer) => { setPrivateTarget(peer); toggleSidebar(); } }
                    onClose={toggleSidebar} visible={false} channels={[]} currentChannel={null} onSelectChannel={function (channel: Channel): void {
                        throw new Error('Function not implemented.');
                    } }        />
        </Animated.View>
        <NicknameInput onSave={updateNickname} />
        <MessageList
            messages={messages.filter(m => privateTarget ? (m.to===privateTarget || m.from===privateTarget) : !m.to)}
            currentUser={nickname}
        />
        <MessageInput
                onSend={sendMessage}
                placeholder={privateTarget ? `Message ${privateTarget}` : "Type a message..."} onSendAsset={function (asset: string, amount: string, address: string): void {
                    throw new Error('Function not implemented.');
                } }        />
        </View>
    );
}
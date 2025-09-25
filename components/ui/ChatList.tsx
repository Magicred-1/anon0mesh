import React, { useRef, useState } from 'react';
import { Animated, Dimensions, View } from 'react-native';
import Header from './Header';
import MessageInput from './MessageInput';
import MessageList, { Message } from './MessageList';
import NicknameInput from './NicknameInput';
import PrivateSidebar from './PrivateSidebar';

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

    return (
        <View style={{ flex:1, backgroundColor:'#121212' }}>
        <Header pubKey={pubKey} nickname={nickname} toggleSidebar={toggleSidebar} />
        <Animated.View style={{
            position:'absolute', top:0, bottom:0,
            left:slideAnim, width:SCREEN_WIDTH * 0.6,
            backgroundColor:'#1A1A1A', zIndex:10
        }}>
            <PrivateSidebar
            peers={peers}
            onSelectPeer={(peer)=>{ setPrivateTarget(peer); toggleSidebar(); }}
            onClose={toggleSidebar}
            />
        </Animated.View>
        <NicknameInput onSave={updateNickname} />
        <MessageList
            messages={messages.filter(m => privateTarget ? (m.to===privateTarget || m.from===privateTarget) : !m.to)}
            currentUser={nickname}
        />
        <MessageInput
            onSend={sendMessage}
            placeholder={privateTarget ? `Message ${privateTarget}` : "Type a message..."}
        />
        </View>
    );
}

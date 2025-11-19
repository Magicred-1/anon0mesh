import ChatSelectionScreen from "@/components/screens/ChatSelectionScreen";
import { useRouter } from "expo-router";

const ChatSelectionPage = () => {
    const router = useRouter();

    return (
        <ChatSelectionScreen 
            onSelectPeer={(peerId) => {
                console.log("Selected peer:", peerId);
                // Navigate back to chat with selected peer
                router.back();
            }}
            onNavigateToMessages={() => router.push('/chat/index' as any)}
            onNavigateToWallet={() => router.push('/wallet/index' as any)}
            onNavigateToHistory={() => router.push('/wallet/history' as any)}
            onNavigateToMeshZone={() => router.push('/zone/index' as any)}
            onNavigateToProfile={() => router.push('/profile')}
            onDisconnect={() => {
                console.log('Disconnect requested');
                router.push('/landing' as any);
            }}
        />
    );
};

export default ChatSelectionPage;

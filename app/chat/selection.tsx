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
            onNavigateToMessages={() => router.push('/chat')}
            onNavigateToWallet={() => router.push('/wallet')}
            onNavigateToHistory={() => router.push('/wallet/history')}
            onNavigateToMeshZone={() => router.push('/zone')}
            onNavigateToProfile={() => router.push('/profile')}
            onDisconnect={() => {
                console.log('Disconnect requested');
                router.push('/landing' as any);
            }}
        />
    );
};

export default ChatSelectionPage;

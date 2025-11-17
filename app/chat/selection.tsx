import ChatSelectionScreen from "@/components/screens/ChatSelectionScreen";
import { useRouter } from "expo-router";

const ChatSelectionPage = () => {
    const router = useRouter();

    return <ChatSelectionScreen onSelectPeer={(peerId) => {
        console.log("Selected peer:", peerId);
        // Navigate back to chat with selected peer
        router.back();
    }} onNavigateToMessages={() => router.push("/chat" as any)} 
    onNavigateToWallet={() => router.push("/wallet/" as any)} 
    onNavigateToHistory={() => router.push("/history" as any)} 
    onNavigateToMeshZone={() => router.push("/zone" as any)}
    onNavigateToProfile={() => router.push("/profile" as any)}
    onDisconnect={() => {
        console.log("Disconnect");
        router.push("/landing" as any);
    }} />;
    
};

export default ChatSelectionPage;
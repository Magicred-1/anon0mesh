import ChatSelectionScreen from "@/components/screens/ChatSelectionScreen";
import { useRouter } from "expo-router";

export default function ChatSelectionPage() {
  const router = useRouter();

  return (
    <ChatSelectionScreen
      onSelectPeer={(peerId) => {
        console.log("Selected peer:", peerId);
        // Navigate to chat with selected peer (null = broadcast to all)
        // Use "null" string for broadcast to ensure consistent handling
        router.push({
          pathname: "/chat",
          params: peerId ? { selectedPeer: peerId } : { selectedPeer: "null" },
        });
      }}
      onNavigateToMessages={() => router.push({ pathname: "/chat" })}
      onNavigateToWallet={() => router.push("/wallet")}
      onNavigateToHistory={() => router.push("/wallet/history")}
      onNavigateToMeshZone={() => router.push("/zone")}
      onNavigateToProfile={() => router.push("/profile")}
      onDisconnect={() => {
        console.log("Disconnect requested");
        router.push("/landing" as any);
      }}
    />
  );
}

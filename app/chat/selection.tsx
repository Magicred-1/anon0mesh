import ChatSelectionScreen from "@/components/screens/ChatSelectionScreen";
import { useRouter } from "expo-router";

export default function ChatSelectionPage() {
  const router = useRouter();

  return (
    <ChatSelectionScreen
      onSelectPeer={(peerId) => {
        console.log("Selected peer:", peerId);
        // Navigate to chat with selected peer (or "broadcast" for all peers)
        router.push({
          pathname: "/chat",
          params: { selectedPeer: peerId },
        });
      }}
      onNavigateToMessages={() => router.push({ pathname: "/chat", params: { selectedPeer: "broadcast" } })}
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

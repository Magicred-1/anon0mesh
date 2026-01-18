import ChatScreen from "@/components/screens/ChatScreen";
import { useLocalSearchParams } from "expo-router";

export default function ChatPage() {
  const { selectedPeer } = useLocalSearchParams<{ selectedPeer?: string }>();

  return <ChatScreen initialSelectedPeer={selectedPeer || null} />;
}

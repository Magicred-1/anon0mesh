import MeshChatScreen from "@/components/screens/ChatScreen";
import { useLocalSearchParams } from "expo-router";

export default function ChatPage() {
  const { selectedPeer } = useLocalSearchParams<{ selectedPeer?: string }>();

  // Handle the string "null" or "undefined" that may come from route params
  const normalizedPeer =
    selectedPeer && selectedPeer !== "null" && selectedPeer !== "undefined"
      ? selectedPeer
      : null;

  return <MeshChatScreen initialSelectedPeer={normalizedPeer} />;
}

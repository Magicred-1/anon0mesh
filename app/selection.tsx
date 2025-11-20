import ChatSelectionScreen from '@/components/screens/ChatSelectionScreen';
import { useRouter } from 'expo-router';

export default function Selection() {
    const router = useRouter();

    return (
        <ChatSelectionScreen
        onSelectPeer={(peerId) => {
            console.log('Selected peer:', peerId);
            // Navigate back to chat with selected peer
            router.back();
        }}
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
}

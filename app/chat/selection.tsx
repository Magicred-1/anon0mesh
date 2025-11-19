import EditNicknameModal from "@/components/modals/EditNicknameModal";
import ChatSelectionScreen from "@/components/screens/ChatSelectionScreen";
import { WalletFactory } from '@/src/infrastructure/wallet';
import { useRouter } from "expo-router";
import * as SecureStore from 'expo-secure-store';
import { useEffect, useState } from "react";

const ChatSelectionPage = () => {
    const router = useRouter();
    const [showEditNickname, setShowEditNickname] = useState(false);
    const [nickname, setNickname] = useState('');
    const [pubKey, setPubKey] = useState('');

    // Load nickname and pubkey on mount
    useEffect(() => {
        (async () => {
            try {
                const storedNickname = await SecureStore.getItemAsync('nickname');
                setNickname(storedNickname || 'Anonymous');

                const walletAdapter = await WalletFactory.createAuto();
                const publicKey = await walletAdapter.getPublicKey();
                setPubKey(publicKey?.toString() || '');
            } catch (error) {
                console.error('[ChatSelection] Error loading user data:', error);
            }
        })();
    }, []);

    return (
        <>
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
                onNavigateToProfile={() => setShowEditNickname(true)}
                onDisconnect={() => {
                    console.log('Disconnect requested');
                    router.push('/landing' as any);
                }}
            />

            {/* Edit Nickname Modal */}
            <EditNicknameModal
                visible={showEditNickname}
                currentNickname={nickname}
                onSave={async (newNickname: string) => {
                    setNickname(newNickname);
                    try {
                        await SecureStore.setItemAsync('nickname', newNickname);
                        console.log('[ChatSelection] Nickname updated to:', newNickname);
                    } catch (error) {
                        console.error('[ChatSelection] Failed to save nickname:', error);
                    }
                    setShowEditNickname(false);
                }}
                onClose={() => setShowEditNickname(false)}
                pubKey={pubKey}
            />
        </>
    );
};

export default ChatSelectionPage;
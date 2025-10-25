import { isSeekerDevice } from '@/src/types/solana';
import { useRouter } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import { useEffect } from 'react';

export default function Index() {
    const router = useRouter();
    const isSeekerUser = isSeekerDevice();

    useEffect(() => {
        (async () => {
        // Check if wallet is initialized
        const savedPubKey = await SecureStore.getItemAsync('pubKey');
        const savedPrivKey = await SecureStore.getItemAsync('privKey');
        
        // Check if user has seen index
        const hasSeenIndex = await SecureStore.getItemAsync('hasSeenIndex');

        if (isSeekerUser) {
            // Seeker devices don't need privKey stored
            router.replace('/(tabs)');
            return;
        }
        
        if (!savedPubKey || !savedPrivKey) {
            // No wallet - go to onboarding
            router.replace('/onboarding');
        } else if (hasSeenIndex !== 'true') {
            // Has wallet but hasn't seen landing - show landing
            router.replace('/landing');
        } else {
            // Has wallet and seen landing - go to chat
            router.replace('/(tabs)');
        }
        })();
    }, [router, isSeekerUser]);

    return null;
}

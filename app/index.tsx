import { useEffect } from 'react';
import { useRouter } from 'expo-router';
import * as SecureStore from 'expo-secure-store';

export default function Index() {
    const router = useRouter();

    useEffect(() => {
        (async () => {
        // Check if wallet is initialized
        const savedPubKey = await SecureStore.getItemAsync('pubKey');
        const savedPrivKey = await SecureStore.getItemAsync('privKey');
        
        // Check if user has seen index
        const hasSeenIndex = await SecureStore.getItemAsync('hasSeenIndex');
        
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
    }, [router]);

    return null;
}

import IndexScreen from '@/components/screens/IndexScreen';
import { isSeekerDevice } from '@/src/types/solana';
import { useRouter } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';

export default function LandingPage() {
    const router = useRouter();
    const [hasSeenIndex, setHasSeenIndex] = useState<boolean>(false);
    const [isReturningUser, setIsReturningUser] = useState<boolean>(false);
    const [isLoading, setIsLoading] = useState<boolean>(true);

   useEffect(() => {
        (async () => {
        // Check if wallet is valid
        const savedPubKey = await SecureStore.getItemAsync('pubKey');
        const savedPrivKey = await SecureStore.getItemAsync('privKey');
        const useSeeker = await SecureStore.getItemAsync('useSeeker');

        // For Seeker devices, only pubKey is needed (no private key stored locally)
        if (isSeekerDevice() && useSeeker === 'true') {
            if (!savedPubKey) {
                console.log('[Landing] Seeker device without pubKey - redirecting to onboarding');
                router.replace('/onboarding');
                return;
            }
            console.log('[Landing] Seeker device detected - proceeding to app');
        } else {
            // For standard Android, both keys must exist
            if (!savedPubKey || !savedPrivKey) {
                console.log('[Landing] Missing keys - redirecting to onboarding');
                router.replace('/onboarding');
                return;
            }
        }

        // Check if user has seen the index before
        const seenIndex = await SecureStore.getItemAsync('hasSeenIndex');
        if (seenIndex === 'true') {
            setHasSeenIndex(true);
        }

        setIsReturningUser(true);
        setIsLoading(false);
        })();
    }, [router]);

    const handleEnterMesh = async () => {
        // Mark that user has seen the index
        await SecureStore.setItemAsync('hasSeenIndex', 'true');
        setHasSeenIndex(true);
        
        // Navigate to chat
        router.replace('/(tabs)');
    };

    if (isLoading) {
        return (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0a0a0a' }}>
            <ActivityIndicator size="large" color="#B10FF2" />
        </View>
        );
    }

    return (
        <IndexScreen 
        onEnter={handleEnterMesh} 
        isReturningUser={isReturningUser && hasSeenIndex}
        />
    );
}

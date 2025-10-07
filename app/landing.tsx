import React, { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import { View, ActivityIndicator } from 'react-native';
import IndexScreen from '@/components/screens/IndexScreen';

export default function LandingPage() {
    const router = useRouter();
    const [hasSeenIndex, setHasSeenIndex] = useState<boolean>(false);
    const [isReturningUser, setIsReturningUser] = useState<boolean>(false);
    const [isLoading, setIsLoading] = useState<boolean>(true);

    useEffect(() => {
        (async () => {
        // Check if wallet is valid (both keys exist)
        const savedPubKey = await SecureStore.getItemAsync('pubKey');
        const savedPrivKey = await SecureStore.getItemAsync('privKey');

        // If wallet isn't initialized or is corrupted, go to onboarding
        if (!savedPubKey || !savedPrivKey) {
            console.log('[Landing] Missing keys - redirecting to onboarding');
            // Clean up any partial data
            if (savedPubKey && !savedPrivKey) {
            await SecureStore.deleteItemAsync('pubKey');
            await SecureStore.deleteItemAsync('nickname');
            await SecureStore.deleteItemAsync('hasSeenIndex');
            }
            router.replace('/onboarding');
            return;
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

import { identityStateManager } from '@/src/infrastructure/identity';
import { DeviceDetector } from '@/src/infrastructure/wallet';
import { useRouter } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import { useEffect } from 'react';
import { Platform } from 'react-native';

export default function Index() {
    const router = useRouter();


    useEffect(() => {
        (async () => {
            // Get device information
            const deviceInfo = DeviceDetector.getDeviceInfo();

            console.log('[Index] Device Detection:', {
                platform: Platform.OS,
                device: deviceInfo.device,
                model: deviceInfo.model,
                isSolanaMobile: deviceInfo.isSolanaMobile,
            });

            // 1. Initialize identity state (loads from SecureStore)
            console.log('[Index] Initializing identity state...');
            const identity = await identityStateManager.initialize();
            const hasIdentity = !!identity;
            console.log('[Index] Identity exists:', hasIdentity);

            // 2. Check if user has seen index (UI state)
            const hasSeenIndex = await SecureStore.getItemAsync('hasSeenIndex');
            console.log('[Index] hasSeenIndex flag:', hasSeenIndex);

            // 3. Redirection Logic
            if (!hasIdentity) {
                // NO IDENTITY: Always start with onboarding
                console.log('[Index] No identity found - redirecting to onboarding');
                router.replace('/onboarding');
                return;
            }

            // HAS IDENTITY: Check if landing flow complete
            if (hasSeenIndex === 'true') {
                // Returning user: go straight to chat
                console.log('[Index] Returning user with identity - redirecting to chat');
                router.replace('/chat');
            } else {
                // First time with identity (just finished onboarding): show landing
                console.log('[Index] Identity exists but landing not seen - showing landing page');
                router.replace('/landing');
            }
        })();
    }, [router]);

    return null;
}
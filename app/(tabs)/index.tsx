import { DeviceDetector, LocalWalletAdapter } from '@/src/infrastructure/wallet';
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

            // // 🔧 UNCOMMENT THIS LINE TO RESET AND TEST FIRST-TIME USER EXPERIENCE
            // await SecureStore.deleteItemAsync('hasSeenIndex');

            // Check if user has seen index (UI state)
            const hasSeenIndex = await SecureStore.getItemAsync('hasSeenIndex');
            console.log('[Index] hasSeenIndex flag:', hasSeenIndex);

            // Check if local wallet exists or MWA is available
            const hasLocalWallet = await LocalWalletAdapter.hasStoredWallet();

            if (!hasLocalWallet) {
                // No wallet found - ALWAYS go to onboarding first
                console.log('[Index] No wallet found - redirecting to onboarding');
                router.replace('/onboarding');
                return;
            }

            // Has wallet - check if they've completed the flow
            if (hasSeenIndex === 'true') {
                // Already completed onboarding and landing - go to chat
                console.log('[Index] Returning user with wallet - redirecting to chat');
                router.replace('/ble-test');
            } else {
                // Has wallet but hasn't seen landing page yet - show landing
                console.log('[Index] User has wallet but needs to see landing - showing landing page');
                router.replace('/ble-test');
            }
        })();
    }, [router]);

    return null;
}
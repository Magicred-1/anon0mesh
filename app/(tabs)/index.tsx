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
            const isSolanaMobile = deviceInfo.isSolanaMobile;
            const isSeeker = DeviceDetector.isSeekerDevice();
            const isSaga = DeviceDetector.isSagaDevice();
            const isIOS = Platform.OS === 'ios';
            const isAndroid = Platform.OS === 'android';

            // await runNostrTests();

            console.log('[Index] Device Detection:', {
                platform: Platform.OS,
                device: deviceInfo.device,
                model: deviceInfo.model,
                isSolanaMobile,
                isSeeker,
                isSaga,
            });

            // 🔧 UNCOMMENT THIS LINE TO RESET AND TEST FIRST-TIME USER EXPERIENCE
            // await SecureStore.deleteItemAsync('hasSeenIndex');

            // Check if user has seen index (UI state)
            const hasSeenIndex = await SecureStore.getItemAsync('hasSeenIndex');
            console.log('[Index] hasSeenIndex flag:', hasSeenIndex);

            // Solana Mobile devices (Seeker/Saga) can use MWA - don't need local wallet
            if (isSolanaMobile) {
                console.log('[Index] 📱 Solana Mobile device detected - can use MWA');
                
                // Check if they've completed onboarding
                if (hasSeenIndex !== 'true') {
                    console.log('[Index] First time Solana Mobile user - redirect to landing page');
                    router.replace('/landing' as any);
                    return;
                }
                
                // Already onboarded - go to chat
                console.log('[Index] Returning Solana Mobile user - redirect to chat');
                router.replace('/chat' as any);
                return;
            }

            // iOS and regular Android devices need local wallet
            if (isIOS || isAndroid) {
                // Check if local wallet exists using the new LocalWalletAdapter
                const hasLocalWallet = await LocalWalletAdapter.hasStoredWallet();

                if (!hasLocalWallet) {
                    // No wallet - go to onboarding to create one
                    console.log('[Index] No wallet found - redirecting to onboarding');
                    router.replace('/onboarding' as any);
                } else if (hasSeenIndex === 'true') {
                    // Has wallet and has seen index - go directly to chat
                    console.log('[Index] Returning user - redirecting to chat');
                    router.replace('/chat' as any);
                } else {
                    // Has wallet but first time - show landing page
                    console.log('[Index] First time with wallet - showing landing page');
                    router.replace('/landing' as any);
                }
            }
        })();
    }, [router]);

    return null;
}
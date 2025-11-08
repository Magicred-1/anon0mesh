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

            console.log('[Index] Device Detection:', {
                platform: Platform.OS,
                device: deviceInfo.device,
                model: deviceInfo.model,
                isSolanaMobile,
                isSeeker,
                isSaga,
            });

            // Check if user has seen index (UI state)
            const hasSeenIndex = await SecureStore.getItemAsync('hasSeenIndex');

            // Solana Mobile devices (Seeker/Saga) can use MWA - don't need local wallet
            if (isSolanaMobile) {
                console.log('[Index] 📱 Solana Mobile device detected - can use MWA');
                
                // Check if they've completed onboarding
                if (hasSeenIndex !== 'true') {
                    console.log('[Index] First time Solana Mobile user - redirect to onboarding');
                    router.replace('/landing' as any);
                    return;
                }
                
                // Already onboarded - go to app
                router.replace('/(tabs)');
                return;
            }

            // iOS and regular Android devices need local wallet
            if (isIOS || isAndroid) {
                // Check if local wallet exists using the new LocalWalletAdapter
                const hasLocalWallet = await LocalWalletAdapter.hasStoredWallet();

                if (!hasLocalWallet) {
                    // No wallet - go to onboarding
                    console.log('[Index] No wallet found - redirecting to onboarding');
                    router.replace('/onboarding' as any);
                } else if (hasSeenIndex !== 'true') {
                    // Has wallet but hasn't completed onboarding flow
                    console.log('[Index] Wallet found, redirecting to landing');
                    router.replace('/landing' as any);
                } else {
                    // Has wallet and completed onboarding - go to app
                    console.log('[Index] Wallet initialized - redirecting to app');
                    router.replace('/landing' as any);
                }
            }
        })();
    }, [router]);

    return null;
}
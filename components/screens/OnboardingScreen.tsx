import SolanaLogo from '@/components/ui/SolanaLogo';
import {
    DeviceDetector,
    LocalWalletAdapter,
    MWAWalletAdapter,
} from '@/src/infrastructure/wallet';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import React, { useEffect, useRef, useState } from 'react';
import {
    Animated,
    Image,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';

interface Props {
    // Optional props for external control (if needed)
    onComplete?: () => void;
}

// Generate random nickname
const generateRandomNickname = (): string => {
    const adjectives = [
        'Anonymous', 'Phantom', 'Shadow', 'Cyber', 'Digital', 'Virtual', 
        'Silent', 'Stealth', 'Mystic', 'Hidden', 'Encrypted', 'Secure',
        'Ghost', 'Ninja', 'Elite', 'Alpha', 'Beta', 'Quantum', 'Matrix', 'Node'
    ];
    
    const nouns = [
        'Mesh', 'Node', 'Peer', 'Link', 'Chain', 'Bridge', 'Hub', 'Socket',
        'Relay', 'Router', 'Gateway', 'Beacon', 'Signal', 'Network', 'Protocol',
        'Cipher', 'Key', 'Token', 'Block', 'Hash', 'Sync', 'Stream'
    ];
    
    const randomAdjective = adjectives[Math.floor(Math.random() * adjectives.length)];
    const randomNoun = nouns[Math.floor(Math.random() * nouns.length)];
    const randomNumber = Math.floor(Math.random() * 999) + 1;
    
    return `${randomAdjective}${randomNoun}${randomNumber}`;
};

export default function OnboardingScreen({ onComplete }: Props) {
    // State
    const [nickname, setNickname] = useState<string>('');
    const [loading, setLoading] = useState<boolean>(false);
    const [isSeeker, setIsSeeker] = useState<boolean>(false);
    
    // Hooks
    const router = useRouter();
    
    // Animation refs
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const slideAnim = useRef(new Animated.Value(50)).current;
    const loadingRotation = useRef(new Animated.Value(0)).current;
    const loadingScale = useRef(new Animated.Value(1)).current;
    const pulseAnim = useRef(new Animated.Value(1)).current;
    const loadingDotAnim = useRef(new Animated.Value(0)).current;
    
    // Loading overlay animation states
    const loadingOverlayOpacity = useRef(new Animated.Value(0)).current;
    const enteringTextOpacity = useRef(new Animated.Value(0)).current;
    const logoFadeIn = useRef(new Animated.Value(0)).current;
    const statusFadeIn = useRef(new Animated.Value(0)).current;
    const nicknameFadeIn = useRef(new Animated.Value(0)).current;
    const buttonFadeIn = useRef(new Animated.Value(0)).current;

    // Detect device type on mount
    useEffect(() => {
        const info = DeviceDetector.getDeviceInfo();
        setIsSeeker(info.isSolanaMobile);

        console.log('[Onboarding] Device detected:', {
            device: info.device,
            model: info.model,
            isSolanaMobile: info.isSolanaMobile,
        });
    }, []);

    useEffect(() => {
        // Generate random nickname if none exists
        if (!nickname) {
            setNickname(generateRandomNickname());
        }

        // Animate the content entrance
        Animated.parallel([
            Animated.timing(fadeAnim, {
                toValue: 1,
                duration: 800,
                useNativeDriver: true,
            }),
            Animated.timing(slideAnim, {
                toValue: 0,
                duration: 800,
                useNativeDriver: true,
            }),
        ]).start();

        // Button pulse animation
        Animated.loop(
            Animated.sequence([
                Animated.timing(pulseAnim, {
                    toValue: 1.02,
                    duration: 2000,
                    useNativeDriver: true,
                }),
                Animated.timing(pulseAnim, {
                    toValue: 1,
                    duration: 2000,
                    useNativeDriver: true,
                }),
            ])
        ).start();
    }, [fadeAnim, slideAnim, pulseAnim, nickname]);

    /**
     * Onboard with Solana Mobile (MWA)
     */
    async function onboardWithMWA() {
        setLoading(true);
        console.log('[Onboarding] 📱 Setting up MWA wallet...');

        try {
            const wallet = new MWAWalletAdapter();
            await wallet.initialize();
            
            // Connect to wallet
            await wallet.connect();

            if (!wallet.isConnected()) {
                throw new Error('Failed to connect to mobile wallet');
            }

            const publicKey = wallet.getPublicKey();
            if (!publicKey) {
                throw new Error('No public key received from wallet');
            }

            console.log('[Onboarding] ✅ MWA wallet connected:', publicKey.toBase58());

            // Save nickname
            if (nickname) {
                await SecureStore.setItemAsync('nickname', nickname);
            }

            // DON'T mark hasSeenIndex yet - let landing page do that
            // This ensures users see the landing page after onboarding

            console.log('[Onboarding] ✅ Success! Redirecting to landing...');

            // Navigate to landing page after short delay
            setTimeout(() => {
                if (onComplete) {
                    onComplete();
                } else {
                    router.replace('/landing' as any);
                }
            }, 2000);

        } catch (error: any) {
            console.error('[Onboarding] MWA error:', error);
            alert(error?.message || 'Failed to connect to mobile wallet. Make sure you have a Solana wallet installed.');
        } finally {
            setLoading(false);
        }
    }

    /**
     * Onboard with Local Wallet
     */
    async function onboardWithLocalWallet() {
        setLoading(true);
        console.log('[Onboarding] 🔐 Creating local wallet...');

        try {
            // Create local wallet (generates new keypair)
            const wallet = new LocalWalletAdapter();
            await wallet.initialize();

            const publicKey = wallet.getPublicKey();
            if (!publicKey) {
                throw new Error('Failed to generate wallet');
            }

            console.log('[Onboarding] ✅ Local wallet created:', publicKey.toBase58());

            // Save nickname
            if (nickname) {
                await SecureStore.setItemAsync('nickname', nickname);
            }

            // DON'T mark hasSeenIndex yet - let landing page do that
            // This ensures users see the landing page after onboarding

            console.log('[Onboarding] ✅ Success! Redirecting to landing...');

            // Navigate to landing page after short delay
            setTimeout(() => {
                if (onComplete) {
                    onComplete();
                } else {
                    router.replace('/landing' as any);
                }
            }, 2000);

        } catch (error: any) {
            console.error('[Onboarding] Local wallet error:', error);
            alert(error?.message || 'Failed to create local wallet.');
        } finally {
            setLoading(false);
        }
    }

    /**
     * Auto-detect and onboard
     */
    async function handleOnboard() {
        if (loading) return;

        if (isSeeker) {
            await onboardWithMWA();
        } else {
            await onboardWithLocalWallet();
        }
    }

    // Loading animation with staggered timing
    useEffect(() => {
        if (loading) {
            // Reset all animations
            loadingOverlayOpacity.setValue(0);
            enteringTextOpacity.setValue(0);
            logoFadeIn.setValue(0);
            statusFadeIn.setValue(0);
            nicknameFadeIn.setValue(0);
            buttonFadeIn.setValue(0);

            // Staggered sequence of animations
            Animated.sequence([
                // 1. Fade in overlay (200ms)
                Animated.timing(loadingOverlayOpacity, {
                    toValue: 1,
                    duration: 200,
                    useNativeDriver: true,
                }),
                // 2. Show "ENTERING..." (300ms delay + 400ms fade)
                Animated.timing(enteringTextOpacity, {
                    toValue: 1,
                    duration: 400,
                    delay: 300,
                    useNativeDriver: true,
                }),
                // 3. Show logo (200ms delay + 500ms fade)
                Animated.timing(logoFadeIn, {
                    toValue: 1,
                    duration: 500,
                    delay: 200,
                    useNativeDriver: true,
                }),
                // 4. Show status (300ms delay + 400ms fade)
                Animated.timing(statusFadeIn, {
                    toValue: 1,
                    duration: 400,
                    delay: 300,
                    useNativeDriver: true,
                }),
                // 5. Show nickname (500ms delay + 500ms fade) - increased delay
                Animated.timing(nicknameFadeIn, {
                    toValue: 1,
                    duration: 500,
                    delay: 500,
                    useNativeDriver: true,
                }),
                // 6. Show loading button (400ms delay + 500ms fade)
                Animated.timing(buttonFadeIn, {
                    toValue: 1,
                    duration: 500,
                    delay: 400,
                    useNativeDriver: true,
                }),
            ]).start();

            // Slow rotation animation for Solana logo (6 seconds per rotation)
            Animated.loop(
                Animated.timing(loadingRotation, {
                    toValue: 1,
                    duration: 6000,
                    useNativeDriver: true,
                })
            ).start();

            // Subtle pulse animation for Solana logo
            Animated.loop(
                Animated.sequence([
                    Animated.timing(loadingScale, {
                        toValue: 1.05,
                        duration: 1500,
                        useNativeDriver: true,
                    }),
                    Animated.timing(loadingScale, {
                        toValue: 1,
                        duration: 1500,
                        useNativeDriver: true,
                    }),
                ])
            ).start();

            // Dot animation for "LOADING..."
            Animated.loop(
                Animated.timing(loadingDotAnim, {
                    toValue: 3,
                    duration: 1500,
                    useNativeDriver: true,
                })
            ).start();
        } else {
            loadingRotation.setValue(0);
            loadingScale.setValue(1);
            loadingDotAnim.setValue(0);
            loadingOverlayOpacity.setValue(0);
            enteringTextOpacity.setValue(0);
            logoFadeIn.setValue(0);
            statusFadeIn.setValue(0);
            nicknameFadeIn.setValue(0);
            buttonFadeIn.setValue(0);
        }
    }, [
        loading,
        loadingRotation,
        loadingScale,
        loadingDotAnim,
        loadingOverlayOpacity,
        enteringTextOpacity,
        logoFadeIn,
        statusFadeIn,
        nicknameFadeIn,
        buttonFadeIn,
    ]);

    return (
        <LinearGradient
            colors={['#0a1a1a', '#0d2626', '#0a1a1a']}
            locations={[0, 0.5, 1]}
            style={styles.container}
        >
            {/* Subtle radial glow effect */}
            <View style={styles.glowTop} />
            <View style={styles.glowBottom} />

            <Animated.View 
                style={[
                    styles.inner,
                    {
                        opacity: fadeAnim,
                        transform: [{ translateY: slideAnim }],
                    }
                ]}
            >
                {/* Logo Section */}
                <View style={styles.logoContainer}>
                    <Text style={styles.logoText}>
                        <Image
                            src={require('../../assets/images/anon0mesh_logo.png')}
                            style={{ width: 422, height: 100, resizeMode: 'contain' }}
                        />
                    </Text>
                    
                    <Text style={styles.tagline}>
                        [ DECENTRALIZED P2P MESSAGING ]
                    </Text>
                    
                    {/* Show generated nickname */}
                    {nickname && !loading && (
                        <Text style={styles.generatedNickname}>
                            {"( "}@{nickname}{" )"}
                        </Text>
                    )}
                </View>

                {/* Instructions */}
                <View style={styles.instructionsContainer}>
                    <Text style={styles.instructionsText}>
                        TO GET STARTED{'\n'}
                        CREATE A SECURE WALLET{'\n'}
                        YOUR NICKNAME WILL BE GENERATED{'\n'}
                        AUTOMATICALLY
                    </Text>
                </View>

                {/* Create Wallet Button */}
                <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
                    <TouchableOpacity
                        onPress={handleOnboard}
                        disabled={loading}
                        style={[styles.button, loading && styles.buttonDisabled]}
                        activeOpacity={0.8}
                    >
                        <LinearGradient
                            colors={['rgba(0, 212, 212, 0.1)', 'rgba(0, 212, 212, 0.05)']}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                            style={styles.buttonGradient}
                        >
                            <Text style={styles.buttonText}>
                                {loading ? 'LOADING...' : 'CREATE_WALLET'}
                            </Text>
                            {!loading && (
                                <View style={styles.buttonIcon}>
                                    <View style={styles.iconBar} />
                                    <View style={styles.iconBar} />
                                    <View style={styles.iconBar} />
                                </View>
                            )}
                        </LinearGradient>
                    </TouchableOpacity>
                </Animated.View>
            </Animated.View>

            {/* Loading Overlay */}
            {loading && (
                <View style={StyleSheet.absoluteFill}>
                    <Animated.View style={[StyleSheet.absoluteFill, { opacity: loadingOverlayOpacity }]}>
                        <LinearGradient
                            colors={['#0a1a1a', '#0d2626', '#0a1a1a']}
                            locations={[0, 0.5, 1]}
                            style={styles.loadingOverlay}
                        >
                        {/* Entering Text */}
                        <Animated.Text 
                            style={[
                                styles.enteringText,
                                { opacity: enteringTextOpacity }
                            ]}
                        >
                            ENTERING...
                        </Animated.Text>

                        {/* Logo Section */}
                        <View style={styles.loadingLogoContainer}>
                            <Animated.Text 
                                style={[
                                    styles.logoText,
                                    { opacity: logoFadeIn }
                                ]}
                            >
                                ANON<Text style={styles.logoAccent}>⬡</Text>MESH
                            </Animated.Text>
                            
                            <Animated.Text 
                                style={[
                                    styles.loadingStatus,
                                    { opacity: statusFadeIn }
                                ]}
                            >
                                [ {isSeeker ? 'WALLET_CONNECTED' : 'WALLET_CREATED'} ]
                            </Animated.Text>
                            
                            {nickname && (
                                <Animated.Text 
                                    style={[
                                        styles.loadingNickname,
                                        { opacity: nicknameFadeIn }
                                    ]}
                                >
                                    {"( "}@{nickname}{" )"}
                                </Animated.Text>
                            )}
                        </View>

                        {/* Loading Animation */}
                        <Animated.View 
                            style={[
                                styles.loadingButtonContainer,
                                { opacity: buttonFadeIn }
                            ]}
                        >
                            <View style={styles.loadingButton}>
                                <LinearGradient
                                    colors={['rgba(0, 212, 212, 0.15)', 'rgba(0, 212, 212, 0.08)']}
                                    start={{ x: 0, y: 0 }}
                                    end={{ x: 1, y: 1 }}
                                    style={styles.loadingButtonGradient}
                                >
                                    <Text style={styles.loadingButtonText}>
                                        LOADING...
                                    </Text>
                                </LinearGradient>
                            </View>
                            
                            <Text style={styles.loadingDetails}>
                                {isSeeker 
                                    ? 'CONNECTING TO MOBILE WALLET' 
                                    : 'GENERATING SECURE KEYPAIR'}
                            </Text>
                        </Animated.View>

                        {/* Animated Solana Logo (subtle, bottom) */}
                        <Animated.View 
                            style={[
                                styles.loadingSolanaContainer,
                                {
                                    opacity: buttonFadeIn, // Fade in with button
                                    transform: [
                                        {
                                            rotate: loadingRotation.interpolate({
                                                inputRange: [0, 1],
                                                outputRange: ['0deg', '360deg'],
                                            }),
                                        },
                                        { scale: loadingScale },
                                    ],
                                },
                            ]}
                        >
                            <SolanaLogo size={60} />
                        </Animated.View>
                        </LinearGradient>
                    </Animated.View>
                </View>
            )}
        </LinearGradient>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        width: '100%',
        height: '100%',
        justifyContent: 'center',
        alignItems: 'center',
    },
    glowTop: {
        position: 'absolute',
        top: -100,
        left: '50%',
        width: 400,
        height: 400,
        marginLeft: -200,
        backgroundColor: '#00d4d4',
        opacity: 0.03,
        borderRadius: 200,
        shadowColor: '#00d4d4',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.3,
        shadowRadius: 100,
    },
    glowBottom: {
        position: 'absolute',
        bottom: -150,
        right: '20%',
        width: 300,
        height: 300,
        backgroundColor: '#00d4d4',
        opacity: 0.02,
        borderRadius: 150,
        shadowColor: '#00d4d4',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.2,
        shadowRadius: 80,
    },
    inner: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingVertical: 60,
        zIndex: 2,
        width: '100%',
    },
    logoContainer: {
        alignItems: 'center',
        marginBottom: 80,
    },
    logoText: {
        fontSize: 48,
        fontWeight: '900',
        color: '#ffffff',
        letterSpacing: 4,
        marginBottom: 20,
        textShadowColor: 'rgba(0, 212, 212, 0.3)',
        textShadowOffset: { width: 0, height: 0 },
        textShadowRadius: 20,
    },
    logoAccent: {
        color: '#00d4d4',
        textShadowColor: 'rgba(0, 212, 212, 0.6)',
        textShadowOffset: { width: 0, height: 0 },
        textShadowRadius: 15,
    },
    tagline: {
        fontSize: 14,
        color: '#00d4d4',
        letterSpacing: 3,
        fontFamily: 'monospace',
        textShadowColor: 'rgba(0, 212, 212, 0.4)',
        textShadowOffset: { width: 0, height: 0 },
        textShadowRadius: 10,
    },
    generatedNickname: {
        fontSize: 16,
        color: '#00d4d4',
        letterSpacing: 2,
        fontFamily: 'monospace',
        marginTop: 20,
        opacity: 0.8,
    },
    instructionsContainer: {
        alignItems: 'center',
        marginBottom: 80,
        paddingHorizontal: 20,
    },
    instructionsText: {
        fontSize: 13,
        color: '#8fa9a9',
        textAlign: 'center',
        lineHeight: 24,
        letterSpacing: 2,
        fontFamily: 'monospace',
    },
    button: {
        width: 360,
        height: 60,
        borderRadius: 8,
        overflow: 'hidden',
    },
    buttonGradient: {
        flex: 1,
        borderWidth: 2,
        borderColor: '#00d4d4',
        borderRadius: 8,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#00d4d4',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.5,
        shadowRadius: 15,
        elevation: 8,
    },
    buttonDisabled: {
        opacity: 0.6,
    },
    buttonText: {
        fontSize: 18,
        fontWeight: '700',
        color: '#00d4d4',
        letterSpacing: 2,
        fontFamily: 'monospace',
        marginRight: 15,
        textShadowColor: 'rgba(0, 212, 212, 0.5)',
        textShadowOffset: { width: 0, height: 0 },
        textShadowRadius: 8,
    },
    buttonIcon: {
        flexDirection: 'row',
        gap: 4,
    },
    iconBar: {
        width: 30,
        height: 3,
        backgroundColor: '#00d4d4',
        shadowColor: '#00d4d4',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.8,
        shadowRadius: 5,
    },
    deviceInfo: {
        marginTop: 30,
        fontSize: 11,
        color: '#4a6666',
        fontFamily: 'monospace',
        letterSpacing: 1,
    },
    loadingOverlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingTop: 80,
        paddingBottom: 100,
        zIndex: 10,
    },
    enteringText: {
        fontSize: 14,
        color: '#8fa9a9',
        letterSpacing: 3,
        fontFamily: 'monospace',
        marginBottom: 20,
    },
    loadingLogoContainer: {
        alignItems: 'center',
        flex: 1,
        justifyContent: 'center',
    },
    loadingStatus: {
        fontSize: 14,
        color: '#00d4d4',
        letterSpacing: 3,
        fontFamily: 'monospace',
        marginTop: 20,
        textShadowColor: 'rgba(0, 212, 212, 0.4)',
        textShadowOffset: { width: 0, height: 0 },
        textShadowRadius: 10,
    },
    loadingNickname: {
        fontSize: 16,
        color: '#00d4d4',
        letterSpacing: 2,
        fontFamily: 'monospace',
        marginTop: 12,
    },
    loadingButtonContainer: {
        alignItems: 'center',
        width: '100%',
        paddingHorizontal: 20,
    },
    loadingButton: {
        width: 360,
        height: 60,
        borderRadius: 8,
        overflow: 'hidden',
        marginBottom: 16,
    },
    loadingButtonGradient: {
        flex: 1,
        borderWidth: 2,
        borderColor: '#00d4d4',
        borderRadius: 8,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#00d4d4',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.4,
        shadowRadius: 15,
        elevation: 8,
    },
    loadingButtonText: {
        fontSize: 18,
        fontWeight: '700',
        color: '#00d4d4',
        letterSpacing: 2,
        fontFamily: 'monospace',
        textShadowColor: 'rgba(0, 212, 212, 0.5)',
        textShadowOffset: { width: 0, height: 0 },
        textShadowRadius: 8,
    },
    loadingDetails: {
        fontSize: 12,
        color: '#8fa9a9',
        letterSpacing: 2,
        fontFamily: 'monospace',
        textAlign: 'center',
    },
    loadingSolanaContainer: {
        opacity: 0.3,
        shadowColor: '#00d4d4',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.6,
        shadowRadius: 20,
        elevation: 16,
    },
    loadingText: {
        fontSize: 24,
        color: '#FFFFFF',
        fontWeight: '600',
        marginBottom: 8,
        textShadowColor: 'rgba(0, 212, 212, 0.3)',
        textShadowOffset: { width: 0, height: 0 },
        textShadowRadius: 10,
    },
    loadingSubtext: {
        fontSize: 16,
        color: '#8fa9a9',
        textAlign: 'center',
        paddingHorizontal: 32,
    },
});
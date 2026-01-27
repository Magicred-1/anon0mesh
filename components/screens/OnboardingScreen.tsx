import { IdentityManager } from "@/src/infrastructure/crypto/IdentityManager";
import { identityStateManager } from "@/src/infrastructure/identity";
import {
  DeviceDetector,
  LocalWalletAdapter,
  MWAWalletAdapter,
  WalletFactory,
} from "@/src/infrastructure/wallet";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import * as SecureStore from "expo-secure-store";
import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  Image,
  ImageBackground,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import ArciumIcon from "../icons/ArciumIcon";
import BluetoothIcon from "../icons/BluetoothIcon";
import GhostIcon from "../icons/GhostIcon";
import GlobeIcon from "../icons/GlobeIcon";
import LockIcon from "../icons/LockIcon";

interface Props {
  // Optional props for external control (if needed)
  onComplete?: () => void;
}

export default function OnboardingScreen({ onComplete }: Props) {
  // Background image used for the primary button (from Figma)
  const BUTTON_BG =
    "https://www.figma.com/api/mcp/asset/d5d1494b-7901-4a39-84b4-71060d3ce608";
  // State
  const [nickname, setNickname] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);
  const [isSeeker, setIsSeeker] = useState<boolean>(false);
  const [showBottomSheet, setShowBottomSheet] = useState(false);

  // Hooks
  const router = useRouter();

  // Features data
  const features = [
    {
      icon: <LockIcon />,
      title: "END-TO-END_ENCRYPTED",
      description: "Your messages are secured & encrypted",
    },
    {
      icon: <BluetoothIcon />,
      title: "MESH_NETWORK",
      description:
        "Connect directly with peers via Bluetooth, no internet needed",
    },
    {
      icon: <GhostIcon />,
      title: "STAY_ANONYMOUS",
      description: "Own your identity with Solana keys, no sign-up required",
    },
    {
      icon: <GlobeIcon />,
      title: "ZONE_BASED_MESH",
      description: "From local to global, control your message range",
    },
    {
      icon: <ArciumIcon />,
      title: "PRIVATE_OFFLINE_TRANSACTIONS",
      description:
        "Send confidential private on Solana using Bluetooth powered by Arcium",
    },
  ];

  // Animation refs
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;
  const loadingRotation = useRef(new Animated.Value(0)).current;
  const loadingScale = useRef(new Animated.Value(1)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

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

    console.log("[Onboarding] Device detected:", {
      device: info.device,
      model: info.model,
      isSolanaMobile: info.isSolanaMobile,
    });
  }, []);

  useEffect(() => {
    // Generate random nickname if none exists
    if (!nickname) {
      setNickname(IdentityManager.generateRandomNickname());
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
      ]),
    ).start();
  }, [fadeAnim, slideAnim, pulseAnim, nickname]);

  // Trigger loading animations when loading state changes
  useEffect(() => {
    if (loading) {
      // Start all loading animations immediately
      Animated.sequence([
        // 1. Fade in overlay
        Animated.timing(loadingOverlayOpacity, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
        // 2. Show "ENTERING..." text
        Animated.timing(enteringTextOpacity, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        // 3. Fade in logo
        Animated.timing(logoFadeIn, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }),
        // 4. Show status
        Animated.timing(statusFadeIn, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        // 5. Show nickname
        Animated.timing(nicknameFadeIn, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        // 6. Show button
        Animated.timing(buttonFadeIn, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();

      // Continuous rotation for Solana logo
      Animated.loop(
        Animated.timing(loadingRotation, {
          toValue: 1,
          duration: 3000,
          useNativeDriver: true,
        }),
      ).start();

      // Pulse scale animation
      Animated.loop(
        Animated.sequence([
          Animated.timing(loadingScale, {
            toValue: 1.1,
            duration: 1000,
            useNativeDriver: true,
          }),
          Animated.timing(loadingScale, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: true,
          }),
        ]),
      ).start();
    } else {
      // Reset animations when not loading
      loadingOverlayOpacity.setValue(0);
      enteringTextOpacity.setValue(0);
      logoFadeIn.setValue(0);
      statusFadeIn.setValue(0);
      nicknameFadeIn.setValue(0);
      buttonFadeIn.setValue(0);
      loadingRotation.setValue(0);
      loadingScale.setValue(1);
    }
  }, [
    loading,
    loadingOverlayOpacity,
    enteringTextOpacity,
    logoFadeIn,
    statusFadeIn,
    nicknameFadeIn,
    buttonFadeIn,
    loadingRotation,
    loadingScale,
  ]);

  /**
   * Onboard with Solana Mobile (MWA)
   */
  async function onboardWithMWA() {
    setLoading(true);
    console.log("[Onboarding] 📱 Setting up MWA wallet...");

    try {
      const wallet = new MWAWalletAdapter();
      await wallet.initialize();

      // Connect to wallet
      await wallet.connect();

      if (!wallet.isConnected()) {
        throw new Error("Failed to connect to mobile wallet");
      }

      const publicKey = wallet.getPublicKey();
      if (!publicKey) {
        throw new Error("No public key received from wallet");
      }

      console.log(
        "[Onboarding] ✅ MWA wallet connected:",
        publicKey.toBase58(),
      );

      // 1. Generate and save identity (CRITICAL for skip logic)
      console.log("[Onboarding] Generating persistent mesh identity...");
      const identity = await IdentityManager.generateIdentity(nickname || "Anonymous");
      await identityStateManager.saveIdentity(identity);
      console.log("[Onboarding] ✅ Identity saved");

      // Save nickname separately for UI (legacy)
      if (nickname) {
        await SecureStore.setItemAsync("nickname", nickname);
      }

      // DON'T mark hasSeenIndex yet - let landing page do that
      // This ensures users see the landing page after onboarding

      console.log("[Onboarding] ✅ Success! Redirecting to landing...");

      // Navigate to landing page immediately (reduced delay)
      setTimeout(() => {
        if (onComplete) {
          onComplete();
        } else {
          router.replace("/landing");
        }
      }, 500); // Reduced from 2000ms to 500ms
    } catch (error: any) {
      console.error("[Onboarding] MWA error:", error);
      alert(
        error?.message ||
        "Failed to connect to mobile wallet. Make sure you have a Solana wallet installed.",
      );
    } finally {
      setLoading(false);
    }
  }

  /**
   * Onboard with Local Wallet
   */
  async function onboardWithLocalWallet() {
    setLoading(true);
    console.log("[Onboarding] 🔐 Creating local wallet...");

    try {
      // Create local wallet (generates new keypair)
      const wallet = new LocalWalletAdapter();
      await wallet.initialize(); // No PIN needed - uses biometric or device keychain

      const publicKey = wallet.getPublicKey();
      if (!publicKey) {
        throw new Error("Failed to generate wallet");
      }

      console.log(
        "[Onboarding] ✅ Local wallet created:",
        publicKey.toBase58(),
      );

      // 1. Generate and save identity (CRITICAL for skip logic)
      console.log("[Onboarding] Generating persistent mesh identity...");
      const identity = await IdentityManager.generateIdentity(nickname || "Anonymous");
      await identityStateManager.saveIdentity(identity);
      console.log("[Onboarding] ✅ Identity saved");

      // Save nickname separately for UI (legacy)
      if (nickname) {
        await SecureStore.setItemAsync("nickname", nickname);
      }

      // DON'T mark hasSeenIndex yet - let landing page do that
      // This ensures users see the landing page after onboarding

      console.log("[Onboarding] ✅ Success! Redirecting to landing...");

      // Navigate to landing page immediately (reduced delay)
      setTimeout(() => {
        if (onComplete) {
          onComplete();
        } else {
          router.replace("/landing");
        }
      }, 500); // Reduced from 2000ms to 500ms
    } catch (error: any) {
      console.error("[Onboarding] Local wallet error:", error);
      alert(error?.message || "Failed to create local wallet.");
    } finally {
      setLoading(false);
    }
  }

  /**
   * Onboard with BLE-only (no wallet required)
   * Creates a basic local wallet for mesh functionality
   */
  async function onboardBLEOnly() {
    setLoading(true);
    console.log("[Onboarding] 📡 Setting up BLE-only mode...");

    try {
      // 1. Generate and save identity (CRITICAL for skip logic)
      console.log("[Onboarding] Generating persistent mesh identity...");
      const identity = await IdentityManager.generateIdentity(nickname || "Anonymous");
      await identityStateManager.saveIdentity(identity);
      console.log("[Onboarding] ✅ Identity saved");

      // Save nickname first (fast operation)
      if (nickname) {
        await SecureStore.setItemAsync("nickname", nickname);
      }

      // Create a local wallet even for BLE-only mode
      // This prevents initialization issues and provides basic wallet functionality
      console.log("[Onboarding] Creating local wallet for BLE mode...");
      const localWallet = await WalletFactory.createLocal();

      const publicKey = localWallet.getPublicKey();
      const publicKeyBase58 = publicKey?.toBase58() || "";

      console.log("[Onboarding] ✅ BLE-only wallet created");
      console.log("[Onboarding] 📡 Public Key:", publicKeyBase58);

      // Navigate to landing page immediately (reduced delay)
      setTimeout(() => {
        if (onComplete) {
          onComplete();
        } else {
          router.replace("/landing");
        }
      }, 500); // Reduced from 2000ms to 500ms
    } catch (error: any) {
      console.error("[Onboarding] BLE-only setup error:", error);
      alert(error?.message || "Failed to setup BLE-only mode.");
    } finally {
      setLoading(false);
    }
  }

  /**
   * Auto-detect and onboard
   */
  async function handleOnboard() {
    if (loading) return;

    // Double-check device type before attempting MWA
    // This prevents race conditions with device detection
    const deviceInfo = DeviceDetector.getDeviceInfo();
    const isSolanaMobileDevice = deviceInfo.isSolanaMobile;

    console.log("[Onboarding] Final device check:", {
      stateIsSeeker: isSeeker,
      actualIsSolanaMobile: isSolanaMobileDevice,
      deviceInfo,
    });

    // Use wallet-based onboarding with actual device detection
    if (isSolanaMobileDevice) {
      console.log("[Onboarding] Confirmed Solana Mobile device - using MWA");
      await onboardWithMWA();
    } else {
      console.log(
        "[Onboarding] Not a Solana Mobile device - using Local Wallet",
      );
      await onboardWithLocalWallet();
    }

    // BLE-only mode (alternative - currently not used)
    // await onboardBLEOnly();
  }

  return (
    <LinearGradient
      colors={["#0D0D0D", "#06181B", "#072B31"]}
      locations={[0, 0.9383, 1.0029]}
      start={{ x: 0.2125, y: 0 }}
      end={{ x: 0.7875, y: 1 }}
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
          },
        ]}
      >
        {/* Logo Section */}
        <View style={styles.logoContainer}>
          <Image
            source={require("../../assets/images/anon0mesh_logo.png")}
            style={{ width: 422, height: 100, resizeMode: "contain" }}
          />

          <Text style={styles.tagline}>[ OFF-GRID COLD WALLET ]</Text>

          {/* Show generated nickname */}
          {loading && (
            <Text style={styles.generatedNickname}>
              {"( "}@{nickname}
              {" )"}
            </Text>
          )}
        </View>

        {/* Instructions */}
        <View style={styles.instructionsContainer}>
          <Text style={styles.instructionsText}>
            TO GET STARTED{"\n"}
            {isSeeker ? "CONNECT YOUR WALLET" : "CREATE A SECURE WALLET"}
            {"\n"}
            YOUR NICKNAME WILL BE GENERATED{"\n"}
            AUTOMATICALLY
          </Text>
        </View>

        {/* Create Wallet Button */}
        <TouchableOpacity
          onPress={handleOnboard}
          disabled={loading}
          style={[styles.button, loading && styles.buttonDisabled]}
          activeOpacity={0.8}
        >
          <ImageBackground
            source={{ uri: BUTTON_BG }}
            style={styles.buttonImage}
            imageStyle={{ borderRadius: 12 }}
            resizeMode="stretch"
          >
            <Text
              style={[styles.buttonText, loading && styles.buttonTextDisabled]}
            >
              {(() => {
                if (loading) return "LOADING...";
                if (isSeeker) return "CONNECT_WALLET";
                return "CREATE_WALLET";
              })()}
            </Text>
          </ImageBackground>
        </TouchableOpacity>
      </Animated.View>

      {/* Loading Overlay */}
      {loading && (
        <View style={StyleSheet.absoluteFill}>
          <Animated.View
            style={[
              StyleSheet.absoluteFill,
              { opacity: loadingOverlayOpacity },
            ]}
          >
            <LinearGradient
              colors={["#0D0D0D", "#06181B", "#072B31"]}
              locations={[0, 0.9383, 1.0029]}
              start={{ x: 0.2125, y: 0 }}
              end={{ x: 0.7875, y: 1 }}
              style={styles.loadingOverlay}
            >
              {/* Entering Text */}
              <Animated.Text
                style={[styles.enteringText, { opacity: enteringTextOpacity }]}
              >
                ENTERING...
              </Animated.Text>

              {/* Logo Section */}
              <View style={styles.loadingLogoContainer}>
                <Animated.Text
                  style={[styles.loadingStatus, { opacity: statusFadeIn }]}
                >
                  [ {isSeeker ? "WALLET_CONNECTED" : "WALLET_CREATED"} ]
                </Animated.Text>

                {nickname ? (
                  <Animated.Text
                    style={[
                      styles.loadingNickname,
                      { opacity: nicknameFadeIn },
                    ]}
                  >
                    {"( "}@{nickname}
                    {" )"}
                  </Animated.Text>
                ) : null}
              </View>

              {/* Loading Animation */}
              <Animated.View
                style={[
                  styles.loadingButtonContainer,
                  { opacity: buttonFadeIn },
                ]}
              >
                <View style={styles.loadingButton}>
                  <ImageBackground
                    source={{ uri: BUTTON_BG }}
                    style={styles.loadingButtonImage}
                    imageStyle={{ borderRadius: 12 }}
                    resizeMode="stretch"
                  >
                    <Text style={styles.loadingButtonText}>LOADING...</Text>
                  </ImageBackground>
                </View>

                <Text style={styles.loadingDetails}>
                  {isSeeker
                    ? "CONNECTING TO SEED WALLET"
                    : "GENERATING SECURE KEYPAIR"}
                </Text>
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
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: "100%",
    height: "100%",
    justifyContent: "center",
    alignItems: "center",
  },
  glowTop: {
    position: "absolute",
    top: -100,
    left: "50%",
    width: 400,
    height: 400,
    marginLeft: -200,
    backgroundColor: "#00d4d4",
    opacity: 0.03,
    borderRadius: 200,
    shadowColor: "#00d4d4",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 100,
  },
  glowBottom: {
    position: "absolute",
    bottom: -150,
    right: "20%",
    width: 300,
    height: 300,
    backgroundColor: "#00d4d4",
    opacity: 0.02,
    borderRadius: 150,
    shadowColor: "#00d4d4",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.2,
    shadowRadius: 80,
  },
  inner: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 60,
    zIndex: 2,
    width: "100%",
  },
  logoContainer: {
    alignItems: "center",
    marginBottom: 80,
  },
  logoText: {
    fontSize: 48,
    fontWeight: "900",
    color: "#ffffff",
    letterSpacing: 4,
    marginBottom: 20,
    textShadowColor: "rgba(0, 212, 212, 0.3)",
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 20,
  },
  logoAccent: {
    color: "#00d4d4",
    textShadowColor: "rgba(0, 212, 212, 0.6)",
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 15,
  },
  tagline: {
    fontSize: 14,
    color: "#00d4d4",
    letterSpacing: 3,
    fontFamily: "monospace",
    textShadowColor: "rgba(0, 212, 212, 0.4)",
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 10,
  },
  generatedNickname: {
    fontSize: 16,
    color: "#00d4d4",
    letterSpacing: 2,
    fontFamily: "monospace",
    marginTop: 20,
    opacity: 0.8,
  },
  instructionsContainer: {
    alignItems: "center",
    marginBottom: 80,
    paddingHorizontal: 20,
  },
  instructionsText: {
    fontSize: 13,
    color: "#8fa9a9",
    textAlign: "center",
    lineHeight: 24,
    letterSpacing: 2,
    fontFamily: "monospace",
  },
  button: {
    width: 388,
    height: 64,
    borderRadius: 12,
    overflow: "hidden",
    paddingHorizontal: 0,
    paddingVertical: 0,
    shadowColor: "#22D3EE",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 4,
    elevation: 4,
    justifyContent: "center",
    alignItems: "center",
    borderColor: "#22D3EE",
    borderWidth: 1,
    backgroundColor: "rgba(4, 26, 29, 1)",
  },
  buttonImage: {
    width: "100%",
    height: "100%",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 36,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    fontSize: 20,
    fontWeight: "700",
    color: "#22D3EE",
    letterSpacing: 4,
    fontFamily: "SpaceGrotesk_700Bold",
    textTransform: "uppercase",
  },
  buttonTextDisabled: {
    color: "#6a7a7a",
  },
  deviceInfo: {
    marginTop: 30,
    fontSize: 11,
    color: "#4a6666",
    fontFamily: "monospace",
    letterSpacing: 1,
  },
  loadingOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 80,
    paddingBottom: 100,
    zIndex: 10,
  },
  enteringText: {
    fontSize: 14,
    color: "#8fa9a9",
    letterSpacing: 3,
    fontFamily: "monospace",
    marginBottom: 20,
  },
  loadingLogoContainer: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
  },
  loadingStatus: {
    fontSize: 14,
    color: "#00d4d4",
    letterSpacing: 3,
    fontFamily: "monospace",
    marginTop: 20,
    textShadowColor: "rgba(0, 212, 212, 0.4)",
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 10,
  },
  loadingNickname: {
    fontSize: 16,
    color: "#00d4d4",
    letterSpacing: 2,
    fontFamily: "monospace",
    marginTop: 12,
  },
  loadingButtonContainer: {
    alignItems: "center",
    width: "100%",
    paddingHorizontal: 20,
  },
  loadingButton: {
    width: 388,
    height: 64,
    borderRadius: 12,
    overflow: "hidden",
    marginBottom: 16,
    borderColor: "#22D3EE",
    borderWidth: 1,
    backgroundColor: "rgba(4, 26, 29, 1)",
  },
  loadingButtonGradient: {
    flex: 1,
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingLeft: 36,
    paddingRight: 36,
    paddingVertical: 22,
    shadowColor: "#00d4d4",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 4,
    elevation: 4,
  },
  loadingButtonImage: {
    width: "100%",
    height: "100%",
    justifyContent: "center",
    alignItems: "center",
    paddingLeft: 36,
    paddingRight: 36,
  },
  loadingButtonText: {
    fontSize: 20,
    fontWeight: "700",
    color: "#22D3EE",
    letterSpacing: 4,
    fontFamily: "SpaceGrotesk_700Bold",
    textTransform: "uppercase",
    textShadowColor: "rgba(34, 211, 238, 0.5)",
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 8,
  },
  loadingDetails: {
    fontSize: 12,
    color: "#8fa9a9",
    letterSpacing: 2,
    fontFamily: "monospace",
    textAlign: "center",
  },
  loadingSolanaContainer: {
    opacity: 0.3,
    shadowColor: "#00d4d4",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 20,
    elevation: 16,
  },
  loadingText: {
    fontSize: 24,
    color: "#FFFFFF",
    fontWeight: "600",
    marginBottom: 8,
    textShadowColor: "rgba(0, 212, 212, 0.3)",
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 10,
  },
  loadingSubtext: {
    fontSize: 16,
    color: "#8fa9a9",
    textAlign: "center",
    paddingHorizontal: 32,
  },
});

import { useWallet } from "@/src/contexts/WalletContext";
import { Identity } from "@/src/domain/entities/Identity";
import { identityStateManager } from "@/src/infrastructure/identity";
import { LinearGradient } from "expo-linear-gradient";
import * as SecureStore from "expo-secure-store";
import React, { useEffect, useState } from "react";
import {
  Alert,
  Keyboard,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import OctagonTimesIcon from "../icons/OctagonTimesIcon";
import SeedlingIcon from "../icons/SeedlingIcon";
import BottomNavWithMenu from "../ui/BottomNavWithMenu";

interface ProfileScreenProps {
  onNavigateToMessages?: () => void;
  onNavigateToWallet?: () => void;
  onNavigateToHistory?: () => void;
  onNavigateToMeshZone?: () => void;
  onNavigateToProfile?: () => void;
  onDisconnect?: () => void;
}

const ProfileScreen: React.FC<ProfileScreenProps> = ({
  onNavigateToMessages,
  onNavigateToWallet,
  onNavigateToHistory,
  onNavigateToMeshZone,
  onNavigateToProfile,
  onDisconnect,
}) => {
  const {
    publicKey: walletPublicKey,
    isConnected,
    connect,
    isLoading: isWalletLoading,
  } = useWallet();
  const [nickname, setNickname] = useState("");
  const [pubKey, setPubKey] = useState<string>("");
  const [isValidating, setIsValidating] = useState(false);

  // Load wallet and nickname on mount
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        // If not connected, trigger connection
        if (!isConnected && !isWalletLoading) {
          console.log(
            "[ProfileScreen] Wallet not connected, triggering connection...",
          );
          await connect();
        }

        if (walletPublicKey && mounted) {
          const pubKeyString = walletPublicKey.toBase58();
          setPubKey(pubKeyString);
        }

        // Load identity from global state
        console.log("[ProfileScreen] Loading identity from identityStateManager...");
        const identity = identityStateManager.getIdentity() || await identityStateManager.initialize();

        if (identity && mounted) {
          console.log("[ProfileScreen] Identity loaded:", identity.nickname);
          setNickname(identity.nickname);
        } else if (mounted) {
          // Fallback to SecureStore nickname if no identity exists
          console.log(
            "[ProfileScreen] No identity found, checking SecureStore...",
          );
          const storedNickname = await SecureStore.getItemAsync("nickname");
          setNickname(storedNickname || "Anonymous");
        }
      } catch (e) {
        console.warn("[ProfileScreen] Failed to initialize", e);
        if (mounted) {
          setNickname("Anonymous");
        }
      }
    })();
    return () => {
      mounted = false;
    };
  }, [isConnected, isWalletLoading, walletPublicKey, connect]);

  const validateAndSave = async () => {
    const trimmedNickname = nickname.trim();

    // Validation rules
    if (!trimmedNickname) {
      Alert.alert("Invalid Nickname", "Nickname cannot be empty");
      return;
    }
    if (trimmedNickname.length < 2) {
      Alert.alert(
        "Invalid Nickname",
        "Nickname must be at least 2 characters long",
      );
      return;
    }
    if (trimmedNickname.length > 20) {
      Alert.alert("Invalid Nickname", "Nickname must be 20 characters or less");
      return;
    }
    if (!/^[a-zA-Z0-9\s\-_.]+$/.test(trimmedNickname)) {
      Alert.alert(
        "Invalid Nickname",
        "Nickname can only contain letters, numbers, spaces, and basic punctuation",
      );
      return;
    }

    setIsValidating(true);
    try {
      console.log(
        "[ProfileScreen] Saving nickname to IdentityManager:",
        trimmedNickname,
      );

      // Get current identity
      const currentIdentity = identityStateManager.getIdentity();

      if (currentIdentity) {
        // Create a new Identity object with updated nickname
        const updatedIdentity = new Identity({
          noiseStaticKeyPair: currentIdentity.noiseStaticKeyPair,
          signingKeyPair: currentIdentity.signingKeyPair,
          nickname: trimmedNickname,
          fingerprint: currentIdentity.fingerprint,
        });

        await identityStateManager.saveIdentity(updatedIdentity);
        console.log("[ProfileScreen] Global identity updated with new nickname");
      }

      // Also save to SecureStore for compatibility
      await SecureStore.setItemAsync("nickname", trimmedNickname);

      setNickname(trimmedNickname);
      Alert.alert("Success", "Nickname updated successfully!");
    } catch (error) {
      console.error("[ProfileScreen] Failed to save nickname:", error);
      Alert.alert("Error", "Failed to update nickname. Please try again.");
    } finally {
      setIsValidating(false);
    }
  };

  const handleExportPrivateKey = () => {
    Alert.alert(
      "Export Private Key",
      "This will export your private key. Make sure you're in a secure environment. This action cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Export",
          style: "destructive",
          onPress: () => {
            // TODO: Implement private key export functionality
            Alert.alert(
              "Not Implemented",
              "Private key export functionality will be implemented.",
            );
          },
        },
      ],
    );
  };

  const handleDestroyWallet = () => {
    Alert.alert(
      "Destroy Wallet",
      "This will permanently delete your wallet and all associated data. This action cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Destroy",
          style: "destructive",
          onPress: () => {
            // TODO: Implement wallet destruction functionality
            Alert.alert(
              "Not Implemented",
              "Wallet destruction functionality will be implemented.",
            );
          },
        },
      ],
    );
  };

  return (
    <LinearGradient
      colors={["#0D0D0D", "#06181B", "#072B31"]}
      locations={[0, 0.94, 1]}
      start={{ x: 0.21, y: 0 }}
      end={{ x: 0.79, y: 1 }}
      style={{ flex: 1 }}
    >
      <SafeAreaView style={{ flex: 1 }}>
        {/* Header */}
        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
            paddingHorizontal: 20,
            paddingVertical: 16,
            borderBottomWidth: 2,
            borderBottomColor: "#22D3EE",
          }}
        >
          <Text style={{ color: "#FFFFFF", fontSize: 20, fontWeight: "600" }}>
            Profile
          </Text>
          <TouchableOpacity
            onPress={validateAndSave}
            disabled={isValidating || nickname.trim().length === 0}
            style={{
              width: 80,
              height: 36,
              backgroundColor:
                isValidating || nickname.trim().length === 0
                  ? "#072B31"
                  : "#22D3EE",
              borderRadius: 10,
              justifyContent: "center",
              alignItems: "center",
            }}
            activeOpacity={0.7}
          >
            <Text
              style={{
                color:
                  isValidating || nickname.trim().length === 0
                    ? "#4a5555"
                    : "#0D0D0D",
                fontSize: 15,
                fontWeight: "600",
              }}
            >
              {isValidating ? "Saving..." : "Save"}
            </Text>
          </TouchableOpacity>
        </View>
        {/* Content */}
        <View style={{ flex: 1, paddingHorizontal: 20, paddingTop: 24 }}>
          {/* Custom Nickname Section */}
          <View style={{ marginBottom: 24 }}>
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 12,
              }}
            >
              <Text
                style={{ color: "#FFFFFF", fontSize: 16, fontWeight: "500" }}
              >
                Custom Nickname
              </Text>
              <Text style={{ color: "#9CA3AF", fontSize: 14 }}>
                {nickname.length}/20
              </Text>
            </View>
            <TextInput
              style={{
                backgroundColor: "transparent",
                borderRadius: 12,
                paddingHorizontal: 16,
                paddingVertical: 14,
                color: "#22D3EE",
                fontSize: 16,
                borderWidth: 2,
                borderColor: "#22D3EE",
                fontFamily: "monospace",
              }}
              value={nickname}
              onChangeText={setNickname}
              placeholder="Type_custom_nickname"
              placeholderTextColor="#22D3EE"
              maxLength={20}
              autoFocus={false}
              selectTextOnFocus={true}
              returnKeyType="done"
              onSubmitEditing={() => Keyboard.dismiss()}
            />
          </View>

          <View style={{ marginBottom: 32 }}>
            <Text style={{ color: "#9CA3AF", fontSize: 14, marginBottom: 6 }}>
              • Letters, numbers and basic punctuation only
            </Text>
            <Text style={{ color: "#9CA3AF", fontSize: 14, marginBottom: 6 }}>
              • Will be visible to other mesh users
            </Text>
            <Text style={{ color: "#9CA3AF", fontSize: 14, marginBottom: 6 }}>
              • Choose something memorable and appropriate
            </Text>
            <Text style={{ color: "#9CA3AF", fontSize: 14, marginTop: 12 }}>
              💡 Your nickname is synced with your mesh identity
            </Text>
          </View>

          {/* Danger Zone Buttons */}
          <View style={{ marginBottom: 32 }}>
            <TouchableOpacity
              style={{
                backgroundColor: "#0c2425",
                borderWidth: 1,
                borderColor: "#22D3EE",
                borderRadius: 10,
                paddingHorizontal: 15,
                paddingVertical: 10,
                marginBottom: 16,
                flexDirection: "row",
                alignItems: "center",
                gap: 10,
              }}
              onPress={handleExportPrivateKey}
              activeOpacity={0.7}
            >
              <SeedlingIcon size={20} />
              <Text
                style={{
                  color: "#FFFFFF",
                  fontSize: 16,
                  fontFamily: "SpaceGrotesk-Regular",
                  fontWeight: "400",
                  letterSpacing: 0.8,
                }}
              >
                Export Private Key
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={{
                backgroundColor: "#072B31",
                borderWidth: 1,
                borderColor: "#22D3EE",
                borderRadius: 10,
                paddingHorizontal: 15,
                paddingVertical: 10,
                flexDirection: "row",
                alignItems: "center",
                gap: 10,
              }}
              onPress={handleDestroyWallet}
              activeOpacity={0.7}
            >
              <OctagonTimesIcon size={24} />
              <Text
                style={{
                  color: "#FFFFFF",
                  fontSize: 16,
                  fontFamily: "SpaceGrotesk-Regular",
                  fontWeight: "400",
                  letterSpacing: 0.8,
                }}
              >
                Destroy Wallet
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Bottom Navigation Bar with Menu */}
        <BottomNavWithMenu
          onNavigateToMessages={onNavigateToMessages}
          onNavigateToWallet={onNavigateToWallet}
          onNavigateToHistory={onNavigateToHistory}
          onNavigateToMeshZone={onNavigateToMeshZone}
          onNavigateToProfile={onNavigateToProfile}
          onDisconnect={onDisconnect}
        />
      </SafeAreaView>
    </LinearGradient>
  );
};

export default ProfileScreen;

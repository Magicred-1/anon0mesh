import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
    Image,
    ScrollView,
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
import BottomSheet from "../ui/BottomSheet";

interface IndexScreenProps {
  onEnter?: () => void;
  isReturningUser?: boolean;
  showBackButton?: boolean;
}
// TODO: Delete all messages and data after triggering this action
export default function IndexScreen({
  onEnter,
  isReturningUser,
  showBackButton = false,
}: IndexScreenProps) {
  const navigation = useRouter();
  const [showBottomSheet, setShowBottomSheet] = useState(false);

  const handleEnterPress = () => {
    if (onEnter) {
      onEnter();
    } else {
      navigation.back();
    }
  };

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

  const renderBottomSheetContent = () => (
    <View style={styles.bottomSheetContent}>
      <View style={styles.featuresContainer}>
        {features.map((feature, index) => (
          <View key={index} style={styles.featureCard}>
            <View style={styles.iconContainer}>{feature.icon}</View>
            <View style={{ flex: 1 }}>
              <Text style={styles.featureTitle}>{feature.title}</Text>
              <Text style={styles.featureDescription}>
                {feature.description}
              </Text>
            </View>
          </View>
        ))}
      </View>
    </View>
  );

  return (
    <LinearGradient
      colors={["#0D0D0D", "#06181B", "#072B31"]}
      locations={[0, 0.94, 1]}
      start={{ x: 0, y: 1 }}
      end={{ x: 1, y: 0 }}
      style={styles.scrollView}
    >
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.content}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>
              <Image
                source={require("../../assets/images/anon0mesh_logo.png")}
                style={{ width: 422, height: 100, resizeMode: "contain" }}
              />
            </Text>
            <Text style={styles.subtitle}>[ OFF-GRID COLD WALLET ]</Text>
          </View>

          {/* CTA Button */}
          <TouchableOpacity
            style={styles.button}
            onPress={handleEnterPress}
            activeOpacity={0.8}
          >
            <LinearGradient
              colors={["rgba(0, 212, 212, 0.1)", "rgba(0, 212, 212, 0.05)"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.buttonGradient}
            >
              <Text style={styles.buttonText}>ENTER_THE_MESH</Text>
            </LinearGradient>
          </TouchableOpacity>

          {/* Toggle Button for Bottom Sheet */}
          <TouchableOpacity
            style={styles.toggleButton}
            onPress={() => setShowBottomSheet(true)}
            activeOpacity={0.7}
          >
            <Text style={styles.toggleButtonText}>VIEW_FEATURES</Text>
            <View style={styles.chevron}>
              <View style={styles.chevronLeft} />
              <View style={styles.chevronRight} />
            </View>
          </TouchableOpacity>

          {/* Footer */}
          <Text style={styles.footer}>
            🔒 OPEN SOURCE • PRIVATE • DECENTRALIZED
          </Text>
        </View>
      </ScrollView>

      {/* Bottom Sheet Modal */}
      <BottomSheet
        visible={showBottomSheet}
        onDismiss={() => setShowBottomSheet(false)}
      >
        {renderBottomSheetContent()}
      </BottomSheet>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  scrollView: {
    flex: 1,
  },
  container: {
    flexGrow: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 60,
    minHeight: "100%",
  },
  content: {
    justifyContent: "center",
    alignItems: "center",
    width: "100%",
    maxWidth: 420,
    gap: 40,
  },
  header: {
    alignItems: "center",
    width: "100%",
    marginBottom: 20,
  },
  title: {
    color: "#FFFFFF",
    fontSize: 42,
    fontWeight: "900",
    textAlign: "center",
    marginBottom: 16,
    letterSpacing: 4,
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
  subtitle: {
    color: "#00d4d4",
    fontSize: 13,
    fontWeight: "600",
    textAlign: "center",
    letterSpacing: 3,
    fontFamily: "monospace",
    textShadowColor: "rgba(0, 212, 212, 0.4)",
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 10,
  },
  button: {
    width: 340,
    height: 56,
    borderRadius: 8,
    overflow: "hidden",
  },
  buttonGradient: {
    flex: 1,
    borderWidth: 2,
    borderColor: "#00d4d4",
    borderRadius: 8,
    backgroundColor: "#041A1D",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#00d4d4",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 15,
    elevation: 8,
  },
  buttonText: {
    color: "#00d4d4",
    fontWeight: "700",
    fontSize: 16,
    letterSpacing: 2,
    textShadowColor: "rgba(0, 212, 212, 0.5)",
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 8,
  },
  toggleButton: {
    width: "100%",
    maxWidth: 420,
    height: 48,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: "#00d4d4",
    backgroundColor: "rgba(0, 212, 212, 0.05)",
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 12,
  },
  toggleButtonText: {
    color: "#00d4d4",
    fontWeight: "700",
    fontSize: 14,
    letterSpacing: 2,
    fontFamily: "monospace",
  },
  chevron: {
    width: 24,
    height: 24,
    justifyContent: "center",
    alignItems: "center",
    flexDirection: "row",
  },
  chevronLeft: {
    width: 10,
    height: 2,
    backgroundColor: "#00d4d4",
    transform: [{ rotate: "45deg" }, { translateX: 2 }],
  },
  chevronRight: {
    width: 10,
    height: 2,
    backgroundColor: "#00d4d4",
    transform: [{ rotate: "-45deg" }, { translateX: -2 }],
  },
  bottomSheetContent: {
    padding: 20,
    paddingBottom: 40,
    fontFamily: "SpaceGrotesk",
  },
  bottomSheetTitle: {
    color: "#00d4d4",
    fontSize: 18,
    fontWeight: "800",
    textAlign: "center",
    letterSpacing: 4,
    marginBottom: 20,
    fontFamily: "monospace",
  },
  featuresContainer: {
    flexDirection: "column",
    gap: 16,
    width: "100%",
    paddingHorizontal: 8,
  },
  featureCard: {
    width: "100%",
    backgroundColor: "rgba(13, 38, 38, 0.4)",
    borderRadius: 12,
    padding: 18,
    flexDirection: "row",
    alignItems: "flex-start",
    borderWidth: 1,
    borderColor: "rgba(0, 212, 212, 0.3)",
    gap: 16,
  },
  iconContainer: {
    width: 56,
    height: 56,
    borderRadius: 12,
    backgroundColor: "rgba(0, 212, 212, 0.15)",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#00d4d4",
    flexShrink: 0,
  },
  featureTitle: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "700",
    marginBottom: 8,
    letterSpacing: 1,
    fontFamily: "monospace",
  },
  featureDescription: {
    color: "#8fa9a9",
    fontSize: 11,
    lineHeight: 16,
  },
  footer: {
    color: "#fff",
    fontSize: 11,
    textAlign: "center",
    fontWeight: "500",
    letterSpacing: 1.5,
    fontFamily: "monospace",
    width: "100%",
    marginTop: 20,
  },
  backButton: {
    position: "absolute",
    top: 50,
    left: 20,
    zIndex: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(0, 212, 212, 0.1)",
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(0, 212, 212, 0.3)",
  },
  backButtonText: {
    color: "#00d4d4",
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 2,
    fontFamily: "monospace",
  },
  backArrow: {
    width: 16,
    height: 16,
    justifyContent: "center",
    alignItems: "center",
    flexDirection: "row",
  },
  backArrowLeft: {
    width: 8,
    height: 2,
    backgroundColor: "#00d4d4",
    transform: [{ rotate: "-45deg" }, { translateX: 2 }],
  },
  backArrowRight: {
    width: 8,
    height: 2,
    backgroundColor: "#00d4d4",
    transform: [{ rotate: "45deg" }, { translateX: -2 }],
  },
});

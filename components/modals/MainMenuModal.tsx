import { useNoiseChat } from "@/src/hooks/useNoiseChat";
import { useSegments } from "expo-router";
import {
  ChatCircle,
  ClockClockwise,
  Network,
  Plugs,
  User,
  Wallet,
  type Icon,
} from "phosphor-react-native";
import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  Dimensions,
  Modal,
  PanResponder,
  StyleSheet,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from "react-native";

type MenuOption = {
  id: string;
  label: string;
  route: string;
  icon: Icon;
  onPress: () => void;
};

type Props = {
  visible: boolean;
  onClose: () => void;
  onNavigateToMessages: () => void;
  onNavigateToWallet: () => void;
  onNavigateToHistory: () => void;
  onNavigateToMeshZone: () => void;
  onNavigateToProfile: () => void;
  onDisconnect: () => void;
};

export default function MainMenuModal(props: Props) {
  const segments = useSegments();
  const screenHeight = Dimensions.get("screen").height;
  const closedPosition = screenHeight - 80; // Show 80px peek at bottom

  const [panY] = useState(new Animated.Value(closedPosition));
  const currentPanY = useRef(closedPosition);
  const resetPositionAnim = useRef<Animated.CompositeAnimation | null>(null);
  const closeAnim = useRef<Animated.CompositeAnimation | null>(null);
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gs) => Math.abs(gs.dy) > 5,
      onPanResponderMove: (_, gs) => {
        // Constrain the pan gesture to only move between 0 (fully open) and closedPosition (closed)
        const newValue = Math.max(0, Math.min(closedPosition, gs.dy));
        panY.setValue(newValue);
      },
      onPanResponderRelease: (_, gs) => {
        const threshold = closedPosition / 2;

        if (currentPanY.current > threshold || gs.vy > 0.5) {
          // Swipe down or fast downward velocity - close
          return closeAnim.current?.start(() => props.onClose());
        } else {
          // Swipe up or not enough to close - open
          return resetPositionAnim.current?.start();
        }
      },
    }),
  ).current;

  useEffect(() => {
    resetPositionAnim.current = Animated.timing(panY, {
      toValue: 0,
      duration: 300,
      useNativeDriver: false,
    });

    closeAnim.current = Animated.timing(panY, {
      toValue: closedPosition,
      duration: 300,
      useNativeDriver: false,
    });

    const listener = panY.addListener(({ value }) => {
      currentPanY.current = value;
    });

    return () => {
      panY.removeListener(listener);
    };
  }, [panY, closedPosition]);

  useEffect(() => {
    if (props.visible) {
      resetPositionAnim.current?.start();
    } else {
      closeAnim.current?.start();
    }
  }, [props.visible]);

  const handleDismiss = () => {
    closeAnim.current?.start(() => props.onClose());
  };

  const handleOptionPress = (onPress: () => void) => {
    onPress();
    handleDismiss();
  };

  // Determine active route
  const currentRoute = segments.join("/") || "";
  const isActive = (route: string) => {
    if (route === "chat" && (currentRoute === "chat" || currentRoute === ""))
      return true;
    if (route === "wallet" && currentRoute.startsWith("wallet")) return true;
    if (route === "wallet/history" && currentRoute === "wallet/history")
      return true;
    if (route === "zone" && currentRoute.startsWith("zone")) return true;
    if (route === "profile" && currentRoute === "profile") return true;
    return false;
  };

  const { clearMessages } = useNoiseChat();

  const menuOptions: MenuOption[] = [
    {
      id: "messages",
      label: "Messages",
      route: "chat",
      icon: ChatCircle,
      onPress: props.onNavigateToMessages,
    },
    {
      id: "wallet",
      label: "Wallet",
      route: "wallet",
      icon: Wallet,
      onPress: props.onNavigateToWallet,
    },
    {
      id: "history",
      label: "History",
      route: "wallet/history",
      icon: ClockClockwise,
      onPress: props.onNavigateToHistory,
    },
    {
      id: "mesh_zone",
      label: "Mesh_Zone",
      route: "zone",
      icon: Network,
      onPress: props.onNavigateToMeshZone,
    },
    {
      id: "profile",
      label: "Profile",
      route: "profile",
      icon: User,
      onPress: props.onNavigateToProfile,
    },
    {
      id: "disconnect",
      label: "Disconnect",
      route: "",
      icon: Plugs,
      onPress: () => {
        console.log("[MainMenuModal] Disconnecting and clearing messages...");
        clearMessages();
        props.onDisconnect();
      },
    },
  ];

  const translateY = panY;

  const backdropOpacity = panY.interpolate({
    inputRange: [0, screenHeight - 80],
    outputRange: [0.9, 0],
    extrapolate: "clamp",
  });

  // Don't render anything if not visible
  if (!props.visible) {
    return null;
  }

  return (
    <Modal
      animated
      animationType="fade"
      visible={props.visible}
      transparent
      onRequestClose={handleDismiss}
    >
      <View style={styles.modalOverlay}>
        <TouchableWithoutFeedback onPress={handleDismiss}>
          <Animated.View
            style={[styles.background, { opacity: backdropOpacity }]}
          />
        </TouchableWithoutFeedback>

        <Animated.View
          style={[styles.modalContent, { transform: [{ translateY }] }]}
        >
          <View style={styles.handleContainer} {...panResponder.panHandlers}>
            <View style={styles.handle} />
            <View style={styles.handle} />
          </View>

          <View style={styles.menuGrid}>
            {menuOptions.map((option) => {
              const IconComponent = option.icon;
              const active = isActive(option.route);

              return (
                <TouchableOpacity
                  key={option.id}
                  style={styles.menuItem}
                  onPress={() => handleOptionPress(option.onPress)}
                  activeOpacity={0.7}
                >
                  <View
                    style={[
                      styles.iconContainer,
                      active && styles.iconContainerActive,
                    ]}
                  >
                    <IconComponent size={36} color="#FFFFFF" weight="regular" />
                  </View>
                  <Text style={styles.menuLabel}>{option.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    justifyContent: "flex-end",
  },
  background: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#041A1D",
  },
  modalContent: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "#041A1D",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 2,
    borderColor: "#22D3EE",
    borderBottomWidth: 0,
    paddingTop: 12,
    paddingBottom: 32,
    paddingHorizontal: 20,
    height: 383,
  },
  handleContainer: {
    alignItems: "center",
    paddingVertical: 8,
    paddingBottom: 20,
    cursor: "grab" as any,
    gap: 6,
  },
  handle: {
    width: 50,
    height: 3,
    backgroundColor: "#22D3EE",
    borderRadius: 2,
  },
  menuGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    paddingHorizontal: 10,
    paddingTop: 20,
  },
  menuItem: {
    width: "30%",
    alignItems: "center",
    marginBottom: 32,
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 16,
    backgroundColor: "#0d3333",
    borderWidth: 2,
    borderColor: "#22D3EE",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12,
  },
  iconContainerActive: {
    backgroundColor: "#106471", // Bleu plus clair pour la page active
  },
  menuLabel: {
    color: "#22D3EE",
    fontSize: 14,
    fontWeight: "500",
    textAlign: "center",
    fontFamily: "monospace",
  },
});

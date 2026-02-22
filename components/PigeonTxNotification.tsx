/**
 * PigeonTxNotification - Displays pending offline transaction status
 *
 * Shows a retro LCD-style notification with animated pigeon sprite
 * that indicates pending offline transactions ready to be delivered.
 * Includes toggle for auto-submitting received BLE transactions.
 */

import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  Platform,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

import PigeonSprite from "@/components/PigeonSprite";
import { useMeshChat } from "@/src/contexts/MeshBLEContext";

interface PigeonTxNotificationProps {
  txCount: number;
  onPress?: () => void;
}

export default function PigeonTxNotification({
  txCount,
  onPress,
}: PigeonTxNotificationProps) {
  const bounceAnim = useRef(new Animated.Value(0)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const { autoSubmitEnabled, setAutoSubmitEnabled } = useMeshChat();
  const [isTogglingAutoSubmit, setIsTogglingAutoSubmit] = useState(false);

  const handleAutoSubmitToggle = async (value: boolean) => {
    try {
      setIsTogglingAutoSubmit(true);
      await setAutoSubmitEnabled(value);
    } catch (err) {
      console.error(
        "[PigeonTxNotification] Failed to toggle auto-submit:",
        err,
      );
    } finally {
      setIsTogglingAutoSubmit(false);
    }
  };

  // Bounce animation for the pigeon - only bounce when there are TXs
  useEffect(() => {
    // Always show the component (fade in on mount)
    Animated.timing(opacityAnim, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start();

    if (txCount > 0) {
      // Continuous bounce when there are transactions
      const bounce = Animated.loop(
        Animated.sequence([
          Animated.timing(bounceAnim, {
            toValue: -8,
            duration: 400,
            useNativeDriver: true,
          }),
          Animated.timing(bounceAnim, {
            toValue: 0,
            duration: 400,
            useNativeDriver: true,
          }),
        ]),
      );
      bounce.start();

      return () => bounce.stop();
    } else {
      // Reset to resting position when no transactions
      Animated.timing(bounceAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start();
    }
  }, [txCount, bounceAnim, opacityAnim]);

  return (
    <Animated.View
      style={[
        styles.container,
        {
          opacity: opacityAnim,
        },
      ]}
    >
      <TouchableOpacity
        style={styles.touchable}
        onPress={onPress}
        activeOpacity={0.7}
      >
        <View style={styles.content}>
          {/* Retro LCD-style border */}
          <View style={styles.lcdBorder}>
            <View style={styles.lcdScreen}>
              {/* Animated Pigeon Sprite */}
              <Animated.View
                style={[
                  styles.pigeonContainer,
                  {
                    transform: [{ translateY: bounceAnim }],
                  },
                ]}
              >
                <PigeonSprite
                  isActive={txCount > 0}
                  size={50}
                  animationSpeed={150}
                />
              </Animated.View>

              {/* Transaction Info */}
              <View style={styles.textContainer}>
                <Text style={styles.mainText}>
                  {txCount > 0
                    ? `${txCount} Offline TX${txCount > 1 ? "s" : ""}`
                    : "No Pending TXs"}
                </Text>
                <Text style={styles.subText}>
                  {txCount > 0
                    ? "📦 Tap to view pending transactions"
                    : "🕊️ Ready to deliver transactions"}
                </Text>
              </View>
            </View>

            {/* Auto-Submit Toggle */}
            <View style={styles.autoSubmitSection}>
              <View style={styles.autoSubmitLabelContainer}>
                <Text style={styles.autoSubmitLabel}>Auto-Submit BLE TXs</Text>
                <Text style={styles.autoSubmitSubLabel}>
                  {autoSubmitEnabled
                    ? "🤖 Auto-approve enabled"
                    : "✋ Manual approval"}
                </Text>
              </View>
              <Switch
                value={autoSubmitEnabled}
                onValueChange={handleAutoSubmitToggle}
                disabled={isTogglingAutoSubmit}
                trackColor={{ false: "#555", true: "#22D3EE" }}
                thumbColor={autoSubmitEnabled ? "#00CED1" : "#f4f3f4"}
                ios_backgroundColor="#555"
                style={styles.switch}
              />
            </View>
          </View>

          {/* Pixel-art style corner decorations */}
          <View style={styles.cornerTL} />
          <View style={styles.cornerTR} />
          <View style={styles.cornerBL} />
          <View style={styles.cornerBR} />
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: "100%",
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: "transparent",
  },
  touchable: {
    width: "100%",
  },
  content: {
    position: "relative",
    borderRadius: 12,
    overflow: "hidden",
  },
  lcdBorder: {
    backgroundColor: "#00CED1",
    padding: 3,
    borderRadius: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  lcdScreen: {
    backgroundColor: "#089092",
    borderRadius: 9,
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    minHeight: 60,
    // Retro LCD dot matrix pattern effect
    shadowColor: "#0d8688",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
  },
  pigeonContainer: {
    marginRight: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  textContainer: {
    flex: 1,
    justifyContent: "center",
  },
  mainText: {
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
    fontSize: 16,
    fontWeight: "bold",
    color: "#fff",
    letterSpacing: 1,
    textShadowColor: "rgba(255, 255, 255, 0.3)",
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 0,
  },
  subText: {
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
    fontSize: 11,
    color: "#fff",
    marginTop: 2,
    letterSpacing: 0.5,
  },
  // Auto-submit section
  autoSubmitSection: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "rgba(255, 255, 255, 0.2)",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  autoSubmitLabelContainer: {
    flex: 1,
  },
  autoSubmitLabel: {
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
    fontSize: 13,
    fontWeight: "600",
    color: "#fff",
    letterSpacing: 0.5,
  },
  autoSubmitSubLabel: {
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
    fontSize: 10,
    color: "#fff",
    opacity: 0.8,
    marginTop: 2,
  },
  switch: {
    marginLeft: 12,
    transform: [{ scale: 0.9 }],
  },
  // Pixel-art corner decorations
  cornerTL: {
    position: "absolute",
    top: 0,
    left: 0,
    width: 8,
    height: 8,
    backgroundColor: "#00CED1",
    opacity: 0.3,
  },
  cornerTR: {
    position: "absolute",
    top: 0,
    right: 0,
    width: 8,
    height: 8,
    backgroundColor: "#FFD700",
    opacity: 0.3,
  },
  cornerBL: {
    position: "absolute",
    bottom: 0,
    left: 0,
    width: 8,
    height: 8,
    backgroundColor: "#FFD700",
    opacity: 0.3,
  },
  cornerBR: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 8,
    height: 8,
    backgroundColor: "#FFD700",
    opacity: 0.3,
  },
});

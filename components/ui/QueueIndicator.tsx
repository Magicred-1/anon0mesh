/**
 * QueueIndicator - Shows offline message queue status
 */

import { Clock } from "phosphor-react-native";
import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

interface QueueIndicatorProps {
  queueSize: number;
  onPress?: () => void;
  position?: "top" | "bottom";
}

export default function QueueIndicator({
  queueSize,
  onPress,
  position = "bottom",
}: QueueIndicatorProps) {
  if (queueSize === 0) {
    return null;
  }

  return (
    <TouchableOpacity
      style={[
        styles.container,
        position === "top" ? styles.top : styles.bottom,
      ]}
      onPress={onPress}
      activeOpacity={0.8}
    >
      <View style={styles.content}>
        <Clock size={16} color="#FFA500" weight="bold" />
        <Text style={styles.text}>
          {queueSize} message{queueSize !== 1 ? "s" : ""} queued
        </Text>
        <Text style={styles.subtext}>Waiting for peers...</Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    left: 16,
    right: 16,
    backgroundColor: "rgba(255, 165, 0, 0.15)",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255, 165, 0, 0.3)",
    padding: 12,
    zIndex: 100,
  },
  top: {
    top: 80,
  },
  bottom: {
    bottom: 90,
  },
  content: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  text: {
    color: "#FFA500",
    fontSize: 14,
    fontWeight: "600",
    flex: 1,
  },
  subtext: {
    color: "#FFA500",
    fontSize: 12,
    opacity: 0.7,
  },
});

/**
 * PigeonSprite - Animated pigeon sprite component
 *
 * Uses sprite sheet with 3 different pigeon states:
 * - Left: Sleeping/Idle (Z's) - No transactions
 * - Middle: Delivering (holding envelope with sparkles) - Active transactions
 * - Right: Waiting/Chatting (speech bubble) - Can be used for notifications
 */

import React, { useEffect, useRef } from "react";
import { Animated, Image, StyleSheet, View } from "react-native";

interface PigeonSpriteProps {
  /** Whether pigeon is actively delivering (has pending transactions) */
  isActive?: boolean;
  /** Size of the sprite in pixels */
  size?: number;
  /** Animation speed in milliseconds per frame */
  animationSpeed?: number;
}

const SPRITE_SHEET = require("@/assets/images/pigeon_sprites.png");

// Sprite sheet layout: 3 individual pigeons in a row
// Each pigeon represents a different state:
const PIGEON_IDLE = 0;       // Left pigeon - sleeping with Z's (NO pending txs)
const PIGEON_DELIVERING = 1; // Middle pigeon - holding envelope with sparkles (HAS pending txs)
const PIGEON_WAITING = 2;    // Right pigeon - speech bubble with envelopes (future use)

export const PigeonSprite: React.FC<PigeonSpriteProps> = ({
  isActive = false,
  size = 48,
  animationSpeed = 200,
}) => {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const sparkleAnim = useRef(new Animated.Value(0)).current;

  // Select which pigeon to show based on transaction state:
  // - isActive=false (no pending txs) → Show sleeping pigeon
  // - isActive=true (has pending txs) → Show delivering pigeon
  const pigeonIndex = isActive ? PIGEON_DELIVERING : PIGEON_IDLE;

  // Gentle pulse animation when idle (breathing effect)
  useEffect(() => {
    if (!isActive) {
      const breathe = Animated.loop(
        Animated.sequence([
          Animated.timing(scaleAnim, {
            toValue: 1.05,
            duration: 2000,
            useNativeDriver: true,
          }),
          Animated.timing(scaleAnim, {
            toValue: 1,
            duration: 2000,
            useNativeDriver: true,
          }),
        ]),
      );
      breathe.start();
      return () => breathe.stop();
    } else {
      scaleAnim.setValue(1);
    }
  }, [isActive, scaleAnim]);

  // Sparkle animation when active
  useEffect(() => {
    if (isActive) {
      const sparkle = Animated.loop(
        Animated.sequence([
          Animated.timing(sparkleAnim, {
            toValue: 1,
            duration: 500,
            useNativeDriver: true,
          }),
          Animated.timing(sparkleAnim, {
            toValue: 0,
            duration: 500,
            useNativeDriver: true,
          }),
        ]),
      );
      sparkle.start();
      return () => sparkle.stop();
    } else {
      sparkleAnim.setValue(0);
    }
  }, [isActive, sparkleAnim]);

  return (
    <View
      style={[
        styles.container,
        {
          width: size * 1.6,
          height: size * 1.6,
          alignItems: "center",
          justifyContent: "center",
        },
      ]}
    >
      <Animated.View
        style={{
          width: size * 1.6,
          height: size * 1.6,
          overflow: "hidden", // Clip to show only one pigeon
          transform: [{ scale: scaleAnim }],
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Image
          source={SPRITE_SHEET}
          style={{
            width: size * 4.8, // Total width (3 pigeons × 1.6)
            height: size * 1.6,
            position: "absolute",
            left: -pigeonIndex * size * 1.6, // Shift to show selected pigeon
          }}
          resizeMode="cover"
        />
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    justifyContent: "center",
  },
});

export default PigeonSprite;

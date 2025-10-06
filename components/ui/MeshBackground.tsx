import React from 'react';
import { View, StyleSheet } from 'react-native';

interface MeshBackgroundProps {
  children: React.ReactNode;
}

export const MeshBackground: React.FC<MeshBackgroundProps> = ({ children }) => {
  return (
    <View style={styles.container}>
      {/* Dark base background */}
      <View style={styles.baseBackground} />
      
      {/* Animated mesh network pattern overlay */}
      <View style={styles.meshPattern}>
        {/* Create a subtle grid pattern */}
        {Array.from({ length: 15 }).map((_, i) => (
          <View
            key={`v-${i}`}
            style={[
              styles.gridLine,
              styles.verticalLine,
              { left: `${i * 6.67}%` },
            ]}
          />
        ))}
        {Array.from({ length: 30 }).map((_, i) => (
          <View
            key={`h-${i}`}
            style={[
              styles.gridLine,
              styles.horizontalLine,
              { top: `${i * 3.33}%` },
            ]}
          />
        ))}
      </View>

      {/* Purple glow accents */}
      <View style={styles.glowContainer}>
        <View style={[styles.glow, styles.glow1]} />
        <View style={[styles.glow, styles.glow2]} />
        <View style={[styles.glow, styles.glow3]} />
      </View>

      {/* Content */}
      <View style={styles.content}>{children}</View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    position: 'relative',
    backgroundColor: '#0a0a0a',
  },
  baseBackground: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#0f0f0f',
  },
  meshPattern: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.04,
  },
  gridLine: {
    position: 'absolute',
    backgroundColor: '#B10FF2',
  },
  verticalLine: {
    width: 1,
    height: '100%',
  },
  horizontalLine: {
    height: 1,
    width: '100%',
  },
  glowContainer: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.15,
  },
  glow: {
    position: 'absolute',
    borderRadius: 200,
    backgroundColor: '#B10FF2',
  },
  glow1: {
    width: 300,
    height: 300,
    top: -100,
    right: -50,
    opacity: 0.3,
  },
  glow2: {
    width: 250,
    height: 250,
    bottom: 100,
    left: -80,
    opacity: 0.2,
  },
  glow3: {
    width: 200,
    height: 200,
    top: '40%',
    right: '20%',
    opacity: 0.15,
  },
  content: {
    flex: 1,
    zIndex: 1,
  },
});

export default MeshBackground;

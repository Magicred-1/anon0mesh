import React, { useEffect, useRef } from 'react';
import {
  View,
  Image,
  StyleSheet,
  Animated,
  Dimensions,
  StatusBar,
} from 'react-native';

const { width, height } = Dimensions.get('window');

/**
 * SplashScreen Component for anon0mesh
 * 
 * Features:
 * - Clean design with #212122 background
 * - Animated logo with fade and scale effects
 * - Loading dots with staggered animation
 * - 3-second duration before transitioning to main app
 * - Matches the anon0mesh branding
 */

interface SplashScreenProps {
  onAnimationComplete: () => void;
}

const SplashScreen: React.FC<SplashScreenProps> = ({ onAnimationComplete }) => {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.9)).current;
  const dotAnimValues = useRef(
    Array.from({ length: 3 }, () => new Animated.Value(0))
  ).current;

  useEffect(() => {
    StatusBar.setBackgroundColor('#212122', false);
    StatusBar.setBarStyle('light-content', false);

    // Start the main logo animation
    const startAnimation = () => {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 1200,
          useNativeDriver: true,
        }),
        Animated.timing(scaleAnim, {
          toValue: 1,
          duration: 1200,
          useNativeDriver: true,
        }),
      ]).start(() => {
        // Start loading dots animation after logo appears
        startLoadingAnimation();
      });
    };

    const startLoadingAnimation = () => {
      const loadingAnimations = dotAnimValues.map((animValue, index) =>
        Animated.loop(
          Animated.sequence([
            Animated.delay(index * 200),
            Animated.timing(animValue, {
              toValue: 1,
              duration: 600,
              useNativeDriver: true,
            }),
            Animated.timing(animValue, {
              toValue: 0.3,
              duration: 600,
              useNativeDriver: true,
            }),
          ])
        )
      );

      Animated.parallel(loadingAnimations).start();

      // Complete animation after 3 seconds
      setTimeout(() => {
        StatusBar.setBackgroundColor('#000000', true);
        onAnimationComplete();
      }, 3000);
    };

    startAnimation();
  }, [fadeAnim, scaleAnim, dotAnimValues, onAnimationComplete]);

  return (
    <View style={styles.container}>
      {/* Background */}
      <View style={styles.backgroundGradient} />

      {/* Main logo */}
      <Animated.View
        style={[
          styles.logoContainer,
          {
            opacity: fadeAnim,
            transform: [{ scale: scaleAnim }],
          },
        ]}
      >
        <Image
          source={require('@/assets/images/splash-logo.png')}
          style={styles.logo}
          resizeMode="contain"
        />
      </Animated.View>

      {/* Loading dots */}
      <Animated.View
        style={[
          styles.subtitleContainer,
          {
            opacity: fadeAnim,
          },
        ]}
      >
        <View style={styles.loadingDots}>
          <Animated.View
            style={[
              styles.dot,
              {
                opacity: dotAnimValues[0],
              },
            ]}
          />
          <Animated.View
            style={[
              styles.dot,
              {
                opacity: dotAnimValues[1],
              },
            ]}
          />
          <Animated.View
            style={[
              styles.dot,
              {
                opacity: dotAnimValues[2],
              },
            ]}
          />
        </View>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#212122',
    justifyContent: 'center',
    alignItems: 'center',
  },
  backgroundGradient: {
    position: 'absolute',
    width: width * 2,
    height: height * 2,
    backgroundColor: '#212122',
    opacity: 1,
  },
  logoContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  logo: {
    width: width * 1.0,
    height: height * 0.6,
    maxWidth: 800,
    maxHeight: 500,
  },
  subtitleContainer: {
    position: 'absolute',
    bottom: height * 0.2,
    alignItems: 'center',
  },
  loadingDots: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#FFFFFF',
    marginHorizontal: 6,
    shadowColor: '#FFFFFF',
    shadowOffset: {
      width: 0,
      height: 0,
    },
    shadowOpacity: 0.6,
    shadowRadius: 8,
    elevation: 8,
  },
});

export default SplashScreen;
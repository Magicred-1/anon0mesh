import React, { useEffect, useRef } from 'react';
import {
  Animated,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

interface Props {
  tempNickname: string;
  setTempNickname: (v: string) => void;
  onboard: () => void;
  isSeeker: boolean;
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

export default function OnboardingScreen({
  tempNickname,
  setTempNickname,
  onboard,
  isSeeker,
}: Props) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;
  const keyAnimations = useRef([
    new Animated.Value(0),
    new Animated.Value(0),
  ]).current;

  useEffect(() => {
    // Generate random nickname if none exists
    if (!tempNickname) {
      setTempNickname(generateRandomNickname());
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

    // Animate floating keys (keep for both Seeker and non-Seeker)
    const animateKeys = () => {
      const keyAnimationSequence = keyAnimations.map((anim, index) =>
        Animated.loop(
          Animated.sequence([
            Animated.timing(anim, {
              toValue: 1,
              duration: 2000 + index * 500,
              useNativeDriver: true,
            }),
            Animated.timing(anim, {
              toValue: 0,
              duration: 2000 + index * 500,
              useNativeDriver: true,
            }),
          ])
        )
      );
      Animated.parallel(keyAnimationSequence).start();
    };

    setTimeout(animateKeys, 500);
  }, [fadeAnim, slideAnim, keyAnimations, tempNickname, setTempNickname]);

  const renderFloatingKey = (index: number, size: number, leftPercent: number, topPercent: number) => {
    const animValue = keyAnimations[index] || new Animated.Value(0);
    
    return (
      <Animated.View
        key={index}
        style={[
          styles.floatingKey,
          {
            width: size,
            height: size * 0.6,
            left: `${leftPercent}%`,
            top: `${topPercent}%`,
            transform: [
              {
                translateY: animValue.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, -20],
                }),
              },
              {
                rotate: animValue.interpolate({
                  inputRange: [0, 1],
                  outputRange: ['0deg', '5deg'],
                }),
              },
            ],
            opacity: animValue.interpolate({
              inputRange: [0, 0.5, 1],
              outputRange: [0.7, 1, 0.7],
            }),
          },
        ]}
      >
        <View style={[styles.keyBody, { width: size * 0.8, height: size * 0.4 }]} />
        <View style={[styles.keyHead, { 
          width: size * 0.3, 
          height: size * 0.3,
          top: -size * 0.1,
          left: size * 0.1,
        }]} />
        <View style={[styles.keyTeeth, { 
          width: size * 0.4, 
          height: size * 0.1,
          right: size * 0.05,
          top: size * 0.15,
        }]} />
      </Animated.View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Floating Keys Background */}
      <View style={styles.keysContainer}>
        {renderFloatingKey(0, 120, 15, 20)}
        {renderFloatingKey(1, 100, 70, 15)}
      </View>

      <Animated.View 
        style={[
          styles.inner,
          {
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }],
          }
        ]}
      >
        {/* Main Key Visual */}
        <View style={styles.mainKeyContainer}>
          <View style={styles.mainKey}>
            <View style={styles.mainKeyBody} />
            <View style={styles.mainKeyHead} />
            <View style={styles.mainKeyTeeth} />
          </View>
        </View>

        <Text style={styles.description}>
          {isSeeker
            ? `Welcome to anon0mesh! Since you're using a Seeker device, your secure wallet is already integrated just connect it to get started.`
            : `To get started, you’ll create a secure wallet stored on your device. Your nickname will be generated automatically.`}
        </Text>

        <TouchableOpacity 
          style={styles.button} 
          onPress={onboard} 
          activeOpacity={0.85}
        >
          <Text style={styles.buttonText}>
            {isSeeker ? 'Connect with Seed Vault' : 'Get Started'}
          </Text>
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#212122',
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
  keysContainer: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 1,
  },
  floatingKey: {
    position: 'absolute',
    zIndex: 1,
  },
  keyBody: {
    backgroundColor: '#26C6DA', // accent color
    borderRadius: 8,
    shadowColor: '#26C6DA', // accent color
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  keyHead: {
    position: 'absolute',
    backgroundColor: '#26C6DA', // accent color
    borderRadius: 50,
    borderWidth: 8,
    borderColor: '#212122',
    shadowColor: '#26C6DA', // accent color
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  keyTeeth: {
    position: 'absolute',
    backgroundColor: '#26C6DA', // accent color
    borderRadius: 2,
  },
  inner: {
    flex: 1,
    justifyContent: 'space-evenly',
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingVertical: 60,
    zIndex: 2,
    width: '100%',
  },
  mainKeyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
  },
  mainKey: {
    width: 160,
    height: 100,
    position: 'relative',
  },
  mainKeyBody: {
    width: 120,
    height: 60,
    backgroundColor: '#26C6DA', // accent color
    borderRadius: 12,
    shadowColor: '#26C6DA', // accent color
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 16,
  },
  mainKeyHead: {
    position: 'absolute',
    top: -8,
    left: 16,
    width: 40,
    height: 40,
    backgroundColor: '#26C6DA', // accent color
    borderRadius: 20,
    borderWidth: 12,
    borderColor: '#212122',
    shadowColor: '#26C6DA', // accent color
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 8,
  },
  mainKeyTeeth: {
    position: 'absolute',
    right: 8,
    top: 20,
    width: 32,
    height: 8,
    backgroundColor: '#26C6DA', // accent color
    borderRadius: 4,
  },
  description: {
    fontSize: 20,
    color: '#FFFFFF',
    textAlign: 'center',
    lineHeight: 30,
    paddingHorizontal: 16,
    fontWeight: '400',
    fontFamily: 'Lexend_400Regular',
    flex: 0.8,
    justifyContent: 'center',
    alignItems: 'center',
    textAlignVertical: 'center',
  },
  button: {
    backgroundColor: '#26C6DA',
    borderRadius: 6,
    paddingVertical: 10,
    paddingHorizontal: 20,
    width: 260,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
    fontFamily: 'Lexend_400Regular',
    textAlign: 'center',
  },
});
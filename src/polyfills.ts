/**
 * Solana Polyfills for React Native
 * 
 * Required for @solana/web3.js to work in React Native/Expo environment
 * 
 * Import this at the top of your root layout (_layout.tsx)
 */

// Crypto randomness
import 'react-native-get-random-values';

// Text encoding/decoding
import 'fast-text-encoding';

// Buffer global
import { Buffer } from 'buffer';
global.Buffer = Buffer;

console.log('✅ Solana polyfills loaded');

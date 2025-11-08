/**
 * App Entry Point
 * 
 * Load polyfills FIRST before any other code runs
 */

// Load Solana polyfills (crypto.getRandomValues, Buffer, TextEncoder)
import './src/polyfills';

// Load Expo Router entry
import 'expo-router/entry';

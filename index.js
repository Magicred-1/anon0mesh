/**
 * Custom entry point for anon0mesh
 * Sets up polyfills before anything else runs
 */

// Setup polyfills FIRST, before any other imports
import './src/polyfills';

// Now import the standard expo-router entry
import 'expo-router/entry';
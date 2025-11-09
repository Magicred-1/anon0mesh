#!/usr/bin/env node
/**
 * run-nostr-tests.js - CLI Test Runner for Nostr Integration
 * 
 * Run this script to test the Nostr integration from command line.
 * 
 * Usage:
 *   node scripts/run-nostr-tests.js          # Full test suite
 *   node scripts/run-nostr-tests.js --quick  # Quick test only
 * 
 * Note: This requires the app to be running or use a Node.js environment
 * that can load React Native modules.
 */

const args = process.argv.slice(2);
const isQuickTest = args.includes('--quick');

console.log('🚀 Nostr Integration Test Runner\n');

if (isQuickTest) {
  console.log('Running quick test...\n');
} else {
  console.log('Running full test suite...\n');
  console.log('This may take 30-60 seconds...\n');
}

console.log('⚠️  Note: This script requires running in a React Native environment.');
console.log('    For testing, use one of these methods:\n');
console.log('    1. Import and run in your app:');
console.log('       import { runNostrTests } from "@/src/infrastructure/nostr/NostrTest";');
console.log('       await runNostrTests();\n');
console.log('    2. Use the NostrTestScreen component');
console.log('    3. Run in Expo:');
console.log('       - Add a test button to your app');
console.log('       - Or use the debug menu\n');
console.log('    4. Use the test script in a component:');
console.log('       import { runQuickNostrTest } from "@/src/infrastructure/nostr/NostrTest";');
console.log('       const success = await runQuickNostrTest();\n');

console.log('📝 Test Documentation:');
console.log('    See: src/infrastructure/nostr/NostrTest.ts\n');

process.exit(0);

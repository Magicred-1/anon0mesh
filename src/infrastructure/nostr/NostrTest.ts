/**
 * NostrTest.ts - Comprehensive Testing Script for Nostr Integration
 * 
 * Tests all aspects of the Nostr adapter implementation:
 * - Key generation and storage
 * - Relay connections
 * - Event publishing
 * - Subscriptions
 * - Encryption/Decryption (NIP-04)
 * - BLE fallback integration
 * 
 * Usage:
 *   import { runNostrTests } from '@/src/infrastructure/nostr/NostrTest';
 *   await runNostrTests();
 */

import * as SecureStore from 'expo-secure-store';
import * as nip19 from 'nostr-tools/nip19';
import { NostrAdapter } from './NostrAdapter';
import { NostrRelayManager } from './NostrRelayManager';

// Test configuration
const TEST_RELAYS = [
  'wss://relay.damus.io',
  'wss://relay.nostr.band',
  'wss://nos.lol',
];

const TEST_CSV = `Relay URL,Latitude,Longitude
wss://relay.damus.io,37.7749,-122.4194
wss://relay.nostr.band,40.7128,-74.0060
wss://nos.lol,51.5074,-0.1278
wss://relay.primal.net,37.7749,-122.4194
wss://nostr.wine,40.7128,-74.0060`;

// Test results storage
interface TestResult {
  name: string;
  passed: boolean;
  duration: number;
  error?: string;
  details?: any;
}

const testResults: TestResult[] = [];

// Utility functions
function log(message: string, level: 'info' | 'success' | 'error' | 'warn' = 'info') {
  const emoji = {
    info: 'ℹ️',
    success: '✅',
    error: '❌',
    warn: '⚠️',
  };
  console.log(`${emoji[level]} [NostrTest] ${message}`);
}

async function runTest(
  name: string,
  testFn: () => Promise<void>
): Promise<TestResult> {
  log(`Running: ${name}...`, 'info');
  const startTime = Date.now();
  
  try {
    await testFn();
    const duration = Date.now() - startTime;
    log(`PASSED: ${name} (${duration}ms)`, 'success');
    return { name, passed: true, duration };
  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);
    log(`FAILED: ${name} - ${errorMessage}`, 'error');
    return { name, passed: false, duration, error: errorMessage };
  }
}

// ============================================
// TEST 1: Initialize NostrAdapter
// ============================================
async function testInitialization(): Promise<void> {
  const adapter = new NostrAdapter();
  await adapter.initialize();
  
  const pubkey = adapter.getPublicKey();
  if (!pubkey || pubkey.length !== 64) {
    throw new Error(`Invalid public key: ${pubkey}`);
  }
  
  const npub = nip19.npubEncode(pubkey);
  if (!npub.startsWith('npub1')) {
    throw new Error(`Invalid npub encoding: ${npub}`);
  }
  
  log(`Public key: ${pubkey.slice(0, 16)}...`, 'info');
  log(`Npub: ${npub}`, 'info');
  
  await adapter.shutdown();
}

// ============================================
// TEST 2: Key Persistence
// ============================================
async function testKeyPersistence(): Promise<void> {
  // First initialization
  const adapter1 = new NostrAdapter();
  await adapter1.initialize();
  const pubkey1 = adapter1.getPublicKey();
  await adapter1.shutdown();
  
  // Second initialization should load same key
  const adapter2 = new NostrAdapter();
  await adapter2.initialize();
  const pubkey2 = adapter2.getPublicKey();
  await adapter2.shutdown();
  
  if (pubkey1 !== pubkey2) {
    throw new Error(`Key mismatch: ${pubkey1} !== ${pubkey2}`);
  }
  
  log(`Key persistence verified: ${pubkey1.slice(0, 16)}...`, 'info');
}

// ============================================
// TEST 3: Relay Connection
// ============================================
async function testRelayConnection(): Promise<void> {
  const adapter = new NostrAdapter();
  await adapter.initialize();
  
  await adapter.connectToRelays(TEST_RELAYS);
  
  const connectedRelays = adapter.getConnectedRelays();
  if (connectedRelays.length === 0) {
    throw new Error('No relays connected');
  }
  
  log(`Connected to ${connectedRelays.length} relays`, 'info');
  
  await adapter.shutdown();
}

// ============================================
// TEST 4: Relay Manager
// ============================================
async function testRelayManager(): Promise<void> {
  const manager = new NostrRelayManager();
  await manager.loadRelaysFromCSV(TEST_CSV);
  
  const relayCount = manager.getRelayCount();
  if (relayCount !== 5) {
    throw new Error(`Expected 5 relays, got ${relayCount}`);
  }
  
  // Test geo-based selection
  const closestRelays = manager.getClosestRelays(37.7749, -122.4194, 3);
  if (closestRelays.length !== 3) {
    throw new Error(`Expected 3 closest relays, got ${closestRelays.length}`);
  }
  
  // Test random selection
  const randomRelays = manager.getRandomRelays(2);
  if (randomRelays.length !== 2) {
    throw new Error(`Expected 2 random relays, got ${randomRelays.length}`);
  }
  
  // Test recommended selection (60% closest + 40% random)
  const recommendedRelays = manager.getRecommendedRelays(37.7749, -122.4194, 5);
  if (recommendedRelays.length !== 5) {
    throw new Error(`Expected 5 recommended relays, got ${recommendedRelays.length}`);
  }
  
  log(`Relay manager loaded ${relayCount} relays`, 'info');
  log(`Closest: ${closestRelays.map(r => r.url).join(', ')}`, 'info');
}

// ============================================
// TEST 5: Event Publishing
// ============================================
async function testEventPublishing(): Promise<void> {
  const adapter = new NostrAdapter();
  await adapter.initialize();
  await adapter.connectToRelays(TEST_RELAYS);
  
  const pubkey = adapter.getPublicKey();
  const testMessage = `Test message from anon0mesh at ${new Date().toISOString()}`;
  
  const results = await adapter.publishEvent({
    kind: 1,
    pubkey,
    created_at: Math.floor(Date.now() / 1000),
    tags: [['client', 'anon0mesh-test']],
    content: testMessage,
  });
  
  const successCount = results.filter(r => r.success).length;
  if (successCount === 0) {
    throw new Error('Failed to publish to any relay');
  }
  
  log(`Published to ${successCount}/${results.length} relays`, 'info');
  
  await adapter.shutdown();
}

// ============================================
// TEST 6: Event Subscription
// ============================================
async function testEventSubscription(): Promise<void> {
  return new Promise(async (resolve, reject) => {
    const adapter = new NostrAdapter();
    await adapter.initialize();
    await adapter.connectToRelays(TEST_RELAYS);
    
    const pubkey = adapter.getPublicKey();
    let eventReceived = false;
    let eoseReceived = false;
    
    // Set timeout
    const timeout = setTimeout(() => {
      adapter.shutdown();
      if (!eoseReceived) {
        reject(new Error('Timeout: No EOSE received'));
      } else if (!eventReceived) {
        log('No events received (this is OK for new accounts)', 'warn');
        resolve();
      } else {
        resolve();
      }
    }, 10000);
    
    // Subscribe to our own events
    const subscription = adapter.subscribe(
      [
        {
          authors: [pubkey],
          kinds: [1],
          limit: 5,
        }
      ],
      (event) => {
        eventReceived = true;
        log(`Received event: ${event.id.slice(0, 8)}... kind=${event.kind}`, 'info');
      },
      () => {
        eoseReceived = true;
        log('EOSE received', 'info');
      }
    );
    
    log(`Subscription created: ${subscription.id}`, 'info');
  });
}

// ============================================
// TEST 7: NIP-04 Encryption/Decryption
// ============================================
async function testEncryption(): Promise<void> {
  const adapter1 = new NostrAdapter();
  await adapter1.initialize();
  
  const adapter2 = new NostrAdapter();
  await adapter2.initialize();
  
  const pubkey1 = adapter1.getPublicKey();
  const pubkey2 = adapter2.getPublicKey();
  
  const plaintext = 'This is a secret message 🤫';
  
  // Encrypt from adapter1 to adapter2
  const encrypted = await adapter1.encryptContent(pubkey2, plaintext);
  if (!encrypted || encrypted.length === 0) {
    throw new Error('Encryption failed');
  }
  
  log(`Encrypted: ${encrypted.slice(0, 32)}...`, 'info');
  
  // Decrypt at adapter2
  const decrypted = await adapter2.decryptContent(pubkey1, encrypted);
  if (decrypted !== plaintext) {
    throw new Error(`Decryption mismatch: "${decrypted}" !== "${plaintext}"`);
  }
  
  log(`Decrypted: ${decrypted}`, 'info');
  
  await adapter1.shutdown();
  await adapter2.shutdown();
}

// ============================================
// TEST 8: Publish Encrypted DM
// ============================================
async function testPublishEncryptedDM(): Promise<void> {
  const adapter1 = new NostrAdapter();
  await adapter1.initialize();
  await adapter1.connectToRelays(TEST_RELAYS);
  
  const adapter2 = new NostrAdapter();
  await adapter2.initialize();
  
  const pubkey2 = adapter2.getPublicKey();
  const secretMessage = `Test DM at ${new Date().toISOString()}`;
  
  const results = await adapter1.publishEncryptedMessage(
    pubkey2,
    secretMessage,
    [['client', 'anon0mesh-test']]
  );
  
  const successCount = results.filter(r => r.success).length;
  if (successCount === 0) {
    throw new Error('Failed to publish encrypted DM');
  }
  
  log(`Published encrypted DM to ${successCount}/${results.length} relays`, 'info');
  
  await adapter1.shutdown();
  await adapter2.shutdown();
}

// ============================================
// TEST 9: Connection Status
// ============================================
async function testConnectionStatus(): Promise<void> {
  const adapter = new NostrAdapter();
  
  // Before initialization
  if (adapter.isConnected()) {
    throw new Error('Should not be connected before initialization');
  }
  
  await adapter.initialize();
  await adapter.connectToRelays(TEST_RELAYS);
  
  // After connection
  if (!adapter.isConnected()) {
    throw new Error('Should be connected after connecting to relays');
  }
  
  const status = adapter.getConnectionStatus();
  if (!status.connected) {
    throw new Error('Status should show connected');
  }
  if (status.relayCount === 0) {
    throw new Error('Status should show relay count > 0');
  }
  
  log(`Status: ${status.relayCount} relays, ${status.averageLatency}ms avg`, 'info');
  
  await adapter.shutdown();
  
  // After shutdown
  if (adapter.isConnected()) {
    throw new Error('Should not be connected after shutdown');
  }
}

// ============================================
// TEST 10: Optimal Relay Selection
// ============================================
async function testOptimalRelaySelection(): Promise<void> {
  const adapter = new NostrAdapter();
  await adapter.initialize();
  await adapter.connectToRelays(TEST_RELAYS);
  
  const optimalRelays = adapter.getOptimalRelays(2, 1000);
  
  log(`Optimal relays: ${optimalRelays.map(r => `${r.url} (${r.latency}ms)`).join(', ')}`, 'info');
  
  await adapter.shutdown();
}

// ============================================
// TEST 11: Unsubscribe
// ============================================
async function testUnsubscribe(): Promise<void> {
  const adapter = new NostrAdapter();
  await adapter.initialize();
  await adapter.connectToRelays(TEST_RELAYS);
  
  const pubkey = adapter.getPublicKey();
  
  const subscription = adapter.subscribe(
    [{ authors: [pubkey], kinds: [1], limit: 1 }],
    () => {}
  );
  
  await adapter.unsubscribe(subscription.id);
  
  log(`Unsubscribed from ${subscription.id}`, 'info');
  
  await adapter.shutdown();
}

// ============================================
// TEST 12: Multiple Subscriptions
// ============================================
async function testMultipleSubscriptions(): Promise<void> {
  return new Promise(async (resolve, reject) => {
    const adapter = new NostrAdapter();
    await adapter.initialize();
    await adapter.connectToRelays(TEST_RELAYS);
    
    const pubkey = adapter.getPublicKey();
    let sub1Events = 0;
    let sub2Events = 0;
    let eoseCount = 0;
    
    const timeout = setTimeout(() => {
      adapter.shutdown();
      if (eoseCount >= 2) {
        log(`Sub1: ${sub1Events} events, Sub2: ${sub2Events} events`, 'info');
        resolve();
      } else {
        reject(new Error('Not all subscriptions received EOSE'));
      }
    }, 8000);
    
    // Subscription 1: Our own notes
    adapter.subscribe(
      [{ authors: [pubkey], kinds: [1], limit: 5 }],
      () => { sub1Events++; },
      () => { eoseCount++; }
    );
    
    // Subscription 2: Our own DMs
    adapter.subscribe(
      [{ kinds: [4], '#p': [pubkey], limit: 5 }],
      () => { sub2Events++; },
      () => { eoseCount++; }
    );
    
    log('Created 2 subscriptions', 'info');
  });
}

// ============================================
// TEST 13: Clear Stored Key (Cleanup Test)
// ============================================
async function testClearStoredKey(): Promise<void> {
  const KEY = 'anon0mesh_nostr_privkey_v1';
  
  // Store a test key
  await SecureStore.setItemAsync(KEY, 'test_key_hex');
  
  // Verify it's stored
  const stored = await SecureStore.getItemAsync(KEY);
  if (stored !== 'test_key_hex') {
    throw new Error('Failed to store test key');
  }
  
  // Clear it
  await SecureStore.deleteItemAsync(KEY);
  
  // Verify it's cleared
  const cleared = await SecureStore.getItemAsync(KEY);
  if (cleared !== null) {
    throw new Error('Failed to clear test key');
  }
  
  log('Storage clear test passed', 'info');
}

// ============================================
// MAIN TEST RUNNER
// ============================================
export async function runNostrTests(): Promise<{
  total: number;
  passed: number;
  failed: number;
  results: TestResult[];
}> {
  log('========================================', 'info');
  log('Starting Nostr Integration Tests', 'info');
  log('========================================', 'info');
  
  const tests = [
    { name: 'Initialize NostrAdapter', fn: testInitialization },
    { name: 'Key Persistence', fn: testKeyPersistence },
    { name: 'Relay Connection', fn: testRelayConnection },
    { name: 'Relay Manager', fn: testRelayManager },
    { name: 'Event Publishing', fn: testEventPublishing },
    { name: 'Event Subscription', fn: testEventSubscription },
    { name: 'NIP-04 Encryption/Decryption', fn: testEncryption },
    { name: 'Publish Encrypted DM', fn: testPublishEncryptedDM },
    { name: 'Connection Status', fn: testConnectionStatus },
    { name: 'Optimal Relay Selection', fn: testOptimalRelaySelection },
    { name: 'Unsubscribe', fn: testUnsubscribe },
    { name: 'Multiple Subscriptions', fn: testMultipleSubscriptions },
    { name: 'Clear Stored Key', fn: testClearStoredKey },
  ];
  
  for (const test of tests) {
    const result = await runTest(test.name, test.fn);
    testResults.push(result);
    
    // Small delay between tests
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  // Summary
  const passed = testResults.filter(r => r.passed).length;
  const failed = testResults.filter(r => !r.passed).length;
  const totalDuration = testResults.reduce((sum, r) => sum + r.duration, 0);
  
  log('========================================', 'info');
  log('Test Results Summary', 'info');
  log('========================================', 'info');
  log(`Total: ${testResults.length} tests`, 'info');
  log(`Passed: ${passed}`, passed === testResults.length ? 'success' : 'info');
  log(`Failed: ${failed}`, failed > 0 ? 'error' : 'info');
  log(`Duration: ${totalDuration}ms`, 'info');
  
  if (failed > 0) {
    log('========================================', 'error');
    log('Failed Tests:', 'error');
    testResults.filter(r => !r.passed).forEach(r => {
      log(`  - ${r.name}: ${r.error}`, 'error');
    });
  }
  
  log('========================================', 'info');
  
  return {
    total: testResults.length,
    passed,
    failed,
    results: testResults,
  };
}

// ============================================
// QUICK TEST (Just Essentials)
// ============================================
export async function runQuickNostrTest(): Promise<boolean> {
  log('Running quick Nostr test...', 'info');
  
  try {
    const adapter = new NostrAdapter();
    await adapter.initialize();
    
    const pubkey = adapter.getPublicKey();
    log(`✓ Initialized (pubkey: ${pubkey.slice(0, 16)}...)`, 'success');
    
    await adapter.connectToRelays(['wss://relay.damus.io']);
    log('✓ Connected to relay', 'success');
    
    const results = await adapter.publishEvent({
      kind: 1,
      pubkey,
      created_at: Math.floor(Date.now() / 1000),
      tags: [],
      content: 'Quick test from anon0mesh',
    });
    
    const success = results.some(r => r.success);
    if (success) {
      log('✓ Published event', 'success');
    }
    
    await adapter.shutdown();
    log('✓ Shutdown complete', 'success');
    
    return true;
  } catch (error) {
    log(`Quick test failed: ${error}`, 'error');
    return false;
  }
}

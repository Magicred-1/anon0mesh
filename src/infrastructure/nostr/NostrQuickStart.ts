/**
 * Nostr Quick Start Example
 * 
 * Demonstrates how to integrate Nostr into your anon0mesh app.
 * This example shows the complete flow from initialization to sending messages.
 */

import { SendMessageWithNostrFallbackUseCase } from '@/src/application/use-cases/messaging/nostr/SendMessageWithNostrFallbackUseCase';
import { NostrAdapter } from '@/src/infrastructure/nostr/NostrAdapter';
import { NostrRelayManager } from '@/src/infrastructure/nostr/NostrRelayManager';

// ============================================
// STEP 1: Initialize Nostr Relay Manager
// ============================================

async function initializeNostr() {
  console.log('[Nostr Setup] Step 1: Loading relay CSV...');
  
  // Load relay CSV data
  // In production, load this from bundled assets or remote source
  // For now, you can read it using your preferred method (fetch, filesystem, etc.)
  let csvData: string;
  
  // Example: Load from a bundled asset or hardcoded fallback
  // You'll need to implement the actual loading based on your app's architecture
  try {
    // Option 1: Fetch from public URL
    // csvData = await fetch('https://your-cdn.com/nostr_relays.csv').then(r => r.text());
    
    // Option 2: Use a bundled asset (requires metro.config.js configuration)
    // csvData = await Asset.loadAsync(require('../../../relays/nostr_relays.csv'));
    
    // Option 3: For testing, use a minimal set of relays
    csvData = `Relay URL,Latitude,Longitude
              wss://relay.damus.io,37.7749,-122.4194
              wss://relay.nostr.band,40.7128,-74.0060
              wss://nos.lol,51.5074,-0.1278`;
  } catch (error) {
    console.error('[Nostr Setup] Failed to load relay CSV:', error);
    // Fallback to default relays
    csvData = `Relay URL,Latitude,Longitude
              wss://relay.damus.io,37.7749,-122.4194`;
  }

  const relayManager = new NostrRelayManager();
  await relayManager.loadRelaysFromCSV(csvData);
  
  console.log(`[Nostr Setup] ✅ Loaded ${relayManager.getRelayCount()} relays`);
  
  return relayManager;
}

// ============================================
// STEP 2: Select & Connect to Relays
// ============================================

async function connectToRelays(
  relayManager: NostrRelayManager,
  userLat?: number,
  userLon?: number
) {
  console.log('[Nostr Setup] Step 2: Selecting optimal relays...');
  
  // Get recommended relays (60% closest + 40% random)
  // If location unavailable, uses random selection
  const relays = relayManager.getRecommendedRelays(userLat, userLon, 10);
  
  console.log('[Nostr Setup] Selected relays:');
  relays.forEach((relay, i) => {
    console.log(`  ${i + 1}. ${relay.url}`);
  });
  
  // Initialize Nostr adapter
  const nostrAdapter = new NostrAdapter();
  await nostrAdapter.initialize(); // Auto-generates keypair if not exists
  
  console.log('[Nostr Setup] ✅ Nostr adapter initialized');
  console.log('[Nostr Setup] Public Key:', nostrAdapter.getPublicKey());
  
  // Connect to selected relays
  await nostrAdapter.connectToRelays(relays.map(r => r.url));
  
  const status = nostrAdapter.getConnectionStatus();
  console.log('[Nostr Setup] ✅ Connected to', status.relayCount, 'relays');
  console.log('[Nostr Setup] Average latency:', status.averageLatency, 'ms');
  
  return nostrAdapter;
}

// ============================================
// STEP 3: Send Message with Automatic Fallback
// ============================================

async function sendMessage(
  nostrAdapter: NostrAdapter,
  peerStateManager: any, // Your existing peer manager
  sendViaBLE: any, // Your existing BLE send function
  encryptMessage: any, // Your existing encryption function
  content: string,
  senderId: string,
  recipientId?: string,
  hasInternet: boolean = true
) {
  console.log('[Send Message] Preparing to send:', content.substring(0, 50));
  
  const useCase = new SendMessageWithNostrFallbackUseCase(
    peerStateManager,
    nostrAdapter,
    sendViaBLE,
    encryptMessage
  );

  const result = await useCase.execute({
    content,
    senderId,
    recipientId,
    hasInternetConnection: hasInternet,
  });

  console.log('[Send Message] Result:', {
    success: result.success,
    deliveryMethod: result.deliveryMethod,
    sentViaBLE: result.sentViaBLE,
    sentViaNostr: result.sentViaNostr,
    blePeerCount: result.blePeerCount,
    nostrRelayCount: result.nostrRelayCount,
    error: result.error,
  });
  
  return result;
}

// ============================================
// STEP 4: Subscribe to Incoming Messages
// ============================================

async function subscribeToMessages(nostrAdapter: NostrAdapter) {
  console.log('[Subscribe] Subscribing to Nostr events...');
  
  const myPubkey = nostrAdapter.getPublicKey();
  
  const subscription = nostrAdapter.subscribe(
    [
      {
        kinds: [4], // Encrypted DMs
        '#p': [myPubkey], // Addressed to me
        since: Math.floor(Date.now() / 1000) - 3600, // Last hour
      },
      {
        kinds: [1], // Public notes
        since: Math.floor(Date.now() / 1000) - 3600,
        limit: 100, // Limit recent messages
      }
    ],
    async (event) => {
      console.log('[Subscribe] Event received:', {
        id: event.id.slice(0, 8),
        kind: event.kind,
        from: event.pubkey.slice(0, 8),
      });
      
      // Handle encrypted DM
      if (event.kind === 4) {
        try {
          const decrypted = await nostrAdapter.decryptContent(
            event.pubkey,
            event.content
          );
          console.log('[Subscribe] Decrypted DM:', decrypted);
          
          // TODO: Process message (add to message list, show notification, etc.)
          
        } catch (error) {
          console.error('[Subscribe] Failed to decrypt:', error);
        }
      }
      
      // Handle public note
      if (event.kind === 1) {
        console.log('[Subscribe] Public note:', event.content);
        
        // TODO: Process public message
      }
    }
  );
  
  console.log('[Subscribe] ✅ Subscribed:', subscription.id);
  
  return subscription;
}

// ============================================
// COMPLETE EXAMPLE USAGE
// ============================================

export async function setupNostrForAnon0mesh(
  peerStateManager: any,
  sendViaBLE: any,
  encryptMessage: any,
  userLat?: number,
  userLon?: number
) {
  console.log('========================================');
  console.log('🚀 Nostr Integration Setup for anon0mesh');
  console.log('========================================\n');
  
  try {
    // Step 1: Initialize relay manager
    const relayManager = await initializeNostr();
    
    // Step 2: Connect to relays
    const nostrAdapter = await connectToRelays(relayManager, userLat, userLon);
    
    // Step 3: Subscribe to messages
    const subscription = await subscribeToMessages(nostrAdapter);
    
    console.log('\n========================================');
    console.log('✅ Nostr integration complete!');
    console.log('========================================\n');
    
    // Example: Send a test message
    console.log('📤 Sending test message...\n');
    const result = await sendMessage(
      nostrAdapter,
      peerStateManager,
      sendViaBLE,
      encryptMessage,
      'Hello from anon0mesh! 🌐',
      'your-peer-id',
      undefined, // Broadcast
      true // Has internet
    );
    
    if (result.success) {
      console.log('\n✅ Test message sent successfully!');
    }
    
    return {
      nostrAdapter,
      relayManager,
      subscription,
      sendMessage: (content: string, recipientId?: string) => 
        sendMessage(
          nostrAdapter,
          peerStateManager,
          sendViaBLE,
          encryptMessage,
          content,
          'your-peer-id',
          recipientId,
          true
        ),
    };
    
  } catch (error) {
    console.error('❌ Nostr setup failed:', error);
    throw error;
  }
}

// ============================================
// USAGE IN YOUR APP
// ============================================

/*
// In your main app file (e.g., app/_layout.tsx or app/index.tsx):

import { setupNostrForAnon0mesh } from '@/src/infrastructure/nostr/NostrQuickStart';

// After initializing BLE and wallet:
const nostrContext = await setupNostrForAnon0mesh(
  peerStateManager,
  sendViaBLE,
  encryptMessage,
  userLatitude,  // Optional: from location services
  userLongitude  // Optional: from location services
);

// Send message (auto-fallback BLE → Nostr):
await nostrContext.sendMessage('Hello mesh!');

// Send to specific recipient:
await nostrContext.sendMessage('Private message', 'recipientPeerId');

// Cleanup on app shutdown:
await nostrContext.nostrAdapter.shutdown();
await nostrContext.nostrAdapter.unsubscribe(nostrContext.subscription.id);
*/

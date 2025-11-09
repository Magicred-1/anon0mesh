/**
 * NostrMeshExample.ts - Filtered Nostr Usage for anon0mesh
 * 
 * This example demonstrates how to use Nostr ONLY for mesh network communications:
 * - Private encrypted messages (kind 4, 30000)
 * - Solana transaction relay (kind 30001)
 * 
 * NO general social media content (kind 1 notes) will be relayed or received.
 */

import { NOSTR_EVENT_KINDS } from './INostrAdapter';
import { NostrAdapter } from './NostrAdapter';
import { NostrRelayManager } from './NostrRelayManager';

// ============================================
// EXAMPLE 1: Send Private Mesh Message
// ============================================

export async function sendPrivateMeshMessage(
  adapter: NostrAdapter,
  recipientPubkey: string,
  message: string
) {
  console.log('[Mesh] Sending private message via Nostr...');
  
  // Use custom mesh message kind (30000) - won't appear in general Nostr feeds
  const results = await adapter.publishMeshMessage(
    recipientPubkey,
    message,
    [
      ['type', 'chat'], // Message type
      ['mesh', 'true'], // Mark as mesh network message
    ]
  );
  
  const successCount = results.filter(r => r.success).length;
  console.log(`[Mesh] Sent to ${successCount}/${results.length} relays`);
  
  return results;
}

// ============================================
// EXAMPLE 2: Send Solana Transaction
// ============================================

export async function sendSolanaTransaction(
  adapter: NostrAdapter,
  serializedTransaction: string, // Base64 encoded
  recipientPubkey?: string // Optional: encrypt for specific recipient
) {
  console.log('[Mesh] Relaying Solana transaction via Nostr...');
  
  // Use custom Solana transaction kind (30001)
  const results = await adapter.publishSolanaTransaction(
    serializedTransaction,
    recipientPubkey, // If provided, transaction is encrypted
    [
      ['type', 'transaction'],
      ['network', 'solana'],
    ]
  );
  
  const successCount = results.filter(r => r.success).length;
  console.log(`[Mesh] Transaction relayed to ${successCount}/${results.length} relays`);
  
  return results;
}

// ============================================
// EXAMPLE 3: Subscribe to Mesh Events ONLY
// ============================================

export async function listenForMeshEventsOnly(adapter: NostrAdapter) {
  console.log('[Mesh] Starting filtered subscription...');
  console.log('[Mesh] Will receive ONLY:');
  console.log('[Mesh]   - Private messages (kind 4, 30000)');
  console.log('[Mesh]   - Solana transactions (kind 30001)');
  console.log('[Mesh] Will NOT receive:');
  console.log('[Mesh]   - General social media posts (kind 1)');
  console.log('[Mesh]   - Other Nostr social content');
  
  // This subscription filters out ALL general Nostr content
  const subscription = await adapter.subscribeMeshEvents(
    async (event) => {
      console.log(`[Mesh] Event received: kind ${event.kind}`);
      
      switch (event.kind) {
        case NOSTR_EVENT_KINDS.ENCRYPTED_DM:
        case NOSTR_EVENT_KINDS.MESH_MESSAGE:
          // Handle private message
          try {
            const decrypted = await adapter.decryptContent(
              event.pubkey,
              event.content
            );
            console.log(`[Mesh] Message from ${event.pubkey.slice(0, 8)}: ${decrypted}`);
            // TODO: Process mesh message
          } catch (error) {
            console.error('[Mesh] Failed to decrypt message:', error);
          }
          break;
          
        case NOSTR_EVENT_KINDS.SOLANA_TRANSACTION:
          // Handle Solana transaction
          console.log(`[Mesh] Solana transaction from ${event.pubkey.slice(0, 8)}`);
          
          // Check if encrypted (has 'p' tag)
          const isEncrypted = event.tags.some(tag => tag[0] === 'p');
          
          if (isEncrypted) {
            try {
              const decrypted = await adapter.decryptContent(
                event.pubkey,
                event.content
              );
              console.log(`[Mesh] Decrypted transaction data: ${decrypted.slice(0, 32)}...`);
              // TODO: Process encrypted transaction
            } catch (error) {
              console.error('[Mesh] Failed to decrypt transaction:', error);
            }
          } else {
            // Public transaction
            console.log(`[Mesh] Public transaction data: ${event.content.slice(0, 32)}...`);
            // TODO: Process public transaction
          }
          break;
          
        default:
          console.warn(`[Mesh] Unexpected event kind: ${event.kind}`);
      }
    },
    () => {
      console.log('[Mesh] ✅ Subscription active - listening for mesh events');
    }
  );
  
  return subscription;
}

// ============================================
// EXAMPLE 4: Complete Setup with Filtering
// ============================================

export async function setupFilteredNostrMesh(
  userLatitude?: number,
  userLongitude?: number
) {
  console.log('========================================');
  console.log('🔒 Setting up FILTERED Nostr Mesh Network');
  console.log('========================================\n');
  
  // 1. Load and select optimal relays
  const relayManager = new NostrRelayManager();
  // Load your relay CSV here...
  
  const relays = relayManager.getRecommendedRelays(
    userLatitude || 37.7749,
    userLongitude || -122.4194,
    10
  );
  
  // 2. Initialize Nostr adapter
  const adapter = new NostrAdapter();
  await adapter.initialize();
  await adapter.connectToRelays(relays.map(r => r.url));
  
  console.log('✅ Connected to relays');
  console.log(`   Public Key: ${adapter.getPublicKey().slice(0, 16)}...\n`);
  
  // 3. Subscribe to ONLY mesh events (filtered)
  const subscription = await listenForMeshEventsOnly(adapter);
  
  console.log('========================================');
  console.log('✅ Filtered Nostr Mesh Setup Complete!');
  console.log('========================================\n');
  console.log('📡 Now relaying ONLY:');
  console.log('   • Private mesh messages');
  console.log('   • Solana transactions');
  console.log('');
  console.log('🚫 Filtering out:');
  console.log('   • General Nostr posts (kind 1)');
  console.log('   • Social media content');
  console.log('   • Unrelated public notes');
  console.log('========================================\n');
  
  return {
    adapter,
    subscription,
    sendMessage: (recipientPubkey: string, message: string) =>
        sendPrivateMeshMessage(adapter, recipientPubkey, message),
    sendTransaction: (txData: string, recipientPubkey?: string) =>
        sendSolanaTransaction(adapter, txData, recipientPubkey),
  };
}

// ============================================
// USAGE
// ============================================

/*
import { setupFilteredNostrMesh } from '@/src/infrastructure/nostr/NostrMeshExample';

// Setup filtered mesh network
const mesh = await setupFilteredNostrMesh(userLat, userLon);

// Send private message (kind 30000 - anon0mesh only)
await mesh.sendMessage(recipientPubkey, 'Hello mesh!');

// Send Solana transaction (kind 30001 - encrypted)
await mesh.sendTransaction(serializedTxBase64, recipientPubkey);

// Send Solana transaction (kind 30001 - public)
await mesh.sendTransaction(serializedTxBase64);

// Messages and transactions will ONLY be visible to anon0mesh users
// General Nostr social media apps will NOT see this traffic
*/

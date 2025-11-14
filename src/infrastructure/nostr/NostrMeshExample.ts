/**
 * NostrMeshExample.ts - Filtered Nostr Usage for anon0mesh
 * 
 * This example demonstrates how to use Nostr ONLY for mesh network communications:
 * - Private encrypted messages (kind 4, 30000)
 * - Solana transaction relay (kind 30001) with DURABLE NONCES
 * 
 * NO general social media content (kind 1 notes) will be relayed or received.
 */

import { Connection, Keypair, LAMPORTS_PER_SOL, PublicKey } from '@solana/web3.js';
import { DurableNonceManager, serializeNonceTransaction } from '../wallet/transaction/SolanaDurableNonce';
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
// EXAMPLE 2: Send Solana Transaction (Legacy - with blockhash expiration)
// ============================================

export async function sendSolanaTransaction(
  adapter: NostrAdapter,
  serializedTransaction: string, // Base64 encoded
  recipientPubkey?: string // Optional: encrypt for specific recipient
) {
  console.log('[Mesh] Relaying Solana transaction via Nostr...');
  console.warn('[Mesh] ⚠️  WARNING: This transaction will expire after ~1-2 minutes!');
  console.warn('[Mesh] 💡 Use sendDurableSolanaTransaction() for offline mesh relay');
  
  // Use custom Solana transaction kind (30001)
  const results = await adapter.publishSolanaTransaction(
    serializedTransaction,
    recipientPubkey, // If provided, transaction is encrypted
    [
      ['type', 'transaction'],
      ['network', 'solana'],
      ['durable', 'false'], // Mark as non-durable
    ]
  );
  
  const successCount = results.filter(r => r.success).length;
  console.log(`[Mesh] Transaction relayed to ${successCount}/${results.length} relays`);
  
  return results;
}

// ============================================
// EXAMPLE 2B: Send DURABLE Solana Transaction (Recommended for Mesh)
// ============================================

export async function sendDurableSolanaTransaction(
  adapter: NostrAdapter,
  serializedTransaction: string, // Base64 encoded (created with durable nonce)
  recipientPubkey?: string // Optional: encrypt for specific recipient
) {
  console.log('[Mesh] Relaying DURABLE Solana transaction via Nostr...');
  console.log('[Mesh] ✅ This transaction will NEVER expire!');
  console.log('[Mesh] ✅ Perfect for offline mesh relay');
  
  // Use custom Solana transaction kind (30001)
  const results = await adapter.publishSolanaTransaction(
    serializedTransaction,
    recipientPubkey, // If provided, transaction is encrypted
    [
      ['type', 'transaction'],
      ['network', 'solana'],
      ['durable', 'true'], // Mark as durable nonce transaction
      ['relay', 'mesh'], // Indicate mesh relay
    ]
  );
  
  const successCount = results.filter(r => r.success).length;
  console.log(`[Mesh] Durable transaction relayed to ${successCount}/${results.length} relays`);
  
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
// EXAMPLE 5: Create and Relay Durable Nonce Transaction
// ============================================

export async function createAndRelayDurableTransaction(
  connection: Connection,
  authority: Keypair,
  fromPubkey: PublicKey,
  toPubkey: PublicKey,
  amountSOL: number,
  adapter: NostrAdapter,
  recipientNostrPubkey?: string
) {
  console.log('========================================');
  console.log('🔒 Creating DURABLE Solana Transaction');
  console.log('========================================\n');

  // 1. Initialize nonce manager
  const nonceManager = new DurableNonceManager({
    connection,
    authority,
  });

  // 2. Check if nonce account exists, or create one
  let nonceAccountPubkey: PublicKey;
  
  // You can store this in SecureStore and reuse it
  // For demo, we'll assume it exists or create new one
  const existingNonceAccount = null; // Load from storage if available
  
  if (existingNonceAccount) {
    nonceAccountPubkey = new PublicKey(existingNonceAccount);
    console.log('[Nonce] Using existing nonce account:', nonceAccountPubkey.toBase58());
  } else {
    console.log('[Nonce] Creating new nonce account...');
    const { nonceAccount } = await nonceManager.createNonceAccount({
      fundingAmountSOL: 0.002, // ~0.002 SOL covers rent + buffer
    });
    nonceAccountPubkey = nonceAccount;
    console.log('[Nonce] ✅ Created:', nonceAccountPubkey.toBase58());
    // TODO: Save to SecureStore for reuse
  }

  // 3. Create durable transfer transaction
  const durableTx = await nonceManager.createDurableTransfer({
    from: fromPubkey,
    to: toPubkey,
    amountLamports: amountSOL * LAMPORTS_PER_SOL,
    nonceAccount: nonceAccountPubkey,
    memo: 'anon0mesh durable transfer',
  });

  console.log('[Nonce] ✅ Durable transaction created');
  console.log('[Nonce] This transaction will NEVER expire!');

  // 4. Sign the transaction
  durableTx.sign(authority);

  // 5. Serialize for mesh relay
  const { base64, size } = serializeNonceTransaction(durableTx);
  console.log('[Nonce] Transaction size:', size, 'bytes');

  // 6. Relay through Nostr mesh
  await sendDurableSolanaTransaction(adapter, base64, recipientNostrPubkey);

  console.log('========================================');
  console.log('✅ Durable Transaction Relayed!');
  console.log('========================================\n');
  console.log('📡 Transaction can be submitted to Solana:');
  console.log('   • Anytime in the future');
  console.log('   • From any device with network access');
  console.log('   • After relaying through offline mesh');
  console.log('========================================\n');

  return {
    transaction: durableTx,
    serialized: base64,
    nonceAccount: nonceAccountPubkey.toBase58(),
  };
}

// ============================================
// USAGE EXAMPLES
// ============================================

/*
// ============================================
// LEGACY USAGE (Transaction expires in ~1-2 minutes)
// ============================================
import { setupFilteredNostrMesh } from '@/src/infrastructure/nostr/NostrMeshExample';

// Setup filtered mesh network
const mesh = await setupFilteredNostrMesh(userLat, userLon);

// Send private message (kind 30000 - anon0mesh only)
await mesh.sendMessage(recipientPubkey, 'Hello mesh!');

// ⚠️ PROBLEM: These transactions expire quickly!
await mesh.sendTransaction(serializedTxBase64, recipientPubkey); // Expires in ~90 seconds
await mesh.sendTransaction(serializedTxBase64); // Expires in ~90 seconds

// ============================================
// RECOMMENDED USAGE (Durable Nonces - Never Expires!)
// ============================================
import { Connection, Keypair, PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { 
  DurableNonceManager, 
  serializeNonceTransaction,
  submitNonceTransaction 
} from '@/src/infrastructure/nostr/SolanaDurableNonce';
import { 
  setupFilteredNostrMesh,
  sendDurableSolanaTransaction 
} from '@/src/infrastructure/nostr/NostrMeshExample';

// 1. Setup Nostr mesh
const mesh = await setupFilteredNostrMesh(userLat, userLon);

// 2. Setup Solana connection
const connection = new Connection('https://api.devnet.solana.com', 'confirmed');
const authority = Keypair.fromSecretKey(yourSecretKey); // Your wallet

// 3. Initialize nonce manager
const nonceManager = new DurableNonceManager({
  connection,
  authority,
});

// 4. Create nonce account (ONE TIME - then reuse forever)
const { nonceAccount } = await nonceManager.createNonceAccount({
  fundingAmountSOL: 0.002, // Covers rent
});

// Save this for later: nonceAccount.toBase58()
await SecureStore.setItemAsync('nonce_account', nonceAccount.toBase58());

// 5. Create DURABLE transaction (can be signed offline)
const durableTx = await nonceManager.createDurableTransfer({
  from: authority.publicKey,
  to: new PublicKey('recipient_address'),
  amountLamports: 0.1 * LAMPORTS_PER_SOL,
  nonceAccount: nonceAccount,
  memo: 'Offline mesh payment',
});

// 6. Sign transaction
durableTx.sign(authority);

// 7. Serialize for mesh relay
const { base64 } = serializeNonceTransaction(durableTx);

// 8. Relay through Nostr mesh (can be done OFFLINE)
await sendDurableSolanaTransaction(
  mesh.adapter,
  base64,
  recipientNostrPubkey // Optional: encrypt for specific user
);

// 9. Transaction is now relaying through mesh network
// It will NEVER expire and can be submitted anytime!

// ============================================
// RECEIVING AND SUBMITTING DURABLE TRANSACTIONS
// ============================================

// When you receive a durable transaction via mesh:
mesh.adapter.subscribeMeshEvents(async (event) => {
  if (event.kind === 30001) { // Solana transaction
    const isDurable = event.tags.find(t => t[0] === 'durable' && t[1] === 'true');
    
    if (isDurable) {
      console.log('✅ Received DURABLE transaction - can submit anytime!');
      
      // Deserialize
      const { deserializeNonceTransaction } = await import('./SolanaDurableNonce');
      const tx = deserializeNonceTransaction(event.content);
      
      // Submit to Solana (when online)
      const signature = await submitNonceTransaction(connection, tx);
      console.log('✅ Transaction submitted:', signature);
    } else {
      console.warn('⚠️ Received LEGACY transaction - must submit within 90 seconds!');
    }
  }
});

// ============================================
// ADVANCED: Multiple Nonce Accounts
// ============================================

// You can create multiple nonce accounts for:
// 1. Different transaction types
// 2. Higher throughput (each nonce can only be used once at a time)
// 3. Different authorities

const paymentNonce = await nonceManager.createNonceAccount();
const votingNonce = await nonceManager.createNonceAccount();
const governanceNonce = await nonceManager.createNonceAccount();

// Each can be used independently for durable transactions

// ============================================
// NONCE ACCOUNT MANAGEMENT
// ============================================

// Get current nonce value
const nonceInfo = await nonceManager.getNonceAccount(nonceAccount);
console.log('Current nonce:', nonceInfo?.nonce);

// Manually advance nonce (if transaction failed)
await nonceManager.advanceNonce(nonceAccount);

// Close nonce account and reclaim rent
await nonceManager.closeNonceAccount(nonceAccount, authority.publicKey);

// ============================================
// WHY USE DURABLE NONCES FOR MESH NETWORKS?
// ============================================

1. **No Expiration**: Normal Solana transactions expire after ~90 seconds.
   Durable nonce transactions NEVER expire - perfect for mesh relay.

2. **Offline Signing**: Create and sign transactions completely offline,
   then relay through mesh when ready.

3. **Delayed Submission**: Transaction can relay through multiple hops
   over hours/days, then be submitted when someone has network access.

4. **Reliability**: No need to rush - the transaction will always be valid.

5. **Perfect for Mesh**: anon0mesh networks may have intermittent connectivity.
   Durable nonces solve the timing problem.

// ============================================
// COMPARISON
// ============================================

LEGACY TRANSACTION:
- Uses recent blockhash (expires in ~90 seconds)
- Must be submitted immediately
- ❌ Fails if delayed through mesh network
- ❌ Not suitable for offline/slow networks

DURABLE NONCE TRANSACTION:
- Uses nonce value (never expires)
- Can be submitted anytime
- ✅ Perfect for mesh relay
- ✅ Works offline indefinitely
- ✅ Recommended for anon0mesh

*/

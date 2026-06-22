# Arcium beacon-privacy

Integrates the **anonbeta1** Arcium program (Solana devnet) into the app for the
**beacon-operator privacy flow**. An operator registers a relay beacon whose RNS
destination is encrypted + bound under Arcium MPC (never public), and whose relay
throughput is tracked in an encrypted on-chain counter only the operator can decrypt.

> Scope: operator privacy flow only. The public payment instruction
> (`execute_cosigned_transfer`) is intentionally out of scope here.

## Layout

| File | Role |
|------|------|
| `constants.ts` | program id, cluster offset (456), comp-def offsets, decode offsets |
| `vendor/arciumCrypto.ts` | **vendored** RescueCipher + Arcium PDA derivations (from `@arcium-hq/client@0.9.3`, node/anchor stripped, `@noble` v2). `@ts-nocheck`. Validated byte-for-byte vs the SDK. Do not hand-edit. |
| `beaconInstructions.ts` | raw `@solana/web3.js` instruction builders + account decoders (framework-agnostic) |
| `beaconKeys.ts` | operator x25519 keypair, persisted in the OS keystore |
| `beaconClient.ts` | service: register / waitForBindingVerified / initRelayStats / recordRelay / waitForRelayRecorded / getBeaconStatus / getDecryptedRelayCount |
| `__tests__/` | `crypto.test.mjs` (deterministic) + `integration.devnet.mjs` (live round-trip) |

## Usage

```ts
import { registerBeacon, waitForBindingVerified, initRelayStats,
         recordRelay, waitForRelayRecorded, getDecryptedRelayCount } from '@/src/services/arcium';

const ctx = { walletAdapter, rpcAdapter }; // from useWallet().wallet + useNetworkMode().adapter
await registerBeacon(ctx);            // signs register_beacon_private
await waitForBindingVerified(ctx);    // polls beacon_bind MPC callback
await initRelayStats(ctx);
await recordRelay(ctx);               // signs record_relay
await waitForRelayRecorded(ctx);      // polls relay_increment MPC callback
const count = await getDecryptedRelayCount(ctx); // bigint, decrypted locally
```

## Tests

```bash
# deterministic (no network): crypto golden vectors + instruction encoding
npx tsx src/services/arcium/__tests__/crypto.test.mjs
# live devnet round-trip of the real modules (funds a fresh operator from the CLI keypair)
npx tsx src/services/arcium/__tests__/integration.devnet.mjs
```

Both pass against devnet. Metro bundles the modules for Android cleanly.

## On-device smoke (Seeker)

1. Serve this branch over Metro and load the dev client.
2. Deep link: `anonmesh://dev/arcium-beacon`.
3. Connect a wallet, then tap **1 Register → 2 Init relay stats → 3 Record relay**.
   Each MPC step shows a busy indicator (seconds–minutes); the status card shows
   `binding verified ✓` and a non-zero **decrypted relay count** when done.

Verified on devnet: program `anon7uu8UtVoFgS8GCSfw2RqyphJhkN3xEjgPwznYDe`.

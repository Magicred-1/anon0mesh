# `infrastructure/network` — transport-agnostic Solana RPC

This module hides "did the call go to a public Solana RPC, or through a mesh
relay over LoRa" from the rest of the app. Every caller talks to an
`IRpcAdapter`; the wallet/UI never branches on transport.

## The interface

`IRpcAdapter` (see `types.ts`) is the single shape consumers depend on. It is
intentionally a thin subset of `Connection` — only the calls anonmesh needs
to ship signed transactions and refresh wallet state.

Current surface:

| Method | Purpose |
|---|---|
| `getBalance` | Native SOL balance for an account. |
| `getLatestBlockhash` | Recent blockhash + expiry height for tx building. |
| `sendRawTransaction` | Submit a fully signed wire-format transaction. |
| `getSignatureStatus` | Single-signature status — drives confirmation polling. |
| `getAccountInfo` | Raw account bytes for an account, or `null`. Used for ATA-existence checks. |
| `getFeeForMessage` | Fee in lamports the network would charge for a compiled message. |
| `getParsedTokenAccountsByOwner` | SPL token accounts (parsed) owned by an address. |
| `getSignaturesForAddress` | Recent confirmed signatures, newest first. Powers the activity feed. |

Adding a new method? Update the interface, then implement in **all three**
adapters below. If a method can't be supported on `IsolatedRpcAdapter`,
throw `new Error("No Solana route available")` to keep the contract honest.

## Implementations

### `DirectRpcAdapter`

Online mode. Each call is a thin pass-through to a `Connection` from
`@solana/web3.js`. No retries, no caching — those are the caller's choice
(see `useWalletBalance.tsx` cooldown logic).

### `MeshRpcAdapter`

Offline mode. Each call is wrapped in an LXMF (Reticulum) message addressed
to a beacon relay. The relay is a node running anonmesh's beacon service
that forwards `solana_rpc`-typed envelopes to its own local Solana RPC
endpoint and returns the JSON-RPC result.

Wire protocol (see `MeshRpcRequest` / `MeshRpcResponse` in `types.ts`):

```
Request  (base64 JSON)  { id, type: 'solana_rpc', method, params }
Response (base64 JSON)  { id, result? | error? }
```

`MeshRpcAdapter.handleIncoming()` MUST be called with every received LXMF
message so pending request promises resolve. This is wired from the
`LxmfContext` event loop:

```ts
if (e.type === 'messageReceived' && meshAdapter) {
  meshAdapter.handleIncoming(e.source, e.content);
}
```

Default timeout: 30 s per call. Pending requests live in a `Map<id, ...>`
keyed by a monotonic-ish `id` so out-of-order or duplicate responses don't
confuse the matcher.

Trust boundary: **the beacon you connect to sees every RPC method, every
account address, every signature you query, and every signed transaction
you submit.** It cannot forge a signed transaction, but it can drop them,
delay them, or learn metadata. Pick beacons accordingly.

### `IsolatedRpcAdapter`

No Solana route available — either no internet and no mesh peer, or the
user explicitly chose airplane mode. Every method throws. UI surfaces this
as the "no route" empty state on the wallet home.

## Type reconstruction in mesh mode

JSON-RPC wire format isn't the same shape `@solana/web3.js` returns. For
example `getAccountInfo` sends `owner` as a base58 string and `data` as a
`[base64, "base64"]` tuple, but callers expect a `PublicKey` and a
`Buffer`. `MeshRpcAdapter` does that reconstruction internally (see
`decodeAccountInfo` and `decodeParsedAccount`) so callers receive
identical types regardless of transport. **Keep this discipline** when
adding new methods — if a caller has to know the transport, the
abstraction has leaked.

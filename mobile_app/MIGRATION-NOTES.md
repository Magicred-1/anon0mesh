# Migration plan — direct-Solana-RPC bypass sites → `IRpcAdapter`

After `feat(adapter): extend IRpcAdapter with account/fee/token/signature APIs`
landed, `IRpcAdapter` exposes the four methods every remaining bypass site
needs. This doc lists the bypass sites still calling `solanaConnection`
directly and the exact shape of the migration. **All four sites must move
in a single follow-up PR** so mesh mode stops silently using the public
devnet endpoint behind the user's back.

Why a separate PR: the adapter-extension PR is intentionally additive so it
does not collide with the in-flight send-flow work on #53. Once #53 lands,
this migration is the next safe move.

## Sites to migrate

### 1. ATA-existence check before SPL transfers

**File**: `src/services/sendTransaction.ts:265-272`
**Function**: `buildSplTransferTransaction`
**New dep**: thread `rpcAdapter: IRpcAdapter` into the function signature
(caller `sendSplTransfer` already has it).

Diff shape:

```ts
// before
const toAtaInfo = await solanaConnection.getAccountInfo(toAta, "confirmed");

// after
const toAtaInfo = await rpcAdapter.getAccountInfo(toAta, "confirmed");
```

Caller change: `sendSplTransfer` already receives `rpcAdapter` — pass it
into `buildSplTransferTransaction`. `estimateSplTransferFeeLamports` also
calls `buildSplTransferTransaction` and already has `walletAdapter` but no
`rpcAdapter` — plumb one through from its callsite (`useSendSheet` or
similar; verify at migration time).

### 2. SOL fee estimate

**File**: `src/services/sendTransaction.ts:363-368`
**Function**: `estimateSolTransferFeeLamports`
**New dep**: thread `rpcAdapter: IRpcAdapter` into the params object.

Diff shape:

```ts
// before
const { blockhash } = await solanaConnection.getLatestBlockhash("confirmed");
// ...
const fee = await solanaConnection.getFeeForMessage(tx.compileMessage(), "confirmed");
if (fee.value === null) throw new Error("Fee unavailable");
return fee.value;

// after
const { blockhash } = await rpcAdapter.getLatestBlockhash();
// ...
const fee = await rpcAdapter.getFeeForMessage(tx.compileMessage(), "confirmed");
if (fee === null) throw new Error("Fee unavailable");
return fee;
```

Note: `rpcAdapter.getFeeForMessage` already returns `number | null` (we
unwrapped `.value` inside the adapter); drop the `.value` access.

### 3. SPL fee estimate

**File**: `src/services/sendTransaction.ts:396-401`
**Function**: `estimateSplTransferFeeLamports`

Same diff shape as #2 — thread `rpcAdapter`, swap `solanaConnection` calls
for `rpcAdapter` calls, drop `.value`.

### 4. SPL balance + activity refresh

**File**: `src/hooks/useWalletBalance.tsx:88-96`
**Function**: `refetch` inside `useWalletBalance`

Currently passes `solanaConnection` into `fetchSplTokens` and
`fetchRecentActivity` in `services/walletData.ts`. Two sub-migrations:

**4a. `fetchSplTokens(connection, publicKey)` →
`fetchSplTokens(rpcAdapter, publicKey)`**

Inside `walletData.ts:76-...`, replace `connection.getParsedTokenAccountsByOwner`
with `rpcAdapter.getParsedTokenAccountsByOwner`. Same return shape.

**4b. `fetchRecentActivity(connection, publicKey, limit)` →
`fetchRecentActivity(rpcAdapter, publicKey, limit)`**

Two RPC calls inside:

- `connection.getSignaturesForAddress(publicKey, { limit })` → swap to
  `rpcAdapter.getSignaturesForAddress(publicKey, { limit })`. Direct
  match — adapter returns the same `ConfirmedSignatureInfo[]`.
- `connection.getParsedTransactions(signatures, { maxSupportedTransactionVersion: 0 })`
  is **NOT yet on `IRpcAdapter`**. Choose one:
    1. (Recommended for the migration PR) Add
       `getParsedTransactions(signatures, config)` to `IRpcAdapter` first —
       another additive interface extension following the same pattern as
       this PR. The Mesh implementation should pass through to the same LXMF
       envelope path (`method: "getParsedTransactions"`, params as-is) and
       reconstruct any `PublicKey` fields in the parsed instruction data on
       the client side.
    2. Defer activity-feed migration and only migrate the SPL-balance half
       (4a). Document that activity is still direct.

The cleaner path is option 1 — same shape of work as the four methods this
PR shipped.

## Test plan for the migration PR

Per-site verification:

1. **Devnet, online mode** — send a SOL transfer, send an SPL transfer to a
   fresh recipient (forces ATA-create branch), confirm fees match the
   pre-migration estimate (allow 1-lamport diff for blockhash drift).
2. **Mesh mode with a known-good beacon** — repeat the above. The send
   sheet should display fees; the wallet home should show SPL balances and
   recent activity. Cross-check explorer URLs match.
3. **Isolated mode** — fee estimate should surface "No Solana route
   available" instead of silently falling back.
4. `npx tsc --noEmit` clean, `npx expo lint` clean.

## Out of scope

- Caching strategies on the adapters (today: none — each call is a fresh
  RPC). Caller-side cooldowns in `useWalletBalance` remain.
- Retry / backoff in `MeshRpcAdapter` — currently a single 30 s timeout per
  call. If the migration surfaces flakiness on mesh, add retry there, not
  at call sites.

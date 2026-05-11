# AnonMesh × QVAC — The Sovereign Stack

AnonMesh is the only Solana wallet that runs entirely on infrastructure the user owns. Adding QVAC closes the last layer.

| Layer | Sovereignty | How AnonMesh delivers it |
|---|---|---|
| **Keys** | Local | Seed Vault / Keystore / Keychain. Signatures never leave the device. |
| **Transport** | Mesh | LXMF over Reticulum — BLE, LoRa, TCP. Tx packets ride peer-to-peer; no server is in the path. |
| **Intelligence** | Local | QVAC on-device LLM. The prompt, the parsed fields, the memo, and the summary never reach a cloud model. |

Most QVAC submissions add the third layer to a stack that still depends on AWS for the first two. We're the only project where every layer of a payment — typing it, parsing it, signing it, delivering it, summarizing it on the receiving side — happens on hardware the user holds. That fit is the submission.

## Two QVAC surfaces

### 1. Private compose

Free-text payment requests are parsed against the locally-loaded `LLAMA_TOOL_CALLING_1B_INST_Q4_K` GGUF. The parser tries the tool-call path first (`prepareTransfer` with a Zod schema) and falls back to a constrained `responseFormat: json_schema` if the model declines to call the tool. Either path produces the same typed `TransferIntent`. The result is resolved against the local address book and held-balance list, then the existing `/send/review` screen takes over for signature.

Safety gates that fire *before* the user ever sees the slide-to-sign:

- Token must resolve to `SOL` — the AI cannot route SPL through this path; SPL stays on the manual screen where the SPL guardrails live.
- Recipient must resolve to a single saved contact, recent counterparty, or an explicit Solana address. Ambiguous matches stop the flow with a chooser prompt. Unknown labels drop the raw text into the address field and ask the user to confirm.
- Amount must format cleanly for the existing send route and must be ≤ the live held balance. The AI never overrides "insufficient funds."
- Memo is capped at 80 characters at schema time and lands on chain as a Memo program instruction (`MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr`).

### 2. Activity summaries

Every recent transaction on the home feed is rewritten as a one-sentence natural summary. Inputs to the model are restricted to fields that already exist on chain: direction, amount, token symbol, counterparty label (or short address), and memo. A deterministic validator gates the output:

- The exact amount string must appear in the summary
- The verbatim token symbol must appear
- The resolved counterparty token (label or short address) must appear
- The summary must fit inside 80 characters

Failed validations are dropped and the deterministic `Sent to 8DK4…B2FH` row is rendered instead. A misbehaving model can never produce misleading copy on a financial surface.

## Architecture

```
Alice's phone (offline)                              Bob's phone
────────────────────────                              ──────────
 "pay djason 0.05 SOL for coffee"
            │
            ▼
   QVAC.completion(tools=[prepareTransfer])  ◄── local llama.cpp in Bare worker
            │  toolCall event
            ▼
   Recipient resolver  ─►  ambiguous? unknown? stop
            │
            ▼
   ReviewCard prefilled (user confirms)
            │
            ▼
   sendTransaction  ─►  sign locally
            │
            ▼
   LXMF / Reticulum  ─────────────────────────►  inbound LXMF
                       BLE · LoRa · TCP                │
                                                       ▼
                                            QVAC.summarize(tx)
                                                       │
                                                       ▼
                                              Wallet activity row
```

Three sovereignty boundaries, three layers. AI never leaves the device. The signature never leaves the keypair. The transport never depends on a server.

## Bounty rubric mapping

| Criterion | Where it shows up |
|---|---|
| **Technical depth (40%)** | Tool-calling with `TOOLS_MODE.dynamic` plus constrained `responseFormat: json_schema` fallback; streamed `CompletionRun.events`; per-tx AsyncStorage cache with single-flight queue; deterministic summary validator; on-chain memo wired through the Memo program; safety gates layered between every model call and every signature. |
| **Product value (30%)** | Replaces the keyboard for repeat payments without leaking intent to a cloud; address-book resolution, ambiguous-recipient block, and balance check protect every transfer; summaries make the home feed readable without revealing more than what's already on chain. |
| **Innovation (20%)** | Only Solana wallet with a working mesh transport. Adding QVAC means typing a payment, signing it, delivering it, and summarizing it can all happen on devices the user owns. No cloud-AI submission can match the offline + mesh + local-intelligence combination. |
| **Demo quality (10%)** | `/qvac-smoke` exposes raw model load, streamed completion, and parser JSON on-device with first-token + total-ms metrics. `EXPO_PUBLIC_QVAC_ENABLED` isolates the bounty build. Network audit script supplies reviewable evidence behind the "no cloud" claim. |

## Threat model

- **Prompt and parsed fields never leave the device.** `parseTransferIntent`, `summarizeActivity`, and the smoke route all run against the locally-loaded model. The smoke screen surfaces first-token + total-ms metrics so reviewers can correlate CPU activity with local inference.
- **Model artifact is checksum-verified.** `downloadAsset` validates the GGUF against the QVAC registry on first run. Second-run loads hit the local cache; no further network access is required.
- **AI never overrides safety.** The recipient resolver refuses to auto-fill on ambiguous matches; balance is checked against the live wallet, not against any AI-derived value; the SPL guardrail in `resolveSendToken` routes every non-SOL symbol through `unsupported` so the AI path cannot bypass manual SPL controls.
- **Summary validator is deterministic.** Three required substrings (amount, token, counterparty) plus a length cap. Any failure mode renders the deterministic row instead.
- **Mesh transport is not assumed online.** Tx packets ride LXMF over Reticulum; the wallet works without a cellular or WiFi connection once the model and a peer reachable on BLE/LoRa are present.

## Network audit (no-cloud proof)

The "no cloud" claim should be auditable, not asserted. The repo ships a script that captures per-app network counters around a QVAC smoke run.

**Primary procedure (airplane-mode after cache):**

1. Build the app once with QVAC enabled and run `/qvac-smoke` so the model downloads and caches:
   ```bash
   EXPO_PUBLIC_QVAC_ENABLED=true npx expo run:android --device
   npm run qvac:smoke:android
   ```
2. Toggle **airplane mode ON** on the device.
3. Run the audit script while the operator launches the smoke route a second time:
   ```bash
   npm run qvac:audit:android
   # follow the on-screen prompt to launch /qvac-smoke on the device
   ```
4. The script writes `qvac-audit-<timestamp>.txt` with before/after byte counters from `/proc/uid_stat`. A passing run reports `rx_delta=0 tx_delta=0` because airplane mode blocks the radio entirely and the model is already cached.

**Deeper check (packet capture):**

1. Put a laptop in hotspot mode, connect the Seeker to that hotspot.
2. Run `tcpdump` or Wireshark on the laptop's tethering interface.
3. With the model already cached, run `/qvac-smoke` on the device.
4. Confirm zero outbound from the app's UID during inference. The only traffic should be background system services like NTP and the network stack itself.

What this proves:

- The model file is the only network artifact and is fetched once from a documented Tether-operated registry.
- Inference, intent parsing, and history summaries occur with zero outbound traffic.
- Toggling airplane mode does not change the QVAC behavior — the model continues to load, parse, and summarize.

## Rebuild

```bash
cd mobile_app
npm install
npm run qvac:bundle
EXPO_PUBLIC_QVAC_ENABLED=true npx expo run:android --device
```

QVAC is gated by `EXPO_PUBLIC_QVAC_ENABLED=true` so normal builds never pull the model.

## Smoke test

```bash
npm run qvac:smoke:android
```

Tap `Run smoke test`. Expected:

- `LLAMA_TOOL_CALLING_1B_INST_Q4_K` downloads and checksum-validates on first run
- The model loads through the bundled `llamacpp-completion` plugin
- A local completion streams
- The payment parser returns JSON for `send 0.000001 SOL to 11111111111111111111111111111111 with memo qvac smoke`

After the first run the model is cached under the app sandbox and the smoke test reuses it.

## Judge walkthrough

1. Open `send`.
2. Tap **Private compose**.
3. Enter `pay djason 0.05 SOL for coffee`.
4. QVAC parses locally and resolves `djason` from the address book.
5. The app opens the existing review screen with amount, recipient, route, memo, fee estimate, and slide-to-sign.
6. Try an ambiguous (`ali` against an address book with Alice + Alicia) or unknown (`whoever`) recipient to show the safety guards.
7. Return to the wallet tab. Recent activity rows render one-sentence summaries; any summary that fails the validator silently falls back to the deterministic row.
8. Run `/qvac-smoke` (`npm run qvac:smoke:android`) for the raw evidence: download progress, model load, streamed completion, parser JSON, first-token + total-ms metrics.
9. (Optional) Run `npm run qvac:audit:android` to capture the per-app traffic counters.

## QVAC APIs used

- `@qvac/sdk` Expo plugin and generated worker bundle (`qvac/worker.bundle.js`)
- `downloadAsset` for the model file
- `loadModel` with `TOOLS_MODE.dynamic`
- `completion` — both streamed (`stream: true`) and non-streamed
- streamed `CompletionRun.events` for `toolCall` and `contentDelta`
- Zod-backed transfer-tool schema
- Constrained `responseFormat: json_schema` fallback
- Pinned model: `LLAMA_TOOL_CALLING_1B_INST_Q4_K`

## File map

- `src/services/qvac/index.ts` — bootstrap, model lifecycle, `isQvacReady`
- `src/services/qvac/intent.ts` — tool-first parser + constrained JSON fallback
- `src/services/qvac/recipients.ts` — address-book resolution with ambiguous/unknown signals
- `src/services/qvac/tokens.ts` — SPL guardrail; only SOL routes through the AI path
- `src/services/qvac/amount.ts` — amount formatter shared with the manual send route
- `src/services/qvac/summarize.ts` — strict prompt + deterministic validator for history summaries
- `src/hooks/useActivitySummary.ts` — AsyncStorage cache, single-flight queue
- `components/send/NlComposeSheet.tsx` — local-only compose UI with progress and error states
- `components/send/RecipientPicker.tsx` — safety gates around the AI handoff
- `components/send/ReviewCard.tsx` — memo passthrough to fee estimate and signer
- `components/home/RecentActivity.tsx` — summary subtitle with deterministic fallback
- `app/qvac-smoke.tsx` — physical-device smoke surface with first-token + total-ms metrics
- `app/send/review.tsx` — accepts memo from the deep link and the AI flow
- `src/services/sendTransaction.ts` — Memo program instruction wiring
- `scripts/qvac-audit-android.sh` — network-audit harness
- `scripts/validate-tier0-services.mjs` — resolver, tool schema, and summary-validator unit tests

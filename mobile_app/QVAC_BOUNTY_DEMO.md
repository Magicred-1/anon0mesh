# AnonMesh QVAC Bounty Demo

## Why this integration fits

AnonMesh is a mesh-first Solana wallet. QVAC adds local intelligence at the exact point where a wallet user handles sensitive intent: turning a private payment request into a reviewed transaction. The app does not send the prompt, recipient label, amount, or memo to a cloud model.

The bounty build uses QVAC's on-device LLM at two distinct surfaces:

1. **Private compose.** Parses a free-text payment request with a tool-first path and a constrained JSON fallback, resolves it against the local address book, blocks ambiguous recipients, checks the live SOL balance, preserves the payment reason as an on-chain memo, and routes the user into the normal review/sign flow.
2. **Activity summaries.** Rewrites each recent transaction on the home feed as a one-sentence natural summary, gated by a deterministic validator that rejects any output that doesn't contain the exact amount, the verbatim token symbol, and the resolved counterparty token. Failed validations fall back to the existing deterministic row rendering, so a model misfire never produces misleading copy.

## Bounty rubric mapping

| Criterion | Where it shows up |
|---|---|
| Technical depth (40%) | Tool-calling with `TOOLS_MODE.dynamic`, constrained `responseFormat: json_schema` fallback, streamed `CompletionRun.events`, per-tx AsyncStorage cache, deterministic validator, on-chain memo wiring through `MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr`. |
| Product value (30%) | Replaces the keyboard for repeat payments without leaking intent to a cloud. Address-book resolution, ambiguous-recipient block, and balance check protect every transfer. |
| Innovation (20%) | Local LLM as the payment intent layer for a mesh-capable Solana wallet — the prompt, the parsed fields, and the memo never leave the device. |
| Demo quality (10%) | `/qvac-smoke` exposes raw model load, streamed completion, and parser JSON on-device. `EXPO_PUBLIC_QVAC_ENABLED` flag isolates the bounty build. |

## Threat model

- **Prompt never leaves the device.** `parseTransferIntent` runs against the locally-loaded model. Smoke screen surfaces first-token + total-ms metrics so a judge can confirm CPU activity correlates with local inference.
- **Model artifact is verified.** `downloadAsset` performs checksum validation through the QVAC registry; second-run loads hit the local cache.
- **AI never overrides safety.** The recipient resolver refuses to auto-fill on ambiguous matches; balance is checked against the live wallet, not against any AI-derived value; the SPL guardrail in `resolveSendToken` routes every non-SOL symbol through `unsupported` so the AI path cannot bypass manual SPL controls.
- **Summary validator is deterministic.** A model summary must contain the exact amount string, the verbatim token symbol, and the resolved counterparty token, all within 80 characters. Anything else is dropped and the deterministic row is rendered instead.

## Rebuild

```bash
cd mobile_app
npm install
npm run qvac:bundle
EXPO_PUBLIC_QVAC_ENABLED=true npx expo run:android --device
```

QVAC is intentionally gated by `EXPO_PUBLIC_QVAC_ENABLED=true` so normal builds do not ship the local model path by accident.

## Smoke Test

```bash
npm run qvac:smoke:android
```

Tap `Run smoke test`.

Expected result:

- QVAC downloads and checksum-validates `LLAMA_TOOL_CALLING_1B_INST_Q4_K`
- The model loads through the bundled `llamacpp-completion` plugin
- A local completion streams
- The payment parser returns JSON for:
  `send 0.000001 SOL to 11111111111111111111111111111111 with memo qvac smoke`

After the first run, the model is cached under the app sandbox and the smoke test reuses the local file.

## Judge Walkthrough

1. Open `send`.
2. Tap `Private compose`.
3. Enter `pay djason 0.05 SOL for coffee`.
4. QVAC parses locally and resolves `djason` from the address book.
5. The app opens the existing review screen with amount, recipient, route, memo, fee estimate, and slide-to-sign.
6. Try an ambiguous or unknown recipient to show the safety guard.
7. Return to the wallet tab. Recent activity rows now render one-sentence summaries; any summary that fails the validator silently falls back to the deterministic row.
8. Run `/qvac-smoke` (deep link or dev route) to show raw local model loading, completion, and payment parser evidence.

## QVAC APIs Used

- `@qvac/sdk` Expo plugin and generated worker bundle
- `downloadAsset`
- `loadModel` with `TOOLS_MODE.dynamic`
- `completion` (streamed and non-streamed)
- streamed `CompletionRun.events` for `toolCall` and `contentDelta`
- Zod-backed transfer tool parsing
- constrained `responseFormat: json_schema` fallback
- `LLAMA_TOOL_CALLING_1B_INST_Q4_K` model pin

## Where the integration lives

- `src/services/qvac/index.ts` — bootstrap, model lifecycle, ready check
- `src/services/qvac/intent.ts` — tool-first parser + constrained JSON fallback
- `src/services/qvac/recipients.ts` — address-book resolution with ambiguous/unknown signals
- `src/services/qvac/tokens.ts` — SPL guardrail; only SOL routes through AI today
- `src/services/qvac/summarize.ts` — strict prompt + deterministic validator for history summaries
- `src/hooks/useActivitySummary.ts` — AsyncStorage cache, single-flight queue
- `components/send/NlComposeSheet.tsx` — local-only compose UI with progress and error states
- `components/send/RecipientPicker.tsx` — safety gates around the AI handoff
- `components/home/RecentActivity.tsx` — summary subtitle, deterministic fallback
- `app/qvac-smoke.tsx` — physical-device smoke surface with first-token + total-ms metrics
- `scripts/validate-tier0-services.mjs` — resolver, tool schema, and summary-validator unit tests

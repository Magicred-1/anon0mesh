# AnonMesh QVAC Bounty Demo

## Why this integration fits

AnonMesh is a mesh-first Solana wallet. QVAC adds local intelligence at the exact point where a wallet user handles sensitive intent: turning a private payment request into a reviewed transaction. The app does not send the prompt, recipient label, amount, or memo to a cloud model.

The bounty build uses QVAC's on-device LLM to parse a transfer with a tool-first path and a constrained JSON fallback, resolves it against the local address book, blocks ambiguous recipients, checks the live SOL balance, preserves the payment reason as an on-chain memo, and routes the user into the normal review/sign flow.

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
7. Run `/qvac-smoke` to show raw local model loading, completion, and payment parser evidence.

## QVAC APIs Used

- `@qvac/sdk` Expo plugin and generated worker bundle
- `downloadAsset`
- `loadModel`
- `completion`
- streamed `CompletionRun.events`
- Zod-backed transfer tool parsing
- constrained `responseFormat: json_schema` fallback
- `TOOLS_MODE.dynamic` for per-request tool definitions

import "@/polyfills";

import { Connection } from "@solana/web3.js";

// Devnet-only for safety. Mainnet wiring is a deliberate future decision —
// we don't want mainnet funds going out via a dev build.
//
// EXPO_PUBLIC_SOLANA_RPC lets teams point at a dedicated devnet endpoint
// (Helius / QuickNode / Triton free tier) to avoid the public endpoint's
// 429 rate-limits. Falls back to the public endpoint when unset so cloning
// the repo "just works".
const DEFAULT_DEVNET_RPC = "https://api.devnet.solana.com";
const RPC_URL = process.env.EXPO_PUBLIC_SOLANA_RPC || DEFAULT_DEVNET_RPC;

export const solanaConnection = new Connection(RPC_URL, "confirmed");

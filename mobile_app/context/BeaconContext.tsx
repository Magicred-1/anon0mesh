/**
 * BeaconContext — Solana on-chain beacon registry client.
 *
 * Wraps the `anonbeta1` Anchor program: register one beacon PDA per
 * operator wallet, send periodic heartbeats while the LXMF node is
 * running and the device has internet. Distinct from LxmfContext's
 * `setBeaconMode` which only toggles LXMF announce-with-app-data.
 *
 * Signing path mirrors `src/services/sendTransaction.ts` (local key →
 * Keypair.sign + zero, MWA → transact + signTransactions). Duplicated
 * here intentionally to keep beacon flow self-contained for the
 * Frontier sprint; unify post-submission.
 *
 * Heartbeat scheduler (60s, foreground-only):
 *   - Gates: lxmf.status.running && isRegistered && wallet.connected
 *            && networkMode === 'online' && AppState === 'active'
 *   - Pauses on background (no battery drain, no failed signs)
 *   - Single in-flight (skips tick if previous still pending)
 *
 * IDL is not yet available — instruction builders use placeholder
 * Anchor discriminators computed at runtime via expo-crypto. Account
 * decoder is hand-rolled per haumea's locked layout. Swap to
 * `@coral-xyz/anchor` Program client once `target/idl/anonbeta1.json`
 * lands; the function shapes here are pre-aligned.
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  clusterApiUrl,
} from '@solana/web3.js';
import { transact } from '@solana-mobile/mobile-wallet-adapter-protocol-web3js';
import { Buffer } from 'buffer';

import { useWallet } from '@/context/WalletContext';
import { useLxmfContext } from '@/context/LxmfContext';
import { useNetworkMode } from '@/src/hooks/useNetworkMode';
import { SecureKeys, secureGet, secureSet } from '@/src/storage';
import {
  ANONBETA1_PROGRAM_ID,
  buildHeartbeatIx,
  buildRegisterBeaconIx,
  decodeBeaconAccount,
  deriveBeaconPda,
  isValidRegionCode,
  type BeaconAccount,
  type BeaconStatus,
} from '@/src/services/beaconRegistry';

// ── RPC ──────────────────────────────────────────────────────────────────────
// Per haumea's nit: WalletContext does not expose a Connection. Construct
// locally with the same env-var-then-default pattern used by
// `src/services/sendTransaction.ts`. Devnet only — mainnet is a deliberate
// future decision.
const RPC_URL =
  process.env.EXPO_PUBLIC_SOLANA_RPC || clusterApiUrl('devnet');

const beaconConnection = new Connection(RPC_URL, 'confirmed');

const APP_IDENTITY = {
  name: 'anonmesh',
  uri:  'https://anonme.sh',
  icon: '/favicon.ico',
};

const HEARTBEAT_INTERVAL_MS = 60_000;
const ACCOUNT_FETCH_RETRY_MS = 5_000;

// ── Helpers ──────────────────────────────────────────────────────────────────

function hexToBytes16(hex: string): Uint8Array | null {
  if (!/^[0-9a-fA-F]{32}$/.test(hex)) return null;
  const bytes = new Uint8Array(16);
  for (let i = 0; i < 16; i++) {
    bytes[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

interface MwaAuthResult {
  auth_token: string;
  accounts:   { address: string }[];
}

/**
 * Sign + submit a beacon transaction. Mirrors the canonical pattern
 * from `src/services/sendTransaction.ts::signAndSubmitTransaction` —
 * intentional duplication, see header note.
 */
async function signAndSubmitBeaconTx(
  walletAdapter: import('@/src/infrastructure/wallet').IWalletAdapter,
  expectedPubkey: PublicKey,
  tx: Transaction,
): Promise<string> {
  const { blockhash } = await beaconConnection.getLatestBlockhash('confirmed');
  tx.recentBlockhash = blockhash;
  tx.feePayer = expectedPubkey;

  if (walletAdapter.getMode() === 'local') {
    const secretKey = await walletAdapter.exportSecretKey();
    try {
      const kp = Keypair.fromSecretKey(secretKey);
      tx.sign(kp);
      return await beaconConnection.sendRawTransaction(tx.serialize());
    } finally {
      secretKey.fill(0);
    }
  }

  // MWA path
  const cachedToken = await secureGet(SecureKeys.MWA_TOKEN);
  let signedTx: Transaction | undefined;
  await transact(async (mwaWallet) => {
    const auth = await mwaWallet.reauthorize({
      auth_token: cachedToken ?? '',
      identity:   APP_IDENTITY,
    });
    const nextToken = (auth as MwaAuthResult).auth_token;
    if (nextToken) await secureSet(SecureKeys.MWA_TOKEN, nextToken);

    const sessionPubkey = new PublicKey(
      Buffer.from(auth.accounts[0].address, 'base64'),
    );
    if (sessionPubkey.toBase58() !== expectedPubkey.toBase58()) {
      throw new Error(
        `MWA account mismatch — expected ${expectedPubkey.toBase58().slice(0, 8)}…, ` +
        `wallet returned ${sessionPubkey.toBase58().slice(0, 8)}…`,
      );
    }
    tx.feePayer = sessionPubkey;
    const signed = await mwaWallet.signTransactions({ transactions: [tx] });
    signedTx = signed[0];
  });
  if (!signedTx) throw new Error('Wallet did not return a signed transaction');
  return await beaconConnection.sendRawTransaction(signedTx.serialize());
}

// ── Context ──────────────────────────────────────────────────────────────────

interface BeaconCtxValue {
  status:           BeaconStatus;
  isRegistered:     boolean;
  isPending:        boolean;
  lastHeartbeatAt:  number | null;     // unix seconds, local clock estimate
  lastHeartbeatTx:  string | null;     // most recent heartbeat tx signature
  lastError:        string | null;
  beaconPda:        PublicKey | null;
  refresh:          () => Promise<void>;
  register:         (regionCode: Uint8Array) => Promise<string>; // returns tx sig
}

const BeaconCtx = createContext<BeaconCtxValue | null>(null);

interface BeaconProviderProps {
  children: ReactNode;
}

export function BeaconProvider({ children }: BeaconProviderProps) {
  const { wallet, publicKey, isConnected } = useWallet();
  const { status: lxmfStatus, isRunning } = useLxmfContext();
  const { mode: networkMode }              = useNetworkMode();

  const [status,          setStatus]          = useState<BeaconStatus>({ state: 'unknown' });
  const [isPending,       setIsPending]       = useState(false);
  const [lastHeartbeatAt, setLastHeartbeatAt] = useState<number | null>(null);
  const [lastHeartbeatTx, setLastHeartbeatTx] = useState<string | null>(null);
  const [lastError,       setLastError]       = useState<string | null>(null);
  const [appActive,       setAppActive]       = useState(true);

  // Track in-flight heartbeat to avoid overlapping ticks. setState is async
  // and the 60s timer can fire mid-flight after a slow signing prompt.
  const heartbeatInflightRef = useRef(false);

  const beaconPda = useMemo<PublicKey | null>(() => {
    if (!publicKey) return null;
    return deriveBeaconPda(publicKey)[0];
  }, [publicKey]);

  // ── AppState gating ──────────────────────────────────────────────────────
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s: AppStateStatus) => {
      setAppActive(s === 'active');
    });
    return () => sub.remove();
  }, []);

  // ── Account fetch / refresh ──────────────────────────────────────────────
  const refresh = useCallback(async () => {
    if (!beaconPda) {
      setStatus({ state: 'unknown' });
      return;
    }
    try {
      const info = await beaconConnection.getAccountInfo(beaconPda, 'confirmed');
      if (!info) {
        setStatus({ state: 'unregistered' });
        return;
      }
      const decoded = decodeBeaconAccount(info.data);
      if (!decoded) {
        setStatus({ state: 'unknown' });
        setLastError('beacon account exists but failed to decode');
        return;
      }
      setStatus({ state: 'registered', account: decoded });
      setLastError(null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setLastError(`refresh failed: ${msg}`);
      setStatus({ state: 'unknown' });
    }
  }, [beaconPda]);

  // Initial fetch + refetch on PDA change. Retries once after a short delay
  // if the first fetch hits 'unknown' (transient RPC error vs unregistered).
  useEffect(() => {
    if (!beaconPda) return;
    let cancelled = false;
    refresh().then(() => {
      if (cancelled) return;
      // setStatus is async; check via callback
      setStatus((s) => {
        if (s.state === 'unknown') {
          setTimeout(() => { if (!cancelled) refresh(); }, ACCOUNT_FETCH_RETRY_MS);
        }
        return s;
      });
    });
    return () => { cancelled = true; };
  }, [beaconPda, refresh]);

  // ── Register ─────────────────────────────────────────────────────────────
  const register = useCallback(
    async (regionCode: Uint8Array): Promise<string> => {
      if (!wallet || !publicKey || !isConnected) {
        throw new Error('wallet not connected');
      }
      if (!lxmfStatus?.addressHex) {
        throw new Error('LXMF address not available — start node first');
      }
      if (!isValidRegionCode(regionCode)) {
        throw new Error('region_code must be 4 bytes (printable ASCII or all-zero)');
      }
      const rnsDestHash = hexToBytes16(lxmfStatus.addressHex);
      if (!rnsDestHash) {
        throw new Error(`LXMF addressHex is not 32 hex chars: ${lxmfStatus.addressHex}`);
      }

      setIsPending(true);
      setLastError(null);
      try {
        const ix = await buildRegisterBeaconIx({
          operator: publicKey,
          rnsDestHash,
          regionCode,
        });
        const tx = new Transaction().add(ix);
        const sig = await signAndSubmitBeaconTx(wallet, publicKey, tx);
        // Optimistic refresh — confirmed-commitment fetch should pick up the
        // new account within a slot or two.
        setTimeout(() => { refresh(); }, 2_000);
        return sig;
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        setLastError(`register failed: ${msg}`);
        throw err;
      } finally {
        setIsPending(false);
      }
    },
    [wallet, publicKey, isConnected, lxmfStatus?.addressHex, refresh],
  );

  // ── Heartbeat scheduler ──────────────────────────────────────────────────

  const sendHeartbeat = useCallback(async () => {
    if (heartbeatInflightRef.current) return;
    if (!wallet || !publicKey) return;
    heartbeatInflightRef.current = true;
    try {
      const ix = await buildHeartbeatIx({ operator: publicKey });
      const tx = new Transaction().add(ix);
      const sig = await signAndSubmitBeaconTx(wallet, publicKey, tx);
      setLastHeartbeatAt(Math.floor(Date.now() / 1000));
      setLastHeartbeatTx(sig);
      setLastError(null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setLastError(`heartbeat failed: ${msg}`);
    } finally {
      heartbeatInflightRef.current = false;
    }
  }, [wallet, publicKey]);

  const isRegistered = status.state === 'registered';

  useEffect(() => {
    const canHeartbeat =
      isRunning &&
      isRegistered &&
      isConnected &&
      networkMode === 'online' &&
      appActive;

    if (!canHeartbeat) return;
    // Don't fire immediately on gate-flip — wait one full interval. This
    // avoids a heartbeat storm if gates flap (e.g. brief AppState toggle).
    const id = setInterval(sendHeartbeat, HEARTBEAT_INTERVAL_MS);
    return () => clearInterval(id);
  }, [isRunning, isRegistered, isConnected, networkMode, appActive, sendHeartbeat]);

  // ── Provided value ───────────────────────────────────────────────────────
  const value = useMemo<BeaconCtxValue>(() => ({
    status,
    isRegistered,
    isPending,
    lastHeartbeatAt,
    lastHeartbeatTx,
    lastError,
    beaconPda,
    refresh,
    register,
  }), [status, isRegistered, isPending, lastHeartbeatAt, lastHeartbeatTx, lastError, beaconPda, refresh, register]);

  return <BeaconCtx.Provider value={value}>{children}</BeaconCtx.Provider>;
}

export function useBeaconRegistry(): BeaconCtxValue {
  const ctx = useContext(BeaconCtx);
  if (!ctx) throw new Error('useBeaconRegistry must be used within a BeaconProvider');
  return ctx;
}

export { ANONBETA1_PROGRAM_ID } from '@/src/services/beaconRegistry';
export type { BeaconAccount, BeaconStatus };

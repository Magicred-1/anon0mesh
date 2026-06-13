import type { NetworkMode } from '@/src/infrastructure/network';
import { summarizeError } from '@/src/utils/errors';

import type { ConfirmResult } from './sendTransaction';

export interface FailureCopy {
  /** One-line, user-readable explanation for the FailureCard subtitle. */
  readonly subtitle: string;
  /** Short tag for the status pill. Adapts to mesh vs online when relevant. */
  readonly pillLabel: string;
}

type FailedResult = Extract<ConfirmResult, { kind: 'failed' }>;

// Shared between the confirmation-stage and submission-stage classifiers.
const INSUFFICIENT_FUNDS_RE =
  /insufficient ?funds|insufficient ?lamports|insufficient ?fee|found no record of a prior credit/i;

/**
 * Map a confirmation-stage failure to user-facing copy. Pattern-matches
 * common Solana error shapes against a stringified view of the error so we
 * catch both string-form and object-form TransactionError values.
 *
 * Pure — no React, safe to unit test.
 */
export function describeSendFailure(result: FailedResult, mode: NetworkMode): FailureCopy {
  // Confirmation-poll budget expired AFTER the signed tx was handed to the
  // network/relay. The broadcast outcome is genuinely unknown here, so the
  // copy must never claim "nothing was sent" — it may have landed.
  if (result.reason === 'timeout') {
    if (mode === 'mesh') {
      return {
        subtitle:
          'submitted over the mesh, confirmation unknown — check activity before retrying',
        pillLabel: 'Mesh timeout',
      };
    }
    return {
      subtitle: 'submitted, confirmation unknown — check activity before retrying',
      pillLabel: 'Network timeout',
    };
  }

  // reason === 'on-chain'
  const haystack = serializeForMatch(result.err);

  if (/blockhashnotfound|blockhash not found|block ?height ?exceeded/i.test(haystack)) {
    return {
      subtitle: "Network was too busy — the tx didn't land before the blockhash expired.",
      pillLabel: 'Blockhash expired',
    };
  }
  if (INSUFFICIENT_FUNDS_RE.test(haystack)) {
    return {
      subtitle: 'Not enough SOL to cover the amount plus network fees.',
      pillLabel: 'Insufficient funds',
    };
  }
  if (/account ?(does ?)?not ?exist|account ?not ?found|invalid ?account/i.test(haystack)) {
    return {
      subtitle: "Recipient account doesn't exist on chain yet.",
      pillLabel: 'Account missing',
    };
  }
  if (/instructionerror|custom ?error|program ?error/i.test(haystack)) {
    return {
      subtitle: 'The token program rejected this transfer.',
      pillLabel: 'Program error',
    };
  }

  return {
    subtitle: 'Transaction failed on chain. Tap "View error details" below for the raw response.',
    pillLabel: 'Failed on chain',
  };
}

// ── Submission-stage failures ─────────────────────────────────────────────────
//
// Errors thrown from sendSolTransfer / sendSplTransfer before confirmation
// polling starts. Every throw that can reach ReviewCard's catch happens BEFORE
// the transaction was broadcast (build/blockhash/signing failures, wallet
// declines, and node-side preflight rejections — submitSignedTransaction
// returns the signature instead of throwing for any ambiguous submit error),
// so "nothing was sent" is honest for every class below. Post-submit ambiguity
// is the confirmation path's job — see describeSendFailure's timeout branch.

export type SubmitFailureKind =
  | 'wallet-timeout'
  | 'wallet-declined'
  | 'insufficient-funds'
  | 'mesh-unreachable'
  | 'network'
  | 'unknown';

export interface SubmitFailureCopy {
  readonly kind: SubmitFailureKind;
  /**
   * Human headline for the inline "Transfer not sent" panel and the failure
   * toast. Always states the user's actual situation (sent vs not sent).
   */
  readonly message: string;
  /**
   * Raw technical detail (e.g. the platform exception text), demoted to a
   * small monospace sub-line. Omitted when the headline already carries the
   * full information.
   */
  readonly detail?: string;
}

// MWA wallet-approval timeout surfaces as the Android session-layer exception,
// e.g. "java.util.concurrent.TimeoutException: Timed out waiting for response
// with id=2" (device-verified 2026-06-10).
const WALLET_TIMEOUT_RE = /timed ?out waiting for response|java\.util\.concurrent\.TimeoutException/i;

// Transport-level failures: our own withTimeout/TimeoutError text, fetch-layer
// failures from the direct RPC path, and mesh broadcast failures ("No beacons
// discovered yet" from beaconBroadcastRpc, Promise.any's AggregateError, and
// malformed relay responses).
const TRANSPORT_FAILURE_RE =
  /timed out after \d+ms|network request failed|failed to fetch|fetch failed|networkerror|econnrefused|enotfound|etimedout|socket|connection (?:refused|reset|closed)|no beacons discovered|all promises were rejected|malformed mesh rpc response/i;

/**
 * True when a message reads like developer goo (JVM class paths, serialized
 * JSON, oversized dumps) rather than copy a human should see as a headline.
 * Our own deliberate throws ("Invalid recipient address", the MWA account
 * mismatch guidance, …) pass through untouched.
 */
function looksLikeDeveloperGoo(message: string): boolean {
  if (/(?:[A-Za-z_$][\w$]*\.){2,}[A-Z][\w$]*(?:Exception|Error)\b/.test(message)) return true;
  if (/^\s*[[{"]/.test(message)) return true;
  return message.length > 160;
}

function compactDetail(err: unknown): string {
  const summary = summarizeError(err, 'Unknown error');
  if (summary.name && summary.name !== 'Error' && !summary.message.includes(summary.name)) {
    return `${summary.name}: ${summary.message}`;
  }
  return summary.message;
}

/**
 * Map a submission-stage throw to user-facing copy. Classification only —
 * retry/state-machine behavior is owned by the caller.
 *
 * Pure — no React, safe to unit test.
 */
export function describeSubmitFailure(err: unknown, mode: NetworkMode): SubmitFailureCopy {
  const summary = summarizeError(err, 'Transaction failed before the wallet returned a reason');
  const haystack = serializeForMatch(err);
  const detail = compactDetail(err);

  // User backed out in the wallet UI. Callers may keep this silent (the wallet
  // popup is the consent surface — LESSON 2026-05-13) but the class still
  // needs honest copy for any surface that does render it.
  if (summary.name === 'TransactionNotApprovedError') {
    return {
      kind: 'wallet-declined',
      message: 'you declined in your wallet — nothing was sent',
    };
  }

  if (WALLET_TIMEOUT_RE.test(haystack)) {
    return {
      kind: 'wallet-timeout',
      message: "the wallet didn't respond — nothing was sent",
      detail,
    };
  }

  if (INSUFFICIENT_FUNDS_RE.test(haystack)) {
    return {
      kind: 'insufficient-funds',
      message: 'not enough SOL to cover the amount plus network fees — nothing was sent',
      detail,
    };
  }

  if (summary.name === 'TimeoutError' || summary.name === 'MeshResponseParseError' || TRANSPORT_FAILURE_RE.test(haystack)) {
    if (mode === 'mesh') {
      return {
        kind: 'mesh-unreachable',
        message: "couldn't reach a relay — your funds didn't move",
        detail,
      };
    }
    return {
      kind: 'network',
      message: "couldn't reach the network — nothing was sent",
      detail,
    };
  }

  // Unrecognized. Our own throws are already written for humans — let them
  // through. Anything that smells like a platform exception gets a neutral
  // headline with the goo demoted to the detail line.
  if (looksLikeDeveloperGoo(summary.message)) {
    return {
      kind: 'unknown',
      message: 'something went wrong — nothing was sent',
      detail,
    };
  }
  return {
    kind: 'unknown',
    message: summary.message,
    detail: detail === summary.message ? undefined : detail,
  };
}

/**
 * Multi-line pretty-print of an error for the FailureCard's collapsible
 * "View error details" section. Plugs `summarizeError` so we get the same
 * extraction logic the rest of the app uses.
 */
export function formatRawError(err: unknown): string {
  const summary = summarizeError(err, 'Unknown error');
  const lines: string[] = [];
  if (summary.name) lines.push(`name:    ${summary.name}`);
  if (summary.code !== undefined && summary.code !== null) lines.push(`code:    ${summary.code}`);
  lines.push(`message: ${summary.message}`);
  if (summary.cause) lines.push(`cause:   ${summary.cause}`);
  if (summary.raw) lines.push(`raw:     ${summary.raw}`);
  return lines.join('\n');
}

function serializeForMatch(err: unknown): string {
  // Combine summarizeError's extracted view with a raw JSON stringify so
  // pattern matchers can see object-form TransactionError keys like
  // { InstructionError: [...] } as well as string-form messages.
  const summary = summarizeError(err, '');
  const parts: string[] = [summary.message];
  if (summary.name) parts.push(summary.name);
  if (summary.raw) parts.push(summary.raw);
  if (summary.cause) parts.push(summary.cause);
  try {
    parts.push(JSON.stringify(err));
  } catch {
    // err contains a circular ref or non-serializable; rely on summary
  }
  return parts.join(' ');
}

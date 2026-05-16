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

/**
 * Map a confirmation-stage failure to user-facing copy. Pattern-matches
 * common Solana error shapes against a stringified view of the error so we
 * catch both string-form and object-form TransactionError values.
 *
 * Pure — no React, safe to unit test.
 */
export function describeSendFailure(result: FailedResult, mode: NetworkMode): FailureCopy {
  if (result.reason === 'timeout') {
    if (mode === 'mesh') {
      return {
        subtitle:
          "Mesh route didn't respond in time. Your tx may still settle — check the explorer below.",
        pillLabel: 'Mesh timeout',
      };
    }
    return {
      subtitle:
        "Network didn't respond in time. Your tx may still settle — check the explorer below.",
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
  if (/insufficient ?funds|insufficient ?lamports|insufficient ?fee/i.test(haystack)) {
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

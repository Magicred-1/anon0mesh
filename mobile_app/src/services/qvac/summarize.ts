import { initQvac, type QvacProgress } from './index.ts';

export type SummaryDirection = 'send' | 'receive';

export interface SummaryInput {
  readonly signature: string;
  readonly direction: SummaryDirection;
  readonly amountStr: string;
  readonly symbol: string;
  readonly counterpartyLabel: string | null;
  readonly counterpartyShortAddress: string;
  readonly memo: string | null;
}

const SYSTEM_PROMPT =
  'You summarize one Solana transaction for a wallet history feed. Reply with ONE short sentence under 60 characters. Use ONLY the fields supplied. Never invent names, amounts, or memos. Reply with just the sentence, no quotation marks, no labels.';

const MAX_SUMMARY_CHARS = 80;

export function buildSummaryUserMessage(input: SummaryInput): string {
  const counterparty = input.counterpartyLabel?.trim().length
    ? input.counterpartyLabel.trim()
    : input.counterpartyShortAddress;
  const memo = input.memo?.trim().length ? input.memo.trim() : '(none)';
  return [
    `direction: ${input.direction === 'send' ? 'outgoing' : 'incoming'}`,
    `amount: ${input.amountStr}`,
    `token: ${input.symbol}`,
    `counterparty: ${counterparty}`,
    `memo: ${memo}`,
  ].join('\n');
}

export function summaryCounterpartyToken(input: SummaryInput): string {
  return input.counterpartyLabel?.trim().length
    ? input.counterpartyLabel.trim()
    : input.counterpartyShortAddress;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function validateSummary(text: string, input: SummaryInput): boolean {
  const trimmed = text.trim();
  if (!trimmed || trimmed.length > MAX_SUMMARY_CHARS) return false;
  if (!trimmed.includes(input.amountStr)) return false;
  const symbolPattern = new RegExp(`\\b${escapeRegExp(input.symbol)}\\b`, 'i');
  if (!symbolPattern.test(trimmed)) return false;
  const counterpartyToken = summaryCounterpartyToken(input);
  if (!new RegExp(escapeRegExp(counterpartyToken), 'i').test(trimmed)) return false;
  return true;
}

function stripWrappingQuotes(value: string): string {
  return value
    .trim()
    .replace(/^[\s"“'`]+/, '')
    .replace(/[\s"”'`]+$/, '');
}

export async function summarizeActivity(
  input: SummaryInput,
  onProgress?: (progress: QvacProgress) => void,
): Promise<string> {
  const qvac = await initQvac(onProgress);
  const sdk = await import('@qvac/sdk');
  const run = sdk.completion({
    modelId: qvac.modelId,
    stream: false,
    history: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: buildSummaryUserMessage(input) },
    ],
    generationParams: {
      temp: 0.1,
      predict: 60,
    },
  });

  const final = await run.final;
  const raw = final.contentText || final.raw.fullText || '';
  const text = stripWrappingQuotes(raw).split(/\r?\n/)[0] ?? '';
  if (!validateSummary(text, input)) {
    throw new Error('summary failed validator');
  }
  return text;
}

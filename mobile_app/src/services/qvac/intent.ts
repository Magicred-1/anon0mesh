import { z } from 'zod';

import { initQvac, type QvacProgress } from './index.ts';

const DEFAULT_TOKEN = 'SOL';

const amountSchema = z.preprocess((value) => {
  if (typeof value === 'number') return value;
  if (typeof value !== 'string') return value;

  const trimmed = value.trim();
  if (!/^\d+(?:\.\d+)?$/.test(trimmed)) return value;
  return Number(trimmed);
}, z.number().positive());

const transferArgsSchema = z.object({
  recipient: z.string().min(1),
  amount: amountSchema,
  token: z.preprocess((value) => {
    if (value == null) return undefined;
    if (typeof value !== 'string') return value;
    const trimmed = value.trim();
    return trimmed.length === 0 ? undefined : trimmed;
  }, z.string().min(1).default(DEFAULT_TOKEN)),
  memo: z.preprocess((value) => {
    if (value == null) return undefined;
    return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
  }, z.string().max(80).optional()),
});

export type TransferIntent = z.infer<typeof transferArgsSchema>;

const schemaFallbackResult = z.object({
  isPayment: z.boolean(),
  recipient: z.string(),
  amount: z.number(),
  token: z.string(),
  memo: z.string(),
});

export const prepareTransferTool = {
  name: 'prepareTransfer',
  description:
    'Prepare a Solana wallet transfer. Call this tool whenever the user clearly asks to pay, send, tip, or transfer tokens. Use the recipient label exactly as written.',
  parameters: z.object({
    recipient: z.string().describe('Recipient label, nickname, or Solana address exactly as the user wrote it.'),
    amount: z.number().describe('Amount of tokens to send.'),
    token: z.string().optional().describe('Token symbol, such as SOL. Use SOL when the user leaves it out.'),
    memo: z.string().max(80).optional().describe('Optional memo or reason from the user.'),
  }),
  handler: async (args: Record<string, unknown>) => transferArgsSchema.parse(args),
};

export async function parseTransferIntent(
  prompt: string,
  onProgress?: (progress: QvacProgress) => void,
): Promise<TransferIntent> {
  const qvac = await initQvac(onProgress);
  const sdk = await import('@qvac/sdk');
  const toolResult = await parseWithToolCall(sdk, qvac.modelId, prompt).catch(() => null);
  if (toolResult) return toolResult;

  return parseWithSchemaFallback(sdk, qvac.modelId, prompt);
}

async function parseWithToolCall(
  sdk: typeof import('@qvac/sdk'),
  modelId: string,
  prompt: string,
): Promise<TransferIntent | null> {
  const run = sdk.completion({
    modelId,
    stream: true,
    tools: [prepareTransferTool],
    history: [
      {
        role: 'system',
        content:
          'You are a wallet intent parser. For payment requests, respond only by calling prepareTransfer exactly once. If the request is not a payment, do not call a tool. Use SOL when the user omits the token. Use the payment reason as memo when present. Never invent a recipient or amount. Example: "pay djason 0.05 for coffee" calls prepareTransfer with recipient "djason", amount 0.05, token "SOL", memo "coffee".',
      },
      { role: 'user', content: prompt },
    ],
    generationParams: {
      temp: 0,
      predict: 192,
    },
  });

  let toolArgs: unknown = null;
  let toolError: string | null = null;
  for await (const event of run.events) {
    if (event.type === 'toolCall' && event.call.name === prepareTransferTool.name) {
      toolArgs = event.call.arguments;
      break;
    }
    if (event.type === 'toolError') {
      toolError = event.error.message;
    }
  }

  const final = await run.final;
  if (!toolArgs) {
    const call = final.toolCalls.find((candidate) => candidate.name === prepareTransferTool.name);
    if (call) {
      toolArgs = call.invoke ? await call.invoke() : call.arguments;
    }
  }

  if (!toolArgs) {
    if (toolError) throw new Error(toolError);
    return null;
  }

  return transferArgsSchema.parse(toolArgs);
}

async function parseWithSchemaFallback(
  sdk: typeof import('@qvac/sdk'),
  modelId: string,
  prompt: string,
): Promise<TransferIntent> {
  const run = sdk.completion({
    modelId,
    stream: true,
    responseFormat: {
      type: 'json_schema',
      json_schema: {
        name: 'transfer_intent',
        schema: {
          type: 'object',
          additionalProperties: false,
          properties: {
            isPayment: { type: 'boolean' },
            recipient: { type: 'string' },
            amount: { type: 'number' },
            token: { type: 'string' },
            memo: { type: 'string' },
          },
          required: ['isPayment', 'recipient', 'amount', 'token', 'memo'],
        },
      },
    },
    history: [
      {
        role: 'system',
        content:
          'Extract one Solana transfer intent from the user. Return JSON only. Set isPayment false when the request is not a payment. For payments, keep recipient exactly as written, amount as a number, token as uppercase SOL when omitted, and memo as the short payment reason or an empty string.',
      },
      { role: 'user', content: prompt },
    ],
    generationParams: {
      temp: 0,
      predict: 160,
    },
  });

  const final = await run.final;
  const parsed = schemaFallbackResult.parse(readJsonObject(final.contentText || final.raw.fullText));
  const hasTransferFields =
    parsed.recipient.trim().length > 0 &&
    parsed.amount > 0 &&
    parsed.token.trim().length > 0;
  if (!parsed.isPayment && !hasTransferFields) {
    throw new Error("I couldn't find a clear payment request.");
  }

  return transferArgsSchema.parse({
    amount: parsed.amount,
    memo: parsed.memo,
    recipient: parsed.recipient,
    token: parsed.token || DEFAULT_TOKEN,
  });
}

function readJsonObject(raw: string): unknown {
  const trimmed = raw.trim();
  if (trimmed.startsWith('{')) return JSON.parse(trimmed);

  const start = trimmed.indexOf('{');
  const end = trimmed.lastIndexOf('}');
  if (start >= 0 && end > start) {
    return JSON.parse(trimmed.slice(start, end + 1));
  }

  throw new Error("I couldn't parse a local payment intent.");
}

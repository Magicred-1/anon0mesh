export interface SolanaPayUriParams {
  recipient: string;
  amount?: string;
  label?: string;
  message?: string;
  memo?: string;
}

const AMOUNT_RE = /^\d+(\.\d{1,9})?$/;

function normalizeAmount(amount: string | undefined): string | null {
  const trimmed = amount?.trim();
  if (!trimmed || !AMOUNT_RE.test(trimmed)) return null;
  const numeric = Number(trimmed);
  if (!Number.isFinite(numeric) || numeric <= 0) return null;
  return trimmed.replace(/^0+(?=\d)/, "");
}

export function buildSolanaPayUri({
  recipient,
  amount,
  label = "anonmesh",
  message = "anonmesh receive",
  memo,
}: SolanaPayUriParams): string {
  const trimmedRecipient = recipient.trim();
  if (!trimmedRecipient) {
    throw new Error("Recipient is required");
  }

  const params = new URLSearchParams();
  const normalizedAmount = normalizeAmount(amount);
  if (normalizedAmount) params.set("amount", normalizedAmount);
  if (label.trim()) params.set("label", label.trim());
  if (message.trim()) params.set("message", message.trim());
  if (memo?.trim()) params.set("memo", memo.trim());

  const query = params.toString();
  return `solana:${trimmedRecipient}${query ? `?${query}` : ""}`;
}

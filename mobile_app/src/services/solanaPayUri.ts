export interface SolanaPayUriParams {
  recipient: string;
  amount?: string;
  label?: string;
  message?: string;
  memo?: string;
}

export interface ParsedSolanaPay {
  recipient: string;
  amount?: string;
  splToken?: string;
  label?: string;
  message?: string;
  memo?: string;
  reference?: string[];
}

const AMOUNT_RE = /^\d+(\.\d{1,9})?$/;
const BASE58_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

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
  label = "AnonMesh",
  message = "AnonMesh receive",
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

export function parseSolanaPayUri(input: string): ParsedSolanaPay | null {
  const s = input?.trim();
  if (!s) return null;

  if (BASE58_RE.test(s)) {
    return { recipient: s };
  }

  if (!s.toLowerCase().startsWith("solana:")) return null;

  const rest = s.slice("solana:".length);
  const qIdx = rest.indexOf("?");
  const recipient = (qIdx === -1 ? rest : rest.slice(0, qIdx)).trim();
  if (!BASE58_RE.test(recipient)) return null;

  const out: ParsedSolanaPay = { recipient };
  if (qIdx === -1) return out;

  const params = new URLSearchParams(rest.slice(qIdx + 1));

  const amount = normalizeAmount(params.get("amount") ?? undefined);
  if (amount) out.amount = amount;

  const splToken = params.get("spl-token");
  if (splToken && BASE58_RE.test(splToken)) out.splToken = splToken;

  const label = params.get("label");
  if (label) out.label = label;

  const message = params.get("message");
  if (message) out.message = message;

  const memo = params.get("memo");
  if (memo) out.memo = memo;

  const refs = params.getAll("reference").filter((r) => BASE58_RE.test(r));
  if (refs.length > 0) out.reference = refs;

  return out;
}

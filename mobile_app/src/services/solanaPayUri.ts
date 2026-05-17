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
  // Solana Pay spec mandates "." as decimal separator. Locales that surface
  // a comma decimal-pad (de-DE, fr-FR, pt-BR, es-ES, …) deliver "0,5" from
  // the receive amount field; without this swap the URI omits amount=
  // entirely and the QR receiver sees "no amount requested".
  // Also prefix a leading "0" when the user types ".5" — AMOUNT_RE requires
  // a digit before the dot, so without this the QR silently drops the amount.
  const trimmed = amount?.trim().replace(",", ".").replace(/^\./, "0.");
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

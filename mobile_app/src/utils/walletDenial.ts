import { summarizeError } from "./errors.ts";

const DENIAL_FRAGMENTS = [
  "authentication cancelled",
  "authorization request failed",
  "authorization cancelled",
  "auth request failed",
  "cancelled",
  "canceled",
  "declined",
  "denied",
  "rejected",
  "user refused",
];

export function isWalletDenial(err: unknown): boolean {
  const summary = summarizeError(err, "");
  const haystack = [summary.message, summary.name, summary.code, summary.raw]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return DENIAL_FRAGMENTS.some((fragment) => haystack.includes(fragment));
}

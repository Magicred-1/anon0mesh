import type { AddressBookEntry } from '../addressBook.ts';
import { normalizeAddressBookPubkey } from '../addressBookCore.ts';

export type RecipientResolution =
  | { readonly kind: 'unique'; readonly pubkey: string; readonly label: string }
  | { readonly kind: 'ambiguous'; readonly candidates: readonly AddressBookEntry[] }
  | { readonly kind: 'unknown'; readonly label: string };

function normLabel(value: string): string {
  return value.trim().toLowerCase();
}

export function resolveRecipientLabel(
  rawLabel: string,
  addressBook: readonly AddressBookEntry[],
): RecipientResolution {
  const label = rawLabel.trim();
  const asPubkey = normalizeAddressBookPubkey(label);
  if (asPubkey) return { kind: 'unique', pubkey: asPubkey, label: 'Wallet address' };

  const exact = addressBook.filter((entry) => normLabel(entry.label) === normLabel(label));
  if (exact.length === 1) {
    return { kind: 'unique', pubkey: exact[0].pubkey, label: exact[0].label };
  }
  if (exact.length > 1) return { kind: 'ambiguous', candidates: exact };

  const prefix = addressBook.filter((entry) => normLabel(entry.label).startsWith(normLabel(label)));
  if (prefix.length === 1) {
    return { kind: 'unique', pubkey: prefix[0].pubkey, label: prefix[0].label };
  }
  if (prefix.length > 1) return { kind: 'ambiguous', candidates: prefix.slice(0, 5) };

  return { kind: 'unknown', label };
}

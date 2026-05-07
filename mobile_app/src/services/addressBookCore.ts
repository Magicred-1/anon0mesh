import { PublicKey } from "@solana/web3.js";

export interface AddressBookEntry {
  label: string;
  pubkey: string;
  lastUsed: number;
  count: number;
}

export const MAX_ADDRESS_BOOK_RECIPIENTS = 50;

function shortAddress(addr: string): string {
  return `${addr.slice(0, 4)}...${addr.slice(-4)}`;
}

export function normalizeAddressBookPubkey(pubkey: string): string | null {
  try {
    return new PublicKey(pubkey.trim()).toBase58();
  } catch {
    return null;
  }
}

export function normalizeAddressBookEntry(entry: Partial<AddressBookEntry>): AddressBookEntry | null {
  if (typeof entry.pubkey !== "string") return null;
  const pubkey = normalizeAddressBookPubkey(entry.pubkey);
  if (!pubkey) return null;

  const count = Number.isFinite(entry.count) && Number(entry.count) > 0
    ? Math.floor(Number(entry.count))
    : 1;
  const lastUsed = Number.isFinite(entry.lastUsed) && Number(entry.lastUsed) > 0
    ? Number(entry.lastUsed)
    : Date.now();
  const label = typeof entry.label === "string" && entry.label.trim()
    ? entry.label.trim().slice(0, 48)
    : shortAddress(pubkey);

  return { label, pubkey, lastUsed, count };
}

export function sortAndCapAddressBookEntries(entries: AddressBookEntry[]): AddressBookEntry[] {
  return [...entries]
    .sort((a, b) => b.lastUsed - a.lastUsed)
    .slice(0, MAX_ADDRESS_BOOK_RECIPIENTS);
}

export function normalizeAddressBookEntries(items: unknown[]): AddressBookEntry[] {
  const deduped = new Map<string, AddressBookEntry>();
  for (const item of items) {
    const entry = normalizeAddressBookEntry(item as Partial<AddressBookEntry>);
    if (!entry) continue;
    const existing = deduped.get(entry.pubkey);
    if (!existing || entry.lastUsed > existing.lastUsed) {
      deduped.set(entry.pubkey, entry);
    }
  }
  return sortAndCapAddressBookEntries([...deduped.values()]);
}

export function upsertAddressBookEntry(
  entries: AddressBookEntry[],
  pubkey: string,
  label: string | undefined,
  now: number = Date.now(),
): AddressBookEntry[] {
  const normalized = normalizeAddressBookPubkey(pubkey);
  if (!normalized) return sortAndCapAddressBookEntries(entries);

  const existing = entries.find((entry) => entry.pubkey === normalized);
  const nextEntry: AddressBookEntry = {
    label: label?.trim() || existing?.label || shortAddress(normalized),
    pubkey: normalized,
    lastUsed: now,
    count: (existing?.count ?? 0) + 1,
  };

  return sortAndCapAddressBookEntries([
    nextEntry,
    ...entries.filter((entry) => entry.pubkey !== normalized),
  ]);
}

export function updateAddressBookEntryLabel(
  entries: AddressBookEntry[],
  pubkey: string,
  label: string,
): AddressBookEntry[] {
  const normalized = normalizeAddressBookPubkey(pubkey);
  if (!normalized) return sortAndCapAddressBookEntries(entries);

  const existing = entries.find((entry) => entry.pubkey === normalized);
  if (!existing) return sortAndCapAddressBookEntries(entries);

  const nextLabel = label.trim().slice(0, 48) || shortAddress(normalized);
  return sortAndCapAddressBookEntries(entries.map((entry) =>
    entry.pubkey === normalized ? { ...entry, label: nextLabel } : entry,
  ));
}

export function removeAddressBookEntry(entries: AddressBookEntry[], pubkey: string): AddressBookEntry[] {
  const normalized = normalizeAddressBookPubkey(pubkey);
  if (!normalized) return sortAndCapAddressBookEntries(entries);
  return sortAndCapAddressBookEntries(entries.filter((entry) => entry.pubkey !== normalized));
}

import { PublicKey } from "@solana/web3.js";
import { useCallback, useEffect, useState } from "react";

import { SecureKeys, secureGet, secureSet } from "@/src/storage";

export interface AddressBookEntry {
  label: string;
  pubkey: string;
  lastUsed: number;
  count: number;
}

const MAX_RECIPIENTS = 50;

function shortAddress(addr: string): string {
  return `${addr.slice(0, 4)}...${addr.slice(-4)}`;
}

function normalizePubkey(pubkey: string): string | null {
  try {
    return new PublicKey(pubkey.trim()).toBase58();
  } catch {
    return null;
  }
}

function normalizeEntry(entry: Partial<AddressBookEntry>): AddressBookEntry | null {
  if (typeof entry.pubkey !== "string") return null;
  const pubkey = normalizePubkey(entry.pubkey);
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

function sortAndCap(entries: AddressBookEntry[]): AddressBookEntry[] {
  return [...entries]
    .sort((a, b) => b.lastUsed - a.lastUsed)
    .slice(0, MAX_RECIPIENTS);
}

export async function readAddressBook(): Promise<AddressBookEntry[]> {
  const raw = await secureGet(SecureKeys.ADDRESS_BOOK);
  if (!raw) return [];

  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const deduped = new Map<string, AddressBookEntry>();
    for (const item of parsed) {
      const entry = normalizeEntry(item as Partial<AddressBookEntry>);
      if (!entry) continue;
      const existing = deduped.get(entry.pubkey);
      if (!existing || entry.lastUsed > existing.lastUsed) {
        deduped.set(entry.pubkey, entry);
      }
    }
    return sortAndCap([...deduped.values()]);
  } catch {
    return [];
  }
}

export async function writeAddressBook(entries: AddressBookEntry[]): Promise<void> {
  await secureSet(SecureKeys.ADDRESS_BOOK, JSON.stringify(sortAndCap(entries)));
}

export async function saveAddressBookRecipient(pubkey: string, label?: string): Promise<AddressBookEntry[]> {
  const normalized = normalizePubkey(pubkey);
  if (!normalized) return readAddressBook();

  const now = Date.now();
  const entries = await readAddressBook();
  const existing = entries.find((entry) => entry.pubkey === normalized);
  const nextEntry: AddressBookEntry = {
    label: label?.trim() || existing?.label || shortAddress(normalized),
    pubkey: normalized,
    lastUsed: now,
    count: (existing?.count ?? 0) + 1,
  };

  const next = [nextEntry, ...entries.filter((entry) => entry.pubkey !== normalized)];
  await writeAddressBook(next);
  return sortAndCap(next);
}

export function useAddressBook() {
  const [entries, setEntries] = useState<AddressBookEntry[]>([]);

  const refresh = useCallback(async () => {
    setEntries(await readAddressBook());
  }, []);

  const saveRecipient = useCallback(async (pubkey: string, label?: string) => {
    const next = await saveAddressBookRecipient(pubkey, label);
    setEntries(next);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { entries, refresh, saveRecipient };
}

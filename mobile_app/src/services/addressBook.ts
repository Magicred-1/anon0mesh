import { useCallback, useEffect, useState } from "react";

import {
  type AddressBookEntry,
  normalizeAddressBookEntries,
  removeAddressBookEntry,
  sortAndCapAddressBookEntries,
  updateAddressBookEntryLabel,
  upsertAddressBookEntry,
} from "@/src/services/addressBookCore";
import { SecureKeys, secureGet, secureSet } from "@/src/storage";

export type { AddressBookEntry } from "@/src/services/addressBookCore";

export async function readAddressBook(): Promise<AddressBookEntry[]> {
  const raw = await secureGet(SecureKeys.ADDRESS_BOOK);
  if (!raw) return [];

  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return normalizeAddressBookEntries(parsed);
  } catch {
    return [];
  }
}

export async function writeAddressBook(entries: AddressBookEntry[]): Promise<void> {
  await secureSet(SecureKeys.ADDRESS_BOOK, JSON.stringify(sortAndCapAddressBookEntries(entries)));
}

export async function saveAddressBookRecipient(pubkey: string, label?: string): Promise<AddressBookEntry[]> {
  const entries = await readAddressBook();
  const next = upsertAddressBookEntry(entries, pubkey, label);
  await writeAddressBook(next);
  return next;
}

export async function updateAddressBookRecipient(
  pubkey: string,
  label: string,
): Promise<AddressBookEntry[]> {
  const entries = await readAddressBook();
  const next = updateAddressBookEntryLabel(entries, pubkey, label);
  await writeAddressBook(next);
  return next;
}

export async function deleteAddressBookRecipient(pubkey: string): Promise<AddressBookEntry[]> {
  const next = removeAddressBookEntry(await readAddressBook(), pubkey);
  await writeAddressBook(next);
  return next;
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

  const updateRecipient = useCallback(async (pubkey: string, label: string) => {
    const next = await updateAddressBookRecipient(pubkey, label);
    setEntries(next);
  }, []);

  const deleteRecipient = useCallback(async (pubkey: string) => {
    const next = await deleteAddressBookRecipient(pubkey);
    setEntries(next);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { entries, refresh, saveRecipient, updateRecipient, deleteRecipient };
}

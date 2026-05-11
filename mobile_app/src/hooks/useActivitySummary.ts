import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';

import { isQvacEnabled, isQvacReady } from '@/src/services/qvac';
import { summarizeActivity, type SummaryInput } from '@/src/services/qvac/summarize';

const CACHE_NS = 'qvac:summary:v1:';

type CacheEntry = { readonly ok: boolean; readonly text: string };

let queue: Promise<void> = Promise.resolve();

async function readCache(signature: string): Promise<CacheEntry | null> {
  try {
    const raw = await AsyncStorage.getItem(CACHE_NS + signature);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CacheEntry;
    if (typeof parsed?.ok !== 'boolean' || typeof parsed?.text !== 'string') return null;
    return parsed;
  } catch {
    return null;
  }
}

async function writeCache(signature: string, entry: CacheEntry): Promise<void> {
  try {
    await AsyncStorage.setItem(CACHE_NS + signature, JSON.stringify(entry));
  } catch {}
}

export function useActivitySummary(input: SummaryInput | null): string | null {
  const [summary, setSummary] = useState<string | null>(null);

  useEffect(() => {
    if (!input || !isQvacEnabled()) {
      setSummary(null);
      return;
    }

    let cancelled = false;

    (async () => {
      const cached = await readCache(input.signature);
      if (cancelled) return;
      if (cached?.ok) {
        setSummary(cached.text);
        return;
      }
      if (cached && !cached.ok) return;
      if (!isQvacReady()) return;

      queue = queue.then(async () => {
        if (cancelled) return;
        try {
          const text = await summarizeActivity(input);
          if (cancelled) return;
          await writeCache(input.signature, { ok: true, text });
          setSummary(text);
        } catch {
          await writeCache(input.signature, { ok: false, text: '' });
        }
      });
    })();

    return () => {
      cancelled = true;
    };
    // Re-run only when the tx signature changes. The full `input` object is
    // rebuilt on every parent render; depending on it would refetch on every
    // list refresh and thrash the queue.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [input?.signature]);

  return summary;
}

import { useCallback, useEffect, useRef, useState } from 'react';
import { Buffer } from 'buffer';

import { useLxmfContext, type StoredMessage } from '@/context/LxmfContext';
import { sliceNewEvents } from '@/src/utils/sliceNewEvents';
import type { LxmfEvent } from '@magicred-1/react-native-lxmf';

export interface ConvSummary {
  lastText:      string;
  lastTimestamp: number;
  unreadCount:   number;
}

function decodePreview(body: string): string {
  if (!body) return '';
  try {
    const text = Buffer.from(body, 'base64').toString('utf-8');
    try {
      const j = JSON.parse(text) as unknown;
      if (j && typeof j === 'object') {
        const t = (j as Record<string, unknown>).body ?? (j as Record<string, unknown>).text;
        if (typeof t === 'string' && t) return t.slice(0, 60);
      }
    } catch {}
    return text.slice(0, 60);
  } catch {
    return '';
  }
}

function buildSummaries(
  messages: StoredMessage[],
  lastReadAt: Map<string, number>,
): Map<string, ConvSummary> {
  // Sort ascending so the newest message overwrites earlier ones
  const sorted = [...messages].sort((a, b) => a.timestamp - b.timestamp);
  const map = new Map<string, ConvSummary>();

  for (const m of sorted) {
    const partner = m.outbound ? m.dest : m.source;
    if (!partner || partner.length !== 32) continue;

    const readAt   = lastReadAt.get(partner) ?? 0;
    const isUnread = !m.outbound && m.timestamp > readAt;
    const existing = map.get(partner);

    map.set(partner, {
      lastText:      decodePreview(m.body ?? ''),
      lastTimestamp: m.timestamp,
      unreadCount:   (existing?.unreadCount ?? 0) + (isUnread ? 1 : 0),
    });
  }
  return map;
}

export function useConversationSummaries(): {
  summaries:       Map<string, ConvSummary>;
  markRead:        (destHash: string) => void;
  hasConversation: (destHash: string) => boolean;
} {
  const { fetchMessages, events } = useLxmfContext();
  const lastReadAt      = useRef<Map<string, number>>(new Map());
  const lastEvtCountRef = useRef(0);
  const lastFirstEvtRef = useRef<LxmfEvent | null>(null);

  const [summaries, setSummaries] = useState<Map<string, ConvSummary>>(new Map());

  const derive = useCallback(() => {
    const msgs = fetchMessages(500) as StoredMessage[];
    setSummaries(buildSummaries(msgs, lastReadAt.current));
  }, [fetchMessages]);

  // Initial derive on mount
  useEffect(() => { derive(); }, [derive]);

  // Re-derive only when new messageReceived events arrive
  useEffect(() => {
    const newEvts = sliceNewEvents(events, lastEvtCountRef, lastFirstEvtRef);
    if (newEvts.some(e => e.type === 'messageReceived')) {
      derive();
    }
  }, [events, derive]);

  const markRead = useCallback((destHash: string) => {
    lastReadAt.current.set(destHash, Math.floor(Date.now() / 1000));
    derive();
  }, [derive]);

  const hasConversation = useCallback(
    (destHash: string) => summaries.has(destHash),
    [summaries],
  );

  return { summaries, markRead, hasConversation };
}

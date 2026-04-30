import { useCallback, useEffect, useRef } from 'react';
import { AppState, Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import type { LxmfEvent } from '@magicred-1/react-native-lxmf';
import { useLxmfContext } from '@/context/LxmfContext';
import type { NotificationPayload } from '@/components/ui/InAppNotificationBanner';
import { activeConversationRef } from './activeConversation';
import { messagesFocusedRef }    from './messagesFocused';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList:   true,
    shouldPlaySound:  true,
    shouldSetBadge:   true,
  }),
});

if (Platform.OS === 'android') {
  Notifications.setNotificationChannelAsync('messages', {
    name: 'Messages',
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 200],
    lightColor: '#00E5FF',
  }).catch(() => {});
  Notifications.setNotificationChannelAsync('peer-status', {
    name: 'Peer Status',
    importance: Notifications.AndroidImportance.LOW,
    sound: null,
  }).catch(() => {});
}

// Events are prepended newest-first and capped at 200 — use reference comparison when capped.
function sliceNewEvents(
  events: LxmfEvent[], prevCount: number, prevFirst: LxmfEvent | null,
): LxmfEvent[] {
  if (events.length > prevCount) return events.slice(0, events.length - prevCount);
  const first = events[0] ?? null;
  if (prevFirst !== null && first !== prevFirst) {
    const oldIdx = events.indexOf(prevFirst);
    return oldIdx > 0 ? events.slice(0, oldIdx) : [];
  }
  return [];
}

export function useMessageNotifications(
  onInApp: (n: NotificationPayload) => void,
  enabled = true,
) {
  const { events, peers, nameMap } = useLxmfContext();
  const lastCountRef = useRef(0);
  const lastFirstRef = useRef<LxmfEvent | null>(null);
  const appStateRef  = useRef(AppState.currentState);

  // Request local notification permission once — no remote/push token requested
  useEffect(() => {
    Notifications.requestPermissionsAsync({
      ios: { allowAlert: true, allowBadge: true, allowSound: true },
    }).catch(() => {});
  }, []);

  // Track foreground vs background
  useEffect(() => {
    const sub = AppState.addEventListener('change', s => { appStateRef.current = s; });
    return () => sub.remove();
  }, []);

  const resolveDisplay = useCallback((srcHash: string): string => {
    const fromPeers = peers.find(p => p.destHash === srcHash)?.displayName;
    return fromPeers || nameMap[srcHash] || srcHash.slice(0, 8);
  }, [peers, nameMap]);

  useEffect(() => {
    const prevCount = lastCountRef.current;
    const prevFirst = lastFirstRef.current;
    lastCountRef.current = events.length;
    lastFirstRef.current = events[0] ?? null;

    const newEvents = sliceNewEvents(events, prevCount, prevFirst);
    if (newEvents.length === 0 || !enabled) return;

    for (const e of newEvents) {
      if (e.type !== 'messageReceived') continue;

      const srcHash: string = typeof e.source === 'string' ? e.source : '';
      const sender = resolveDisplay(srcHash);
      const payload: NotificationPayload = { id: Date.now(), sender, body: 'new message', destHash: srcHash };

      // Suppress only if messages screen is focused AND this is the open conversation
      const inActiveThread = appStateRef.current === 'active'
        && messagesFocusedRef.current
        && srcHash === activeConversationRef.current;
      if (inActiveThread) continue;

      if (appStateRef.current === 'active') {
        onInApp(payload);
      } else {
        Notifications.scheduleNotificationAsync({
          content: { title: sender, body: 'new message', sound: true },
          trigger: null,
        }).catch(() => {});
      }
    }
  }, [events, enabled, resolveDisplay, onInApp]);
}

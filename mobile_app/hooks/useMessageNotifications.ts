import { useEffect, useRef } from 'react';
import { AppState, Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import type { LxmfEvent } from '@magicred-1/react-native-lxmf';
import { useLxmfContext } from '@/context/LxmfContext';
import { sliceNewEvents } from '@/src/utils/sliceNewEvents';
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


export function useMessageNotifications(
  onInApp: (n: NotificationPayload) => void,
  enabled = true,
) {
  const { events, getDisplayName } = useLxmfContext();
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

  useEffect(() => {
    const prevCount = lastCountRef.current;
    const prevFirst = lastFirstRef.current;
    lastCountRef.current = events.length;
    lastFirstRef.current = events[0] ?? null;

    const newEvents = sliceNewEvents(events, prevCount, prevFirst);
    if (newEvents.length === 0 || !enabled) return;

    const toNotify = newEvents.filter(e => e.type === 'messageReceived');
    if (toNotify.length === 0) return;

    // Defer past React's current effect flush so parent LxmfProvider's peer-tracking
    // effect (which updates knownPeersRef) has run before we resolve display names.
    const timer = setTimeout(() => {
      for (const e of toNotify) {
        const srcHash: string = typeof e.source === 'string' ? e.source : '';
        const sender = getDisplayName(srcHash);
        const payload: NotificationPayload = { id: Date.now(), sender, body: 'new message', destHash: srcHash };

        const inActiveThread = appStateRef.current === 'active'
          && messagesFocusedRef.current
          && srcHash === activeConversationRef.current;
        if (inActiveThread) continue;

        if (appStateRef.current === 'active') {
          onInApp(payload);
        } else {
          // Per-peer identifier replaces any prior unread notification from the
          // same sender instead of stacking. Matches usePeerCountNotification's
          // single-id pattern. On iOS this maps to UNNotificationRequest reuse;
          // on Android the channel already groups under 'messages'.
          Notifications.scheduleNotificationAsync({
            identifier: `anonmesh-msg-${srcHash}`,
            content: { title: sender, body: 'new message', sound: true },
            trigger: null,
          }).catch(() => {});
        }
      }
    }, 0);

    return () => clearTimeout(timer);
  }, [events, enabled, getDisplayName, onInApp]);
}

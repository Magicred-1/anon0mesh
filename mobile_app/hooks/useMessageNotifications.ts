import { useCallback, useEffect, useRef } from 'react';
import { AppState, Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { useLxmfContext } from '@/context/LxmfContext';
import type { NotificationPayload } from '@/components/ui/InAppNotificationBanner';
import { activeConversationRef } from './activeConversation';

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
  const { events, peers, nameMap } = useLxmfContext();
  const lastCountRef = useRef(0);
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
    if (events.length <= lastCountRef.current) return;
    const newEvents = events.slice(lastCountRef.current);
    lastCountRef.current = events.length;

    if (!enabled) return;

    for (const e of newEvents) {
      if (e.type !== 'messageReceived') continue;

      const srcHash: string = e.source ?? '';
      const sender  = resolveDisplay(srcHash);
      const payload: NotificationPayload = { id: Date.now(), sender, body: 'new message' };

      // Suppress banner if user is already in this conversation
      const inActiveThread = appStateRef.current === 'active' && srcHash === activeConversationRef.current;
      if (inActiveThread) continue;

      if (appStateRef.current === 'active') {
        onInApp(payload);
      } else {
        // Local notification — fires immediately, no server involved
        Notifications.scheduleNotificationAsync({
          content: { title: sender, body: 'new message', sound: true },
          trigger: null,
        }).catch(() => {});
      }
    }
  }, [events, resolveDisplay, onInApp]);
}

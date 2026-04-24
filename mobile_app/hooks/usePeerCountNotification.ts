import { useEffect, useRef } from 'react';
import * as Notifications from 'expo-notifications';
import { useLxmfContext } from '@/context/LxmfContext';

const NOTIF_ID = 'anonmesh-peer-count';

export function usePeerCountNotification(enabled = true) {
  const { peers } = useLxmfContext();
  const prevOnlineRef = useRef(-1);
  const prevTotalRef  = useRef(-1);

  useEffect(() => {
    if (!enabled) {
      Notifications.dismissNotificationAsync(NOTIF_ID).catch(() => {});
      prevOnlineRef.current = -1;
      prevTotalRef.current  = -1;
      return;
    }

    const online = peers.filter(p => p.online).length;
    const total  = peers.length;

    if (online === prevOnlineRef.current && total === prevTotalRef.current) return;
    prevOnlineRef.current = online;
    prevTotalRef.current  = total;

    if (total === 0) {
      Notifications.dismissNotificationAsync(NOTIF_ID).catch(() => {});
      return;
    }

    Notifications.scheduleNotificationAsync({
      identifier: NOTIF_ID,
      content: {
        title:  'anonmesh',
        body:   `${online} reachable · ${total} known`,
        sound:  false,
        sticky: true,
      },
      trigger: null,
    }).catch(() => {});
  }, [enabled, peers]);
}

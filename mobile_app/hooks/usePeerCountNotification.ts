import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { useLxmfContext } from '@/context/LxmfContext';
import { useWallet } from '@/context/WalletContext';

const NOTIF_ID = 'anonmesh-peer-count';

export function usePeerCountNotification(enabled = true) {
  const { peers } = useLxmfContext();
  const { isConnected } = useWallet();
  const prevOnlineRef    = useRef(-1);
  const prevTotalRef     = useRef(-1);
  const prevHadPeersRef  = useRef<boolean | null>(null);

  useEffect(() => {
    // Gate on isConnected (identity created) as well as `enabled`: scheduling a
    // notification triggers the iOS permission prompt, and the mesh autostarts
    // and finds peers ~1.5s in — without this gate that prompt fires
    // mid-onboarding, defeating the deferred-permission choreography (SU-D).
    if (!enabled || !isConnected) {
      Notifications.dismissNotificationAsync(NOTIF_ID).catch(() => {});
      prevOnlineRef.current   = -1;
      prevTotalRef.current    = -1;
      prevHadPeersRef.current = null;
      return;
    }

    const online   = peers.filter(p => p.online).length;
    const total    = peers.length;
    const hasPeers = total > 0;

    // iOS: schedule only on 0↔peers transition. Notification Center has no
    // silent persistent surface — every reschedule resurfaces the entry. One
    // quiet "mesh active" pill is enough; the in-app peer indicator already
    // shows live counts.
    if (Platform.OS === 'ios') {
      if (prevHadPeersRef.current === hasPeers) return;
      prevHadPeersRef.current = hasPeers;

      if (!hasPeers) {
        Notifications.dismissNotificationAsync(NOTIF_ID).catch(() => {});
        return;
      }

      Notifications.scheduleNotificationAsync({
        identifier: NOTIF_ID,
        content: {
          title:  'anonmesh',
          body:   'Mesh active',
          sound:  false,
          sticky: true,
          interruptionLevel: 'passive',
        },
        trigger: null,
      }).catch(() => {});
      return;
    }

    // Android: live counts on the LOW-importance 'peer-status' channel — the
    // channel handles silence, so updates can flow without annoying the user.
    if (online === prevOnlineRef.current && total === prevTotalRef.current) return;
    prevOnlineRef.current = online;
    prevTotalRef.current  = total;

    if (!hasPeers) {
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
  }, [enabled, isConnected, peers]);
}

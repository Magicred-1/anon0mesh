import { useState, useEffect } from 'react';
import { PrefKeys, prefGet, prefSet } from '@/src/storage';

export function useNotificationEnabled(): [boolean, (v: boolean) => void] {
  const [enabled, setEnabled] = useState(true);

  useEffect(() => {
    prefGet(PrefKeys.NOTIF_ENABLED).then(v => {
      if (v !== null) setEnabled(v === 'true');
    });
  }, []);

  const set = (v: boolean) => {
    setEnabled(v);
    prefSet(PrefKeys.NOTIF_ENABLED, String(v));
  };

  return [enabled, set];
}

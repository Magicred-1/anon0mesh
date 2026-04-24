import { useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'anonmesh:notif-enabled';

export function useNotificationEnabled(): [boolean, (v: boolean) => void] {
  const [enabled, setEnabled] = useState(true);

  useEffect(() => {
    AsyncStorage.getItem(KEY).then(v => {
      if (v !== null) setEnabled(v === 'true');
    });
  }, []);

  const set = (v: boolean) => {
    setEnabled(v);
    AsyncStorage.setItem(KEY, String(v)).catch(() => {});
  };

  return [enabled, set];
}

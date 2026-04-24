import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';

const KEY = 'anonmesh:biometric-enabled';

export function useBiometricEnabled(): [boolean, (v: boolean) => void] {
  const [enabled, setEnabled] = useState(true);

  useEffect(() => {
    AsyncStorage.getItem(KEY).then(v => { if (v !== null) setEnabled(v === 'true'); });
  }, []);

  const set = (v: boolean) => {
    setEnabled(v);
    AsyncStorage.setItem(KEY, String(v)).catch(() => {});
  };

  return [enabled, set];
}

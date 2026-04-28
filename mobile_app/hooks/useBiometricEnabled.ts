import { useEffect, useState } from 'react';
import { PrefKeys, prefGet, prefSet } from '@/src/storage';

export function useBiometricEnabled(): [boolean, (v: boolean) => void] {
  const [enabled, setEnabled] = useState(true);

  useEffect(() => {
    prefGet(PrefKeys.BIOMETRIC_ENABLED).then(v => { if (v !== null) setEnabled(v === 'true'); });
  }, []);

  const set = (v: boolean) => {
    setEnabled(v);
    prefSet(PrefKeys.BIOMETRIC_ENABLED, String(v));
  };

  return [enabled, set];
}

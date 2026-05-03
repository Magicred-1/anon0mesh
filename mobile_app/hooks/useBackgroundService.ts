import { useEffect } from 'react';
import { NativeModules, Platform } from 'react-native';

const Svc = (NativeModules as { LxmfServiceModule?: { start: () => void; stop: () => void } }).LxmfServiceModule;

// Starts the Android foreground service on mount so the process is never
// OOM-killed while the LXMF node is active. No-op on iOS (BLE background
// modes in Info.plist keep BLE hardware alive without a service).
export function useBackgroundService() {
  useEffect(() => {
    if (Platform.OS !== 'android' || !Svc) return;
    Svc.start();
    return () => { Svc!.stop(); };
  }, []);
}

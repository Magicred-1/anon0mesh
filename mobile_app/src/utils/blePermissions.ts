// Android BLE permission handling for mesh scan + connect + advertise.
// iOS handles BLE permissions via info.plist at install time — nothing to request at runtime.
import { PermissionsAndroid, Platform } from "react-native";

// BLUETOOTH_ADVERTISE is critical for anonmesh since peers both scan and advertise.
// Android 12+ (API 31+): new nearby-devices runtime permissions.
// Android < 12: ACCESS_FINE_LOCATION is required for scan results to include peers.
export type BLEPermissionStatus =
  | "granted"
  | "denied"
  | "never_ask_again"
  | "not_required"; // iOS and anything non-Android

async function getAndroidPermissions(): Promise<string[]> {
  const apiLevel = Platform.OS === "android" ? Platform.Version : 0;
  // Platform.Version on Android returns the API level as a number.
  if (typeof apiLevel === "number" && apiLevel >= 31) {
    return [
      PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
      PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
      PermissionsAndroid.PERMISSIONS.BLUETOOTH_ADVERTISE,
      PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
    ];
  }
  return [PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION];
}

export async function checkBLEPermissions(): Promise<BLEPermissionStatus> {
  if (Platform.OS !== "android") return "not_required";
  const permissions = await getAndroidPermissions();
  for (const permission of permissions) {
    const granted = await PermissionsAndroid.check(permission as Parameters<typeof PermissionsAndroid.check>[0]);
    if (!granted) return "denied";
  }
  return "granted";
}

export async function requestBLEPermissions(): Promise<BLEPermissionStatus> {
  if (Platform.OS !== "android") return "not_required";

  const permissions = await getAndroidPermissions();
  const results = await PermissionsAndroid.requestMultiple(
    permissions as Parameters<typeof PermissionsAndroid.requestMultiple>[0],
  );

  let anyNeverAsk = false;
  for (const permission of permissions) {
    const result = results[permission as keyof typeof results];
    if (result === PermissionsAndroid.RESULTS.GRANTED) continue;
    if (result === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN) {
      anyNeverAsk = true;
    }
    return anyNeverAsk ? "never_ask_again" : "denied";
  }

  return "granted";
}

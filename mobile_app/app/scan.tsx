import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, View, Text, Pressable, StyleSheet, Platform } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { fontFamily, useTheme } from '@/theme';
import { parseScannedAddress, resolveScan, type ScannedAddress } from '@/src/services/qrScan';

// Full-screen QR scanner route. Presented via `scan()` (src/services/qrScan).
// Being a navigator route — not a nested <Modal> — is what makes this safe to
// open from anywhere, including from inside a bottom-sheet modal, without the
// stacked-window camera/touch bug that a nested <Modal> causes on iOS.
export default function ScanScreen() {
  const { colors } = useTheme();
  const [permission, requestPermission, getPermission] = useCameraPermissions();
  const scannedRef = useRef(false);
  const settledRef = useRef(false);
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [label, setLabel] = useState<string | null>(null);

  // Resolve the pending scan() promise exactly once, then leave the route.
  const finish = useCallback((result: ScannedAddress | null) => {
    if (settledRef.current) return;
    settledRef.current = true;
    resolveScan(result);
    if (router.canGoBack()) router.back();
  }, []);

  // Safety net: if the route unmounts without an explicit outcome (swipe- or
  // hardware-back), still resolve null so the caller's promise never hangs.
  useEffect(() => () => {
    if (flashTimer.current) clearTimeout(flashTimer.current);
    if (!settledRef.current) { settledRef.current = true; resolveScan(null); }
  }, []);

  useEffect(() => {
    if (permission && !permission.granted && permission.canAskAgain) requestPermission();
  }, [permission, requestPermission]);

  // Re-read permission when returning to foreground (deny → Settings → grant
  // → back). getPermission reads OS state silently — no prompt.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => {
      if (next === 'active') getPermission();
    });
    return () => sub.remove();
  }, [getPermission]);

  const onBarcodeScanned = useCallback(({ data }: { data: string }) => {
    if (scannedRef.current) return;
    scannedRef.current = true;

    const result = parseScannedAddress(data);
    const hint =
      result.type === 'lxmf'       ? `LXMF · ${result.hash.slice(0, 8)}…` :
      result.type === 'lxmf-group' ? `channel · ${result.name ?? result.addrHex.slice(0, 8)}…` :
      result.type === 'solana'     ? `Solana · ${result.address.slice(0, 8)}…` :
      'unknown format';
    setLabel(hint);

    // Brief flash of the recognized label, then hand the result back.
    flashTimer.current = setTimeout(() => finish(result), 350);
  }, [finish]);

  const denied  = permission && !permission.granted && !permission.canAskAgain;
  const granted = permission?.granted === true;

  return (
    <View style={S.root}>
      {denied ? (
        <View style={S.center}>
          <Feather name="camera-off" size={40} color={colors.textTertiary} />
          <Text style={[S.deniedText, { color: colors.textSecondary }]}>
            Camera permission denied.{'\n'}Enable it in Settings.
          </Text>
        </View>
      ) : granted ? (
        <CameraView
          style={StyleSheet.absoluteFill}
          facing="back"
          barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
          onBarcodeScanned={onBarcodeScanned}
        />
      ) : (
        <View style={S.center}>
          <Feather name="camera" size={40} color={colors.textTertiary} />
          <Text style={[S.deniedText, { color: colors.textSecondary }]}>
            Requesting camera access…
          </Text>
        </View>
      )}

      {/* Viewfinder */}
      <View style={S.overlay} pointerEvents="none">
        <View style={S.corner} />
        <View style={[S.corner, S.cornerTR]} />
        <View style={[S.corner, S.cornerBL]} />
        <View style={[S.corner, S.cornerBR]} />
      </View>

      {label && (
        <View style={S.labelWrap}>
          <Text style={S.labelText}>{label}</Text>
        </View>
      )}

      <View style={S.hint}>
        <Text style={S.hintText}>POINT AT A QR CODE</Text>
      </View>

      <Pressable style={S.close} onPress={() => { if (!scannedRef.current) finish(null); }} hitSlop={12}>
        <Feather name="x" size={22} color="#fff" />
      </Pressable>
    </View>
  );
}

const CORNER = 28;
const BORDER = 3;

const S = StyleSheet.create({
  root:      { flex: 1, backgroundColor: '#000' },
  center:    { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, paddingHorizontal: 32 },
  deniedText:{ fontFamily: fontFamily.sansMd, fontSize: 13, textAlign: 'center', lineHeight: 20 },

  overlay:   {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center', justifyContent: 'center',
  },
  corner:    {
    position: 'absolute', width: CORNER, height: CORNER,
    borderColor: '#fff',
    top:  '35%', left: '20%',
    borderTopWidth: BORDER, borderLeftWidth: BORDER, borderRadius: 4,
  },
  cornerTR:  { left: undefined, right: '20%', borderLeftWidth: 0, borderRightWidth: BORDER },
  cornerBL:  { top: undefined, bottom: '35%', borderTopWidth: 0, borderBottomWidth: BORDER },
  cornerBR:  { top: undefined, bottom: '35%', left: undefined, right: '20%', borderTopWidth: 0, borderLeftWidth: 0, borderBottomWidth: BORDER, borderRightWidth: BORDER },

  labelWrap: {
    position: 'absolute', bottom: '38%', left: 0, right: 0,
    alignItems: 'center',
  },
  labelText: {
    fontFamily: fontFamily.sansMd, fontSize: 12, letterSpacing: 1.5,
    color: '#fff', backgroundColor: 'rgba(0,0,0,0.55)',
    paddingHorizontal: 14, paddingVertical: 6, borderRadius: 8,
  },
  hint:      {
    position: 'absolute', bottom: 100, left: 0, right: 0, alignItems: 'center',
  },
  hintText:  { fontFamily: fontFamily.sansMd, fontSize: 9.5, letterSpacing: 2.5, color: 'rgba(255,255,255,0.55)' },
  close:     {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 60 : 40,
    right: 20,
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center', justifyContent: 'center',
  },
});

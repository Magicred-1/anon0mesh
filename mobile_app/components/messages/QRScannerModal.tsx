import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Modal, View, Text, Pressable, StyleSheet, Platform } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Feather } from '@expo/vector-icons';
import { fontFamily, useTheme } from '@/theme';
import { parseSolanaPayUri } from '@/src/services/solanaPayUri';

export type ScannedAddress =
  | { type: 'lxmf';       hash:    string }
  | { type: 'lxmf-group'; addrHex: string; keyHex: string; name?: string }
  | {
      type:      'solana';
      address:   string;
      amount?:   string;
      splToken?: string;
      label?:    string;
      message?:  string;
      memo?:     string;
      reference?: string[];
    }
  | { type: 'unknown';    raw:     string };

// 32-byte LXMF/Reticulum address = 64 hex chars (raw) or 32 (short hash shown in UI)
const LXMF_RE   = /^[0-9a-f]{32}([0-9a-f]{32})?$/i;
const HEX32_RE  = /^[0-9a-fA-F]{32}$/;

function parse(raw: string): ScannedAddress {
  const s = raw.trim();

  // lxmf://group/<addrHex>/<keyHex>?name=<name>
  if (s.startsWith('lxmf://group/')) {
    const rest     = s.slice('lxmf://group/'.length);
    const [body, query] = rest.split('?') as [string, string | undefined];
    const parts    = body.split('/');
    const addrHex  = parts[0] ?? '';
    const keyHex   = parts[1] ?? '';
    if (HEX32_RE.test(addrHex) && HEX32_RE.test(keyHex)) {
      const nameParam = query?.split('&').find(p => p.startsWith('name='))?.slice(5);
      const name = nameParam ? decodeURIComponent(nameParam) : undefined;
      return { type: 'lxmf-group', addrHex: addrHex.toLowerCase(), keyHex: keyHex.toLowerCase(), name };
    }
  }

  if (s.startsWith('lxmf://') || s.startsWith('reticulum://')) {
    const hash = s.split('://')[1]?.split('?')[0] ?? '';
    if (LXMF_RE.test(hash)) return { type: 'lxmf', hash };
  }

  if (LXMF_RE.test(s)) return { type: 'lxmf', hash: s.toLowerCase() };

  // Solana Pay URI or bare base58 — single source of truth in solanaPayUri.ts.
  const pay = parseSolanaPayUri(s);
  if (pay) {
    return {
      type:      'solana',
      address:   pay.recipient,
      amount:    pay.amount,
      splToken:  pay.splToken,
      label:     pay.label,
      message:   pay.message,
      memo:      pay.memo,
      reference: pay.reference,
    };
  }

  return { type: 'unknown', raw: s };
}

interface Props {
  readonly visible:  boolean;
  readonly onResult: (result: ScannedAddress) => void;
  readonly onClose:  () => void;
}

export function QRScannerModal({ visible, onResult, onClose }: Props) {
  const { colors } = useTheme();
  const [permission, requestPermission] = useCameraPermissions();
  const scannedRef = useRef(false);
  const [label, setLabel] = useState<string | null>(null);

  useEffect(() => {
    if (visible) { scannedRef.current = false; setLabel(null); }
  }, [visible]);

  useEffect(() => {
    if (visible && permission && !permission.granted && permission.canAskAgain) {
      requestPermission();
    }
  }, [visible, permission, requestPermission]);

  const onBarcodeScanned = useCallback(({ data }: { data: string }) => {
    if (scannedRef.current) return;
    scannedRef.current = true;

    const result = parse(data);
    const hint =
      result.type === 'lxmf'       ? `LXMF · ${result.hash.slice(0, 8)}…` :
      result.type === 'lxmf-group' ? `channel · ${result.name ?? result.addrHex.slice(0, 8)}…` :
      result.type === 'solana'     ? `Solana · ${result.address.slice(0, 8)}…` :
      'unknown format';
    setLabel(hint);

    setTimeout(() => { onResult(result); }, 350);
  }, [onResult]);

  if (!visible) return null;

  const denied = permission && !permission.granted && !permission.canAskAgain;

  return (
    <Modal visible transparent={false} animationType="slide" onRequestClose={onClose}>
      <View style={S.root}>
        {denied ? (
          <View style={S.center}>
            <Feather name="camera-off" size={40} color={colors.textTertiary} />
            <Text style={[S.deniedText, { color: colors.textSecondary }]}>
              Camera permission denied.{'\n'}Enable it in Settings.
            </Text>
          </View>
        ) : (
          <CameraView
            style={StyleSheet.absoluteFill}
            facing="back"
            barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
            onBarcodeScanned={onBarcodeScanned}
          />
        )}

        {/* Viewfinder */}
        <View style={S.overlay} pointerEvents="none">
          <View style={S.corner} />
          <View style={[S.corner, S.cornerTR]} />
          <View style={[S.corner, S.cornerBL]} />
          <View style={[S.corner, S.cornerBR]} />
        </View>

        {/* Label */}
        {label && (
          <View style={S.labelWrap}>
            <Text style={S.labelText}>{label}</Text>
          </View>
        )}

        {/* Instructions */}
        <View style={S.hint}>
          <Text style={S.hintText}>POINT AT A QR CODE</Text>
        </View>

        {/* Close */}
        <Pressable style={S.close} onPress={onClose} hitSlop={12}>
          <Feather name="x" size={22} color="#fff" />
        </Pressable>
      </View>
    </Modal>
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

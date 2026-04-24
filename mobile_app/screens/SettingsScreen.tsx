import React, { useState, useCallback } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { fontFamily, useTheme } from '@/theme';
import { useGlass } from '@/hooks/useGlass';
import { Pill } from '@/components/ui/Pill';
import { useWallet } from '@/context/WalletContext';
import { useLxmfContext } from '@/context/LxmfContext';
import { useRouter } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import { useNotificationEnabled } from '@/hooks/useNotificationEnabled';
import { useBiometricEnabled } from '@/hooks/useBiometricEnabled';
import {
  QRCode, Toggle, SectionLabel, SettingsRow,
  QRModal, ExportWalletModal, RNodePairModal, RotateKeypairModal, DisableBiometricModal,
  type PairedDevice,
} from '@/components/settings';

export default function SettingsScreen() {
  const { colors } = useTheme();
  const baseGlass   = useGlass();
  const accentGlass = useGlass('accent');
  const softGlass   = useGlass('soft');

  const [pairOpen,      setPairOpen]      = useState(false);
  const [rotateOpen,    setRotateOpen]    = useState(false);
  const [exportOpen,    setExportOpen]    = useState(false);
  const [qrOpen,        setQrOpen]        = useState(false);
  const [copied,        setCopied]        = useState(false);
  const [paired,        setPaired]        = useState<PairedDevice>({ id: 'rnode_001', name: 'RNode · 410MHz', rssi: -42, serial: 'RN-914-4f2a' });
  const [notifications,  setNotifications]  = useNotificationEnabled();
  const [biometric,      setBiometric]      = useBiometricEnabled();
  const [disableBioOpen, setDisableBioOpen] = useState(false);
  const [meshOnCell,     setMeshOnCell]     = useState(false);

  const router = useRouter();
  const { disconnect, isLoading: walletLoading } = useWallet();
  const { status, displayName } = useLxmfContext();

  const meshAddress = status?.addressHex ?? '';
  const meshHandle  = meshAddress ? `@${meshAddress.slice(0, 8)}` : '@——';
  const shortHash   = meshAddress ? `${meshAddress.slice(0, 6)}..${meshAddress.slice(-6)}` : '——';

  const handleSignOut = useCallback(async () => {
    await disconnect();
    router.replace('/onboarding');
  }, [disconnect, router]);

  const copyHandle = useCallback(async () => {
    if (meshAddress) await Clipboard.setStringAsync(meshAddress);
    setCopied(true);
    setTimeout(() => setCopied(false), 1400);
  }, [meshAddress]);

  const onPaired = useCallback((d: NonNullable<PairedDevice>) => setPaired(d), []);

  return (
    <View style={[S.root, { backgroundColor: colors.background }]}>
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>

          {/* ── Identity card ── */}
          <View style={{ padding: 16, paddingBottom: 8 }}>
            <View style={[S.identityCard, baseGlass]}>
              <Text style={[S.idLabel, { color: colors.textTertiary, alignSelf: 'center' }]}>YOUR IDENTITY</Text>
              <Pressable onPress={() => setQrOpen(true)} style={[S.qrWrap, { backgroundColor: colors.surface2, borderColor: colors.border, alignSelf: 'center' }]}>
                <QRCode size={120} data={meshAddress || 'no-identity'} />
              </Pressable>
              <View style={{ alignItems: 'center', gap: 3 }}>
                <Text style={[S.idHandle,      { color: colors.textPrimary }]}>@{displayName}</Text>
                <Text style={[S.idHash,        { color: colors.textSecondary }]}>{shortHash}</Text>
              </View>
              <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 6 }}>
                <Pressable onPress={copyHandle} style={[S.copyBtn, softGlass]}>
                  <Text style={[S.copyBtnText, { color: copied ? colors.primary : colors.textSecondary }]}>
                    {copied ? '✓ copied' : 'copy hash'}
                  </Text>
                </Pressable>
              </View>
            </View>
          </View>

          {/* ── Paired hardware ── */}
          <SectionLabel right={
            <Pressable onPress={() => setPairOpen(true)} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Feather name="plus" size={11} color={colors.primary} />
              <Text style={[S.actionText, { color: colors.primary }]}>ADD</Text>
            </Pressable>
          }>
            paired hardware
          </SectionLabel>

          <View style={{ paddingHorizontal: 16 }}>
            {paired ? (
              <View style={[S.hwCard, baseGlass]}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  <View style={[S.hwIcon, accentGlass]}>
                    <Feather name="radio" size={22} color={colors.primary} />
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={[S.hwName,   { color: colors.textPrimary }]}>{paired.name}</Text>
                    <Text style={[S.hwSerial, { color: colors.textTertiary }]}>{paired.serial}</Text>
                    <View style={{ flexDirection: 'row', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
                      <Pill label="CONNECTED" variant="success" dot />
                      <Pill label="LoRa"      variant="default" />
                      <Pill label="78% BATT"  variant="default" />
                    </View>
                  </View>
                </View>
                <View style={S.hwActions}>
                  {(['configure', 'update fw'] as const).map(a => (
                    <Pressable key={a} style={[S.hwActionBtn, softGlass]}>
                      <Text style={[S.hwActionText, { color: colors.textSecondary }]}>{a.toUpperCase()}</Text>
                    </Pressable>
                  ))}
                  <Pressable onPress={() => setPaired(null)} style={[S.hwActionBtn, softGlass]}>
                    <Text style={[S.hwActionText, { color: colors.error }]}>UNPAIR</Text>
                  </Pressable>
                </View>
              </View>
            ) : (
              <Pressable onPress={() => setPairOpen(true)} style={[S.addHwBtn, baseGlass, { borderStyle: 'dashed' }]}>
                <View style={[S.hwIcon, softGlass]}>
                  <Feather name="plus" size={18} color={colors.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[S.hwName,   { color: colors.textPrimary }]}>pair an rnode</Text>
                  <Text style={[S.hwSerial, { color: colors.textTertiary }]}>EXTEND RANGE WITH LoRa HARDWARE</Text>
                </View>
                <Feather name="chevron-right" size={13} color={colors.textTertiary} />
              </Pressable>
            )}
          </View>

          {/* ── Privacy & security ── */}
          <SectionLabel>privacy & security</SectionLabel>
          <View style={{ paddingHorizontal: 16 }}>
            <View style={[S.section, baseGlass]}>
              <SettingsRow icon="lock" label="biometric unlock" sub="face id · required for transactions" right={<Toggle on={biometric} onChange={v => { if (v) setBiometric(true); else setDisableBioOpen(true); }} />} />
              <SettingsRow icon="refresh-cw" label="rotate keypair"    sub="generate new ed25519 · keeps handle" right={<Feather name="chevron-right" size={12} color={colors.textTertiary} />} onPress={() => setRotateOpen(true)} />
              <SettingsRow icon="upload"     label="export secret key" sub="bs58 · ed25519 · offline only"       right={<Feather name="chevron-right" size={12} color={colors.textTertiary} />} onPress={() => setExportOpen(true)} last />
            </View>
          </View>

          {/* ── Network ── */}
          <SectionLabel>network</SectionLabel>
          <View style={{ paddingHorizontal: 16 }}>
            <View style={[S.section, baseGlass]}>
              <SettingsRow icon="share-2"        label="mesh over cellular"  sub="fall back to 4g/5g when mesh is sparse"  right={<Toggle on={meshOnCell}    onChange={setMeshOnCell}    />} />
              <SettingsRow icon="message-circle" label="notifications"       sub="encrypted · mesh-delivered"               right={<Toggle on={notifications} onChange={setNotifications} />} />
              <SettingsRow icon="zap"            label="preferred interface" sub="auto · prioritizes lora when paired"      right={<Text style={[S.valueText, { color: colors.textSecondary }]}>AUTO</Text>} last />
            </View>
          </View>

          {/* ── About ── */}
          <SectionLabel>about</SectionLabel>
          <View style={{ paddingHorizontal: 16 }}>
            <View style={[S.section, baseGlass]}>
              <SettingsRow label="app version" right={<Text style={[S.valueText, { color: colors.textSecondary }]}>0.4.1 · build 2026.04</Text>} last />
            </View>

            <Pressable
              onPress={handleSignOut}
              disabled={walletLoading}
              style={[S.signOut, { borderColor: colors.error + '38', opacity: walletLoading ? 0.5 : 1 }]}
            >
              <Text style={[S.signOutText, { color: colors.error }]}>
                {walletLoading ? 'DISCONNECTING…' : 'SIGN OUT · BURN SESSION'}
              </Text>
            </Pressable>
          </View>

        </ScrollView>
      </SafeAreaView>

      {qrOpen      && <QRModal             onClose={() => setQrOpen(false)}    />}
      {pairOpen    && <RNodePairModal      onClose={() => setPairOpen(false)}   onPaired={onPaired} />}
      {rotateOpen      && <RotateKeypairModal   onClose={() => setRotateOpen(false)} />}
      {exportOpen      && <ExportWalletModal    onClose={() => setExportOpen(false)} />}
      {disableBioOpen  && <DisableBiometricModal onClose={() => setDisableBioOpen(false)} onConfirm={() => setBiometric(false)} />}
    </View>
  );
}

const S = StyleSheet.create({
  root:          { flex: 1 },
  identityCard:  { borderRadius: 18, padding: 20, flexDirection: 'column', gap: 14, alignItems: 'stretch' },
  qrWrap:        { padding: 8, borderRadius: 12, borderWidth: 0.5, overflow: 'hidden' },
  idLabel:       { fontFamily: fontFamily.sansMd, fontSize: 9.5, letterSpacing: 2.5, textTransform: 'uppercase' },
  idHandle:      { fontFamily: fontFamily.sansMd, fontSize: 16, letterSpacing: 0.3 },
  idDisplayName: { fontFamily: fontFamily.sansMd, fontSize: 10, letterSpacing: 2, textTransform: 'uppercase' },
  idHash:        { fontFamily: fontFamily.sansMd, fontSize: 11, marginTop: 2 },
  copyBtn:       { paddingHorizontal: 9, paddingVertical: 4, borderRadius: 99 },
  copyBtnText:   { fontFamily: fontFamily.sansMd, fontSize: 9, letterSpacing: 1.5, textTransform: 'uppercase' },
  actionText:    { fontFamily: fontFamily.sansMd, fontSize: 10, letterSpacing: 1.5, textTransform: 'uppercase' },
  section:       { borderRadius: 16, overflow: 'hidden' },
  valueText:     { fontFamily: fontFamily.sansMd, fontSize: 11, letterSpacing: 0.5, textTransform: 'uppercase' },
  hwCard:        { borderRadius: 16, padding: 14 },
  hwIcon:        { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  hwName:        { fontSize: 14, letterSpacing: -0.2 },
  hwSerial:      { fontFamily: fontFamily.sansMd, fontSize: 9.5, letterSpacing: 1.5, textTransform: 'uppercase', marginTop: 3 },
  hwActions:     { flexDirection: 'row', gap: 6, marginTop: 12 },
  hwActionBtn:   { flex: 1, padding: 9, borderRadius: 10, alignItems: 'center' },
  hwActionText:  { fontFamily: fontFamily.sansMd, fontSize: 10, letterSpacing: 1.5, textTransform: 'uppercase' },
  addHwBtn:      { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, borderRadius: 16 },
  signOut:       { marginTop: 10, padding: 13, borderRadius: 12, borderWidth: 0.5, alignItems: 'center', backgroundColor: 'transparent' },
  signOutText:   { fontFamily: fontFamily.sansMd, fontSize: 11, fontWeight: '500', letterSpacing: 3, textTransform: 'uppercase' },
});

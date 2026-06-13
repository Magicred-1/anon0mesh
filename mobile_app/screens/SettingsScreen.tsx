import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Alert, Dimensions, ScrollView, View, Text, Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { fontFamily, fontSize, radii, spacing, useTheme } from '@/theme';
import { useGlass } from '@/hooks/useGlass';
import { Pill } from '@/components/ui/Pill';
import { useWallet } from '@/context/WalletContext';
import { useLxmfContext } from '@/context/LxmfContext';
import { PrefKeys, prefGetJson, prefSetJson, prefRemove } from '@/src/storage';
import { type Href, useRouter } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import Constants from 'expo-constants';
import { useNotificationEnabled } from '@/hooks/useNotificationEnabled';
import { useBiometricEnabled } from '@/hooks/useBiometricEnabled';
import { SolanaIcon } from '@/components/onboarding/SolanaIcon';
import { PreviewedActions } from '@/components/primitives';

import {
  QRCode, Toggle, SectionLabel, SettingsRow,
  QRModal, ExportWalletModal, RNodePairModal, RotateKeypairModal, DisableBiometricModal,
  type PairedDevice,
} from '@/components/settings';

const SCREEN_W    = Dimensions.get('window').width;
const CARD_OUTER  = 32; // 16px padding each side
const CONTACTS_ROUTE = '/contacts' as Href;

export default function SettingsScreen() {
  const { colors } = useTheme();
  const baseGlass   = useGlass();
  const accentGlass = useGlass('accent');
  const softGlass   = useGlass('soft');

  const [pairOpen,      setPairOpen]      = useState(false);
  const [rotateOpen,    setRotateOpen]    = useState(false);
  const [exportOpen,    setExportOpen]    = useState(false);
  const [qrOpen,        setQrOpen]        = useState(false);
  const [qrTab,         setQrTab]         = useState<'anonmesh' | 'wallet'>('anonmesh');
  const [copied,        setCopied]        = useState(false);
  const [copiedWallet,  setCopiedWallet]  = useState(false);
  const [cardPage,      setCardPage]      = useState(0);
  const [cardWidth,     setCardWidth]     = useState(SCREEN_W - CARD_OUTER);
  const [paired,        setPaired]        = useState<PairedDevice>(null);
  const [notifications,  setNotifications]  = useNotificationEnabled();
  const [biometric,      setBiometric]      = useBiometricEnabled();
  const [disableBioOpen, setDisableBioOpen] = useState(false);

  const cardScrollRef = useRef<ScrollView>(null);

  const router = useRouter();
  const { disconnect, isLoading: walletLoading, publicKey, walletMode } = useWallet();
  const { status, displayName, rnodeConnected, unpairNusRNode } = useLxmfContext();

  const meshAddress  = status?.addressHex ?? '';
  const shortHash    = meshAddress ? `${meshAddress.slice(0, 6)}..${meshAddress.slice(-6)}` : '——';
  const pubkeyStr    = publicKey?.toBase58() ?? '';
  const shortPubkey  = pubkeyStr ? `${pubkeyStr.slice(0, 4)}…${pubkeyStr.slice(-4)}` : '——';


  const doDisconnect = useCallback(async () => {
    await disconnect();
    router.replace('/onboarding');
  }, [disconnect, router]);

  const handleSignOut = useCallback(() => {
    // MWA keys live in the device Seed Vault — disconnect only clears the cached
    // session token, so there is nothing for the user to back up here.
    if (walletMode === 'mwa') {
      Alert.alert(
        'Disconnect wallet?',
        'This signs you out of this device. Your keys stay in your Solana Mobile Seed Vault — reconnect any time.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Disconnect', style: 'destructive', onPress: () => { void doDisconnect(); } },
        ],
      );
      return;
    }
    // Local wallet: disconnect does NOT erase the key from this device — you can
    // sign back in with biometrics/passcode. But if this device is lost, reset,
    // or the app is uninstalled, the key is gone forever unless you exported your
    // recovery key. Warn honestly and offer the backup path first.
    Alert.alert(
      'Disconnect wallet?',
      'You can sign back in on this device with your biometrics or passcode. But if you lose this device or reinstall the app, your wallet and any funds are unrecoverable without your recovery key. Export it first if you have not already.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Export key first', onPress: () => setExportOpen(true) },
        { text: 'Disconnect', style: 'destructive', onPress: () => { void doDisconnect(); } },
      ],
    );
  }, [walletMode, doDisconnect]);

  const copyHandle = useCallback(async () => {
    if (meshAddress) await Clipboard.setStringAsync(meshAddress);
    setCopied(true);
    setTimeout(() => setCopied(false), 1400);
  }, [meshAddress]);

  const copyWallet = useCallback(async () => {
    if (pubkeyStr) await Clipboard.setStringAsync(pubkeyStr);
    setCopiedWallet(true);
    setTimeout(() => setCopiedWallet(false), 1400);
  }, [pubkeyStr]);

  useEffect(() => {
    prefGetJson<{ id: string; name: string; serial: string }>(PrefKeys.RNODE_LAST_PAIRED).then(saved => {
      if (saved) setPaired({ id: saved.id, name: saved.name, serial: saved.serial, rssi: 0 });
    });
  }, []);

  const onPaired = useCallback((d: NonNullable<PairedDevice>) => {
    setPaired(d);
    prefSetJson(PrefKeys.RNODE_LAST_PAIRED, { id: d.id, name: d.name, serial: d.serial }).catch(() => {});
  }, []);

  const swipeTo = (page: number) => {
    Haptics.selectionAsync().catch(() => {});
    cardScrollRef.current?.scrollTo({ x: page * cardWidth, animated: true });
    setCardPage(page);
  };

  return (
    <View style={[S.root, { backgroundColor: colors.background }]}>
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: spacing[9] }}>

          {/* ── Swipeable identity card ── */}
          <View style={{ paddingHorizontal: spacing[5], paddingTop: spacing[5], paddingBottom: spacing[3] }}>
            <View
              style={[S.identityCard, baseGlass]}
              onLayout={e => setCardWidth(e.nativeEvent.layout.width)}
            >
              <ScrollView
                ref={cardScrollRef}
                horizontal
                pagingEnabled
                scrollEventThrottle={16}
                showsHorizontalScrollIndicator={false}
                nestedScrollEnabled
                directionalLockEnabled
                onScroll={e => setCardPage(Math.round(e.nativeEvent.contentOffset.x / cardWidth))}
              >
                {/* ── Page 0: Anonmesh identity ── */}
                <View style={[S.slide, { width: cardWidth }]}>
                  <Text accessibilityRole="header" style={[S.idLabel, { color: colors.textTertiary }]}>YOUR IDENTITY</Text>
                  <Pressable
                    onPress={() => { setQrTab('anonmesh'); setQrOpen(true); }}
                    style={[S.qrWrap, { backgroundColor: colors.surface2, borderColor: colors.border }]}
                  >
                    <QRCode size={116} data={meshAddress || 'no-identity'} />
                  </Pressable>
                  <View style={{ alignItems: 'center', gap: 3 }}>
                    <Text style={[S.idHandle, { color: colors.textPrimary }]}>@{displayName}</Text>
                    <Text style={[S.idHash,   { color: colors.textSecondary }]}>{shortHash}</Text>
                  </View>
                  <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 6 }}>
                    <Pressable onPress={copyHandle} style={[S.pill, softGlass]}>
                      <Feather name={copied ? 'check' : 'copy'} size={9} color={copied ? colors.primary : colors.textSecondary} />
                      <Text style={[S.pillText, { color: copied ? colors.primary : colors.textSecondary }]}>
                        {copied ? 'copied' : 'copy hash'}
                      </Text>
                    </Pressable>
                    <Pressable onPress={() => swipeTo(1)} style={[S.pill, softGlass]}>
                      <Text style={[S.pillText, { color: colors.textSecondary }]}>identity</Text>
                    </Pressable>
                  </View>
                </View>

                {/* ── Page 1: Solana wallet ── */}
                <View style={[S.slide, { width: cardWidth }]}>
                  <View style={S.solLabel}>
                    <SolanaIcon size={10} color={colors.textTertiary} />
                    <Text accessibilityRole="header" style={[S.idLabel, { color: colors.textTertiary }]}>SOLANA WALLET</Text>
                  </View>

                  <Pressable
                    onPress={() => { setQrTab('wallet'); setQrOpen(true); }}
                    style={[S.qrWrap, { backgroundColor: colors.surface2, borderColor: colors.border }]}
                  >
                    <QRCode size={116} data={pubkeyStr || 'no-wallet'} />
                  </Pressable>

                  <View style={{ alignItems: 'center', gap: 3 }}>
                    <Text style={[S.idHandle, { color: colors.textPrimary }]}>{shortPubkey}</Text>
                  </View>

                  <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 6 }}>
                    <Pressable onPress={copyWallet} style={[S.pill, softGlass]}>
                      <Feather name={copiedWallet ? 'check' : 'copy'} size={9} color={copiedWallet ? colors.primary : colors.textSecondary} />
                      <Text style={[S.pillText, { color: copiedWallet ? colors.primary : colors.textSecondary }]}>
                        {copiedWallet ? 'copied' : 'copy address'}
                      </Text>
                    </Pressable>
                    <Pressable onPress={() => swipeTo(0)} style={[S.pill, softGlass]}>
                      <Feather name="wifi" size={9} color={colors.textSecondary} />
                      <Text style={[S.pillText, { color: colors.textSecondary }]}>Solana</Text>
                    </Pressable>
                  </View>
                </View>
              </ScrollView>

              {/* ── Page dots ── */}
              <View style={S.dots}>
                {[0, 1].map(i => (
                  <Pressable key={i} onPress={() => swipeTo(i)}>
                    <View style={[S.dot, { backgroundColor: cardPage === i ? colors.primary : colors.borderSubtle, width: cardPage === i ? 16 : 6 }]} />
                  </Pressable>
                ))}
              </View>
            </View>
          </View>

          {/* ── Paired hardware ── */}
          <SectionLabel right={
            <Pressable onPress={() => setPairOpen(true)} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing[2] }}>
              <Feather name="plus" size={11} color={colors.primary} />
              <Text style={[S.actionText, { color: colors.primary }]}>ADD</Text>
            </Pressable>
          }>
            hardware radio
          </SectionLabel>

          <View style={{ paddingHorizontal: spacing[5] }}>
            {paired ? (
              <View style={[S.hwCard, baseGlass]}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing[4] }}>
                  <View style={[S.hwIcon, accentGlass]}>
                    <Feather name="radio" size={22} color={colors.primary} />
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={[S.hwName,   { color: colors.textPrimary }]}>{paired.name}</Text>
                    <Text style={[S.hwSerial, { color: colors.textTertiary }]}>{paired.serial}</Text>
                    <View style={{ flexDirection: 'row', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
                      {rnodeConnected
                        ? <Pill label="CONNECTED"   variant="primary" dot />
                        : <Pill label="RECONNECTING" variant="warning" dot />}
                      <Pill label="LoRa" variant="default" />
                      {/* 78% BATT pill removed per AUDIT T11 / ROADMAP § 0.B.5
                          — no battery telemetry from the pairing API today. */}
                    </View>
                  </View>
                </View>
                <View style={S.hwActions}>
                  {/* AUDIT T5 follow-on: 'configure' and 'update fw' buttons
                      had no onPress — pure visual placeholders. Wrap them so
                      taps surface the preview-hint instead of silently doing
                      nothing. UNPAIR is real and stays plain. */}
                  {(['configure', 'update fw'] as const).map(a => (
                    <PreviewedActions key={a} hint={`${a} not yet wired`} style={S.hwActionWrap}>
                      <View style={[S.hwActionBtn, softGlass]}>
                        <Text style={[S.hwActionText, { color: colors.textSecondary }]}>{a.toUpperCase()}</Text>
                      </View>
                    </PreviewedActions>
                  ))}
                  <Pressable
                    onPress={() => {
                      if (paired?.id) { try { unpairNusRNode(paired.id); } catch {} }
                      prefRemove(PrefKeys.RNODE_LAST_PAIRED).catch(() => {});
                      setPaired(null);
                    }}
                    style={[S.hwActionBtn, softGlass]}
                  >
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
                  <Text style={[S.hwName,   { color: colors.textPrimary }]}>pair with hardware</Text>
                  <Text style={[S.hwSerial, { color: colors.textTertiary }]}>BOOST MESH RANGE WITH LoRa RADIO</Text>
                </View>
                <Feather name="chevron-right" size={13} color={colors.textTertiary} />
              </Pressable>
            )}
          </View>

          {/* ── Privacy & security ── */}
          <SectionLabel>privacy & security</SectionLabel>
          <View style={{ paddingHorizontal: spacing[5] }}>
            <View style={[S.section, baseGlass]}>
              <SettingsRow icon="lock" label="biometric lock" sub="face id / touch id · required for transactions" right={<Toggle on={biometric} onChange={v => { if (v) setBiometric(true); else setDisableBioOpen(true); }} />} />
              <SettingsRow icon="book-open" label="address book" sub="local recipients · labels never sync" right={<Feather name="chevron-right" size={12} color={colors.textTertiary} />} onPress={() => router.push(CONTACTS_ROUTE)} />
              <SettingsRow icon="refresh-cw" label="rotate identity keys" sub="new signing key · your handle stays the same" right={<Feather name="chevron-right" size={12} color={colors.textTertiary} />} onPress={() => setRotateOpen(true)} />
              <SettingsRow icon="key"        label="reveal recovery key" sub="biometric required · store offline only" right={<Feather name="chevron-right" size={12} color={colors.textTertiary} />} onPress={() => setExportOpen(true)} last />
            </View>
          </View>

          {/* ── Network ── */}
          <SectionLabel>network</SectionLabel>
          <View style={{ paddingHorizontal: spacing[5] }}>
            <View style={[S.section, baseGlass]}>
              {/* Cellular fallback isn't wired to any transport yet. Wrap it in the
                  same preview shield as the unbuilt hardware controls so the toggle
                  reads as 'not yet active' instead of a switch that silently does
                  nothing. */}
              <PreviewedActions hint="cellular fallback not yet active" opacity={1}>
                <SettingsRow icon="share-2"        label="cellular fallback"    sub="use 4g/5g when off-mesh or peers unreachable"  right={<Toggle on={false} onChange={() => {}} />} />
              </PreviewedActions>
              <SettingsRow icon="message-circle" label="message notifications" sub="encrypted · mesh-delivered"             right={<Toggle on={notifications} onChange={setNotifications} />} last />
            </View>
          </View>

          {/* ── About ── */}
          <SectionLabel>about</SectionLabel>
          <View style={{ paddingHorizontal: spacing[5] }}>
            <View style={[S.section, baseGlass]}>
              <SettingsRow label="app version" right={<Text style={[S.valueText, { color: colors.textSecondary }]}>{Constants.expoConfig?.version ?? '—'}</Text>} last />
            </View>

            <Pressable
              onPress={handleSignOut}
              disabled={walletLoading}
              style={[S.signOut, { borderColor: colors.error + '38', opacity: walletLoading ? 0.5 : 1 }]}
            >
              <Text style={[S.signOutText, { color: colors.error }]}>
                {walletLoading ? 'DISCONNECTING…' : 'DISCONNECT'}
              </Text>
            </Pressable>
          </View>

        </ScrollView>
      </SafeAreaView>

      {qrOpen          && <QRModal              onClose={() => setQrOpen(false)} initialTab={qrTab} />}
      {pairOpen        && <RNodePairModal        onClose={() => setPairOpen(false)}     onPaired={onPaired} />}
      {rotateOpen      && <RotateKeypairModal    onClose={() => setRotateOpen(false)}   />}
      {exportOpen      && <ExportWalletModal     onClose={() => setExportOpen(false)}   />}
      {disableBioOpen  && <DisableBiometricModal onClose={() => setDisableBioOpen(false)} onConfirm={() => setBiometric(false)} />}
    </View>
  );
}

const S = StyleSheet.create({
  root:         { flex: 1 },

  // ── Identity card ────────────────────────────────────────────────────────────
  identityCard: { borderRadius: radii.xl, overflow: 'hidden' },
  slide:        { paddingHorizontal: spacing[6], paddingTop: spacing[6], paddingBottom: spacing[2], gap: 14, alignItems: 'center' },
  idLabel:      { fontFamily: fontFamily.sansMd, fontSize: 9.5, letterSpacing: 2.5, textTransform: 'uppercase' },
  qrWrap:       { padding: spacing[3], borderRadius: radii.md, borderWidth: 0.5, overflow: 'hidden' },
  idHandle:     { fontFamily: fontFamily.sansMd, fontSize: fontSize.md, letterSpacing: 0.3 },
  idHash:       { fontFamily: fontFamily.sansMd, fontSize: fontSize.xs, marginTop: 2 },

  // Solana wallet slide
  solLabel:     { flexDirection: 'row', alignItems: 'center', gap: 5 },

  // Shared pill buttons
  pill:         { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: radii.full },
  pillText:     { fontFamily: fontFamily.sansMd, fontSize: 9, letterSpacing: 1.2, textTransform: 'uppercase' },

  // Page dots
  dots:         { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 5, paddingVertical: spacing[4] },
  dot:          { height: 6, borderRadius: radii.full },

  // ── Rest ─────────────────────────────────────────────────────────────────────
  actionText:   { fontFamily: fontFamily.sansMd, fontSize: 10, letterSpacing: 1.5, textTransform: 'uppercase' },
  section:      { borderRadius: radii.lg, overflow: 'hidden' },
  valueText:    { fontFamily: fontFamily.sansMd, fontSize: fontSize.xs, letterSpacing: 0.5, textTransform: 'uppercase' },
  hwCard:       { borderRadius: radii.lg, padding: 14 },
  hwIcon:       { width: 44, height: 44, borderRadius: radii.md, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  hwName:       { fontSize: fontSize.md, letterSpacing: -0.2 },
  hwSerial:     { fontFamily: fontFamily.sansMd, fontSize: 9.5, letterSpacing: 1.5, textTransform: 'uppercase', marginTop: 3 },
  hwActions:    { flexDirection: 'row', gap: 6, marginTop: spacing[4] },
  hwActionWrap: { flex: 1 },
  hwActionBtn:  { flex: 1, padding: 9, borderRadius: radii.md, alignItems: 'center' },
  hwActionText: { fontFamily: fontFamily.sansMd, fontSize: 10, letterSpacing: 1.5, textTransform: 'uppercase' },
  addHwBtn:     { flexDirection: 'row', alignItems: 'center', gap: spacing[4], padding: spacing[5], borderRadius: radii.lg },
  signOut:      { marginTop: 10, padding: 13, borderRadius: radii.md, borderWidth: 0.5, alignItems: 'center', backgroundColor: 'transparent' },
  signOutText:  { fontFamily: fontFamily.sansMd, fontSize: fontSize.xs, fontWeight: '500', letterSpacing: 3, textTransform: 'uppercase' },
});

/**
 * Dev-only Arcium beacon-privacy operator screen.
 * Drives register -> bind -> init stats -> record relay -> decrypt count against
 * the live anonbeta1 program on devnet, showing each phase. Reachable only in
 * __DEV__ (see app/dev). Not a production user surface.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack } from 'expo-router';

import { fontFamily, fontSize, useTheme } from '@/theme';
import { useWallet } from '@/context/WalletContext';
import { useNetworkMode } from '@/src/hooks/useNetworkMode';
import {
  registerBeacon, waitForBindingVerified, initRelayStats,
  recordRelay, waitForRelayRecorded, getBeaconStatus, getDecryptedRelayCount,
  type BeaconStatus,
} from '@/src/services/arcium';
import { runCryptoSelfTest, type SelfTestResult } from '@/src/services/arcium/selfTest';

export default function ArciumBeaconDevScreen() {
  const { colors } = useTheme();
  const { wallet, publicKey, isConnected } = useWallet();
  const { adapter: rpcAdapter } = useNetworkMode();

  const [status, setStatus] = useState<BeaconStatus | null>(null);
  const [count, setCount] = useState<bigint | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastTx, setLastTx] = useState<string | null>(null);
  const [selfTest, setSelfTest] = useState<SelfTestResult | null>(null);

  const onSelfTest = useCallback(() => {
    const result = runCryptoSelfTest();
    setSelfTest(result);
    // logged so it can be captured via logcat during automated on-device runs
    console.log('[arcium self-test]', result.pass ? 'PASS' : 'FAIL', JSON.stringify(result.lines));
  }, []);

  const ctx = useMemo(
    () => (wallet && rpcAdapter ? { walletAdapter: wallet, rpcAdapter } : null),
    [wallet, rpcAdapter],
  );

  const refresh = useCallback(async () => {
    if (!ctx) return;
    try {
      setStatus(await getBeaconStatus(ctx));
      setCount(await getDecryptedRelayCount(ctx));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [ctx]);

  useEffect(() => {
    if (ctx && isConnected) void refresh();
  }, [ctx, isConnected, refresh]);

  const run = useCallback(
    (phase: string, fn: () => Promise<void>) => async () => {
      if (!ctx) return;
      setError(null);
      setBusy(phase);
      try {
        await fn();
        await refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        setBusy(null);
      }
    },
    [ctx, refresh],
  );

  const onRegister = run('Registering beacon + Arcium binding (MPC)…', async () => {
    const res = await registerBeacon(ctx!);
    setLastTx(res.signature);
    await waitForBindingVerified(ctx!);
  });
  const onInitStats = run('Initializing encrypted relay stats…', async () => {
    const res = await initRelayStats(ctx!);
    setLastTx(res.signature);
  });
  const onRecordRelay = run('Recording relay + Arcium increment (MPC)…', async () => {
    const res = await recordRelay(ctx!);
    setLastTx(res.signature);
    await waitForRelayRecorded(ctx!);
  });

  const s = StyleSheet.create({
    body: { padding: 16, gap: 14 },
    title: { fontFamily: fontFamily.sansSb, fontSize: fontSize.lg, color: colors.textPrimary },
    blurb: { fontFamily: fontFamily.sans, fontSize: fontSize.sm, color: colors.textSecondary, lineHeight: 19 },
    card: { backgroundColor: colors.surface1, borderColor: colors.borderSubtle, borderWidth: 1, borderRadius: 12, padding: 14, gap: 8 },
    row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    label: { fontFamily: fontFamily.sans, fontSize: fontSize.sm, color: colors.textTertiary },
    value: { fontFamily: fontFamily.sansMd, fontSize: fontSize.sm, color: colors.textPrimary },
    btn: { backgroundColor: colors.primary, borderRadius: 10, paddingVertical: 13, alignItems: 'center' },
    btnGhost: { backgroundColor: 'transparent', borderColor: colors.borderSubtle, borderWidth: 1 },
    btnText: { fontFamily: fontFamily.sansSb, fontSize: fontSize.md, color: colors.background },
    btnTextGhost: { color: colors.textPrimary },
    disabled: { opacity: 0.4 },
    busy: { flexDirection: 'row', gap: 10, alignItems: 'center' },
    busyText: { fontFamily: fontFamily.sans, fontSize: fontSize.sm, color: colors.textSecondary, flex: 1 },
    err: { fontFamily: fontFamily.sansMd, fontSize: fontSize.sm, color: '#dc2626' },
    mono: { fontFamily: fontFamily.sans, fontSize: fontSize.xs, color: colors.textTertiary },
  });

  const Btn = ({ label, onPress, disabled, ghost }: { label: string; onPress: () => void; disabled?: boolean; ghost?: boolean }) => (
    <Pressable
      onPress={onPress}
      disabled={disabled || !!busy}
      style={[s.btn, ghost && s.btnGhost, (disabled || !!busy) && s.disabled]}
    >
      <Text style={[s.btnText, ghost && s.btnTextGhost]}>{label}</Text>
    </Pressable>
  );

  const StatusRow = ({ label, value }: { label: string; value: string }) => (
    <View style={s.row}><Text style={s.label}>{label}</Text><Text style={s.value}>{value}</Text></View>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['bottom']}>
      <Stack.Screen options={{ title: 'Arcium Beacon (dev)' }} />
      <ScrollView contentContainerStyle={s.body}>
        <Text style={s.title}>Beacon privacy</Text>
        <Text style={s.blurb}>
          Register this wallet as a relay beacon. The RNS destination is encrypted and bound via
          Arcium MPC (never public), and relay activity is counted in an encrypted on-chain
          counter only you can decrypt. Runs against anonbeta1 on devnet.
        </Text>

        <Btn label="Run crypto self-test (Hermes)" onPress={onSelfTest} ghost />
        {selfTest && (
          <View style={s.card}>
            <Text style={[s.value, { color: selfTest.pass ? '#16a34a' : '#dc2626' }]}>
              {selfTest.pass ? 'SELF-TEST PASS ✓' : 'SELF-TEST FAIL ✗'}
            </Text>
            {selfTest.lines.map((l) => (
              <View key={l.name} style={s.row}>
                <Text style={s.label}>{l.name}</Text>
                <Text style={[s.value, { color: l.ok ? '#16a34a' : '#dc2626' }]}>{l.ok ? '✓' : '✗'}</Text>
              </View>
            ))}
          </View>
        )}

        {!isConnected || !ctx ? (
          <View style={s.card}><Text style={s.value}>Connect a wallet first.</Text></View>
        ) : (
          <>
            <View style={s.card}>
              <StatusRow label="Operator" value={publicKey ? `${publicKey.toBase58().slice(0, 4)}…${publicKey.toBase58().slice(-4)}` : '—'} />
              <StatusRow label="Registered" value={status?.registered ? 'yes' : 'no'} />
              <StatusRow label="Binding verified" value={status?.bindingVerified ? 'yes ✓' : 'pending'} />
              <StatusRow label="Relay stats" value={status?.relayStatsInitialized ? 'initialized' : 'not set'} />
              <StatusRow label="Settlements" value={String(status?.settlementCount ?? 0)} />
              <StatusRow label="Decrypted relay count" value={count === null ? '—' : count.toString()} />
            </View>

            {busy && (
              <View style={[s.card, s.busy]}>
                <ActivityIndicator color={colors.primary} />
                <Text style={s.busyText}>{busy}</Text>
              </View>
            )}
            {error && <Text style={s.err}>{error}</Text>}
            {lastTx && <Text style={s.mono}>last tx: {lastTx.slice(0, 16)}…</Text>}

            <Btn label="1 · Register beacon" onPress={onRegister} disabled={status?.registered} />
            <Btn label="2 · Init relay stats" onPress={onInitStats} disabled={!status?.bindingVerified || status?.relayStatsInitialized} />
            <Btn label="3 · Record relay" onPress={onRecordRelay} disabled={!status?.relayStatsInitialized} />
            <Btn label="Refresh" onPress={() => void refresh()} ghost />
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

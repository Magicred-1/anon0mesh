/**
 * BeaconStatus — minimal UI block for the Solana on-chain beacon registry.
 *
 * Intentionally distinct from `BeaconRegistry.tsx` (which is a UI shell
 * for LXMF-only beacon-mode toggle with mock stake/yield data).
 * This block reflects actual on-chain state from the `anonbeta1` program.
 *
 * Shows registered/unregistered chip + last heartbeat timestamp + manual
 * Register button. Disabled until wallet connected, LXMF node running,
 * and online. Stub until IDL drops on devnet — `register` will throw
 * with a placeholder discriminator until the program ID matches deploy.
 */

import React, { memo, useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { fontFamily, useTheme } from '@/theme';
import { useGlass } from '@/hooks/useGlass';
import { Pill } from '@/components/ui/Pill';
import { useBeaconRegistry } from '@/context/BeaconContext';
import { useWallet } from '@/context/WalletContext';
import { useLxmfContext } from '@/context/LxmfContext';
import { useNetworkMode } from '@/src/hooks/useNetworkMode';

const REGION_UNSPECIFIED = new Uint8Array(4); // all-zero

interface Props {
  readonly style?: import('react-native').ViewStyle;
}

function formatRelative(unixSeconds: number): string {
  const delta = Math.floor(Date.now() / 1000) - unixSeconds;
  if (delta < 5)        return 'just now';
  if (delta < 60)       return `${delta}s ago`;
  if (delta < 3600)     return `${Math.floor(delta / 60)}m ago`;
  if (delta < 86_400)   return `${Math.floor(delta / 3600)}h ago`;
  return `${Math.floor(delta / 86_400)}d ago`;
}

export const BeaconStatus = memo(function BeaconStatus({ style }: Props) {
  const { colors } = useTheme();
  const glass = useGlass();
  const {
    status, isRegistered, isPending, lastHeartbeatAt, lastError, register, refresh,
  } = useBeaconRegistry();
  const { isConnected: walletConnected } = useWallet();
  const { isRunning } = useLxmfContext();
  const { mode: networkMode } = useNetworkMode();

  const [busy, setBusy] = useState(false);

  const canRegister =
    walletConnected && isRunning && networkMode === 'online' && !isPending && !busy;

  const onRegister = useCallback(async () => {
    if (!canRegister) return;
    setBusy(true);
    try {
      await register(REGION_UNSPECIFIED);
    } catch {
      // error is surfaced via lastError
    } finally {
      setBusy(false);
    }
  }, [canRegister, register]);

  let chipLabel: string;
  let chipVariant: 'primary' | 'default' = 'default';
  if (status.state === 'registered')        { chipLabel = 'REGISTERED';   chipVariant = 'primary'; }
  else if (status.state === 'unregistered') { chipLabel = 'UNREGISTERED'; }
  else                                      { chipLabel = 'UNKNOWN'; }

  const beatLine = (() => {
    if (status.state === 'registered' && status.account.lastHeartbeat > 0) {
      return `Last beat ${formatRelative(status.account.lastHeartbeat)} · ${status.account.heartbeatCount.toString()} total`;
    }
    if (lastHeartbeatAt) return `Last beat ${formatRelative(lastHeartbeatAt)} (local)`;
    return 'No heartbeats yet';
  })();

  return (
    <View style={[S.wrap, style]}>
      <View style={S.labelRow}>
        <Text style={[S.sectionLabel, { color: colors.textTertiary }]}>BEACON ON-CHAIN</Text>
        <Pill label={chipLabel} variant={chipVariant} dot={isRegistered} />
      </View>

      <View style={[S.card, glass, { borderColor: colors.border }]}>
        {isRegistered ? (
          <>
            <Text style={[S.beatLine, { color: colors.textSecondary }]}>{beatLine}</Text>
            <Pressable
              onPress={refresh}
              style={({ pressed }) => [S.refreshBtn, { opacity: pressed ? 0.6 : 1 }]}
              hitSlop={6}
            >
              <Feather name="refresh-cw" size={11} color={colors.textTertiary} />
              <Text style={[S.refreshText, { color: colors.textTertiary }]}>Refresh</Text>
            </Pressable>
          </>
        ) : (
          <>
            <Text style={[S.desc, { color: colors.textSecondary }]}>
              Register your operator wallet on-chain so the explorer can prove your beacon's presence and liveness.
            </Text>
            <Pressable
              onPress={canRegister ? onRegister : undefined}
              style={({ pressed }) => {
                let opacity = 0.35;
                if (canRegister) opacity = pressed ? 0.75 : 1;
                return [S.regBtn, { backgroundColor: colors.primary, opacity }];
              }}
            >
              <Text style={[S.regText, { color: colors.textInverse }]}>
                {busy || isPending ? 'Registering…' : 'Register On-Chain'}
              </Text>
              {canRegister && !busy && !isPending && (
                <Feather name="arrow-right" size={14} color={colors.textInverse} />
              )}
            </Pressable>
            {!walletConnected && (
              <Text style={[S.gateText, { color: colors.textTertiary }]}>Connect wallet first</Text>
            )}
            {walletConnected && !isRunning && (
              <Text style={[S.gateText, { color: colors.textTertiary }]}>Start LXMF node first</Text>
            )}
            {walletConnected && isRunning && networkMode !== 'online' && (
              <Text style={[S.gateText, { color: colors.textTertiary }]}>Requires internet</Text>
            )}
          </>
        )}

        {lastError && (
          <Text style={[S.errLine, { color: colors.textTertiary }]} numberOfLines={2}>
            {lastError}
          </Text>
        )}
      </View>
    </View>
  );
});

const S = StyleSheet.create({
  wrap:         { paddingHorizontal: 20, marginTop: 8, marginBottom: 16 },
  labelRow:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  sectionLabel: { fontFamily: fontFamily.sansMd, fontSize: 10, letterSpacing: 2, textTransform: 'uppercase' },

  card:         { borderRadius: 18, borderWidth: 0.5, padding: 14, gap: 10 },

  beatLine:     { fontFamily: fontFamily.sansMd, fontSize: 12.5, lineHeight: 18 },
  refreshBtn:   { flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'flex-start' },
  refreshText:  { fontFamily: fontFamily.sansMd, fontSize: 11, letterSpacing: 0.5 },

  desc:         { fontFamily: fontFamily.sansMd, fontSize: 12.5, lineHeight: 18 },
  regBtn:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7,
                  marginTop: 6, paddingVertical: 12, borderRadius: 12 },
  regText:      { fontFamily: fontFamily.sansMd, fontSize: 13, fontWeight: '600', letterSpacing: 0.3 },
  gateText:     { fontFamily: fontFamily.sansMd, fontSize: 11, textAlign: 'center', marginTop: 2 },

  errLine:      { fontFamily: fontFamily.sansMd, fontSize: 11, marginTop: 4 },
});

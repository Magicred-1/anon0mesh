import React, { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text } from 'react-native';

import { DepthButton } from '@/components/primitives';
import { solanaConnection } from '@/src/infrastructure/network/connection';
import {
  SPIKE_FIXTURES,
  SPIKE_PROGRAM_ID,
  simulateCosignedTransfer,
  type SpikeSimResult,
} from '@/src/services/contractSpike';
import { fontFamily, fontSize, spacing, useTheme } from '@/theme';

/**
 * SPIKE — proves the app can build a valid anonbeta1 execute_cosigned_transfer
 * and the deployed devnet program accepts it (simulation, no signatures, no
 * funds moved). Dev builds only; not reachable from any production surface.
 */
export default function ContractSpikeScreen() {
  const { colors } = useTheme();
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<SpikeSimResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      setResult(await simulateCosignedTransfer(solanaConnection));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }, [busy]);

  const mono = { fontFamily: fontFamily.mono, fontSize: fontSize.xs };

  return (
    <ScrollView style={{ backgroundColor: colors.surface0 }} contentContainerStyle={S.content}>
      <Text style={[S.title, { color: colors.textPrimary }]}>anonbeta1 settlement spike</Text>
      <Text style={[S.body, { color: colors.textSecondary }]}>
        Builds an execute_cosigned_transfer against the live devnet program and
        simulates it (no signatures, nothing moves). The real path co-signs with
        a beacon operator — proven end-to-end from the workstation harness.
      </Text>

      <Text style={[S.label, { color: colors.textTertiary }]}>PROGRAM</Text>
      <Text style={[mono, { color: colors.textPrimary }]}>{SPIKE_PROGRAM_ID.toBase58()}</Text>
      <Text style={[S.label, { color: colors.textTertiary }]}>BEACON OPERATOR (devnet fixture)</Text>
      <Text style={[mono, { color: colors.textPrimary }]}>{SPIKE_FIXTURES.operator.toBase58()}</Text>

      <DepthButton
        label={busy ? 'Simulating…' : 'Build + simulate on devnet'}
        onPress={run}
        size="lg"
        tone="cyan"
        variant="primary"
        style={S.button}
      />

      {error && (
        <Text style={[S.body, { color: colors.error }]}>{error}</Text>
      )}

      {result && (
        <>
          <Text style={[S.label, { color: result.ok ? colors.primary : colors.error }]}>
            {result.ok ? 'SIMULATION OK — program accepted the instruction' : `SIMULATION FAILED: ${result.err}`}
          </Text>
          <Text style={[S.label, { color: colors.textTertiary }]}>BEACON PDA</Text>
          <Text style={[mono, { color: colors.textPrimary }]}>{result.beaconPda}</Text>
          <Text style={[S.label, { color: colors.textTertiary }]}>SETTLEMENT PDA (fresh)</Text>
          <Text style={[mono, { color: colors.textPrimary }]}>{result.settlementPda}</Text>
          <Text style={[S.label, { color: colors.textTertiary }]}>PROGRAM LOGS</Text>
          {result.logs.slice(-12).map((l, i) => (
            <Text key={`${i}-${l.slice(0, 24)}`} style={[mono, { color: colors.textSecondary }]}>
              {l}
            </Text>
          ))}
        </>
      )}
    </ScrollView>
  );
}

const S = StyleSheet.create({
  content: { padding: spacing[6], gap: spacing[3], paddingBottom: spacing[9] },
  title: { fontFamily: fontFamily.sansBold, fontSize: fontSize['2xl'] },
  body: { fontFamily: fontFamily.sans, fontSize: fontSize.sm, lineHeight: 20 },
  label: {
    fontFamily: fontFamily.sansSb,
    fontSize: fontSize.xs,
    letterSpacing: 1.2,
    marginTop: spacing[3],
    textTransform: 'uppercase',
  },
  button: { marginTop: spacing[5] },
});

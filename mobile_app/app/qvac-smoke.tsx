import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Stack } from 'expo-router';

import { fontFamily, useTheme } from '@/theme';
import { initQvac, isQvacEnabled, type QvacProgress } from '@/src/services/qvac';
import { parseTransferIntent, type TransferIntent } from '@/src/services/qvac/intent';

type SmokeState = 'idle' | 'loading' | 'running' | 'parsing' | 'done' | 'error';

export default function QvacSmokeScreen() {
  const { colors } = useTheme();
  const enabled = isQvacEnabled();
  const [state, setState] = useState<SmokeState>('idle');
  const [progress, setProgress] = useState<QvacProgress | null>(null);
  const [output, setOutput] = useState('');
  const [intent, setIntent] = useState<TransferIntent | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [firstTokenMs, setFirstTokenMs] = useState<number | null>(null);
  const [totalMs, setTotalMs] = useState<number | null>(null);

  const status = useMemo(() => {
    if (!enabled) return 'Set EXPO_PUBLIC_QVAC_ENABLED=true and rebuild to run this smoke test.';
    if (state === 'idle') return 'Ready to download, load, and run a local QVAC completion.';
    if (state === 'loading') return progress?.message ?? 'Preparing QVAC.';
    if (state === 'running') return 'Streaming local completion.';
    if (state === 'parsing') return 'Parsing a local payment request.';
    if (state === 'done') return 'QVAC smoke test complete.';
    return error ?? 'QVAC smoke test failed.';
  }, [enabled, error, progress?.message, state]);

  const runSmoke = async () => {
    if (!enabled || state === 'loading' || state === 'running') return;

    setState('loading');
    setOutput('');
    setIntent(null);
    setError(null);
    setFirstTokenMs(null);
    setTotalMs(null);
    const startedAt = Date.now();

    try {
      const qvac = await initQvac(setProgress);
      setState('running');
      const run = qvac.runCompletion(
        'In one short sentence, say why offline local AI belongs in a mesh wallet.',
      );

      let sawFirstToken = false;
      for await (const event of run.events) {
        if (event.type !== 'contentDelta') continue;
        if (!sawFirstToken) {
          sawFirstToken = true;
          setFirstTokenMs(Date.now() - startedAt);
        }
        setOutput((value) => `${value}${event.text}`);
      }

      await run.final;
      setState('parsing');
      const parsed = await parseTransferIntent(
        'send 0.000001 SOL to 11111111111111111111111111111111 with memo qvac smoke',
        setProgress,
      );
      setIntent(parsed);
      setTotalMs(Date.now() - startedAt);
      setState('done');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setState('error');
    }
  };

  return (
    <ScrollView
      contentContainerStyle={[S.content, { backgroundColor: colors.background }]}
      style={{ backgroundColor: colors.background }}
    >
      <Stack.Screen options={{ title: 'QVAC Smoke', headerShown: false }} />
      <View style={S.header}>
        <View style={[S.icon, { backgroundColor: colors.primary + '18', borderColor: colors.primary + '44' }]}>
          <Feather name="cpu" size={20} color={colors.primary} />
        </View>
        <View style={S.headerText}>
          <Text style={[S.eyebrow, { color: colors.textTertiary }]}>Local inference</Text>
          <Text style={[S.title, { color: colors.textPrimary }]}>QVAC smoke test</Text>
        </View>
      </View>

      <Text style={[S.status, { color: state === 'error' ? colors.error : colors.textSecondary }]}>
        {status}
      </Text>

      {progress?.percentage != null ? (
        <View style={[S.progressTrack, { backgroundColor: colors.surface1 }]}>
          <View
            style={[
              S.progressFill,
              { backgroundColor: colors.primary, width: `${progress.percentage}%` },
            ]}
          />
        </View>
      ) : null}

      <Pressable
        accessibilityRole="button"
        disabled={!enabled || state === 'loading' || state === 'running'}
        onPress={runSmoke}
        style={({ pressed }) => [
          S.button,
          {
            backgroundColor: enabled ? colors.primary : colors.surface2,
            opacity: pressed || state === 'loading' || state === 'running' ? 0.72 : 1,
          },
        ]}
      >
        <Feather name="play" size={16} color="#001014" />
        <Text style={S.buttonText}>{state === 'idle' ? 'Run smoke test' : 'Run again'}</Text>
      </Pressable>

      <View style={[S.metrics, { borderColor: colors.border, backgroundColor: colors.surface0 }]}>
        <Metric label="First token" value={firstTokenMs == null ? '-' : `${firstTokenMs} ms`} />
        <Metric label="Total" value={totalMs == null ? '-' : `${totalMs} ms`} />
        <Metric label="State" value={state} />
      </View>

      <View style={[S.output, { borderColor: colors.border, backgroundColor: colors.surface0 }]}>
        <Text style={[S.outputLabel, { color: colors.textTertiary }]}>Model output</Text>
        <Text style={[S.outputText, { color: colors.textPrimary }]}>
          {output.trim() || 'Run the smoke test to stream the first local completion.'}
        </Text>
      </View>

      <View style={[S.output, { borderColor: colors.border, backgroundColor: colors.surface0 }]}>
        <Text style={[S.outputLabel, { color: colors.textTertiary }]}>Payment parser</Text>
        <Text style={[S.outputText, S.intentText, { color: colors.textPrimary }]}>
          {intent ? JSON.stringify(intent, null, 2) : 'The smoke test also runs the send parser.'}
        </Text>
      </View>
    </ScrollView>
  );
}

function Metric({ label, value }: { readonly label: string; readonly value: string }) {
  const { colors } = useTheme();
  return (
    <View style={S.metric}>
      <Text style={[S.metricLabel, { color: colors.textTertiary }]}>{label}</Text>
      <Text style={[S.metricValue, { color: colors.textPrimary }]}>{value}</Text>
    </View>
  );
}

const S = StyleSheet.create({
  button: {
    alignItems: 'center',
    borderRadius: 12,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    minHeight: 52,
  },
  buttonText: {
    color: '#001014',
    fontFamily: fontFamily.sansSb,
    fontSize: 15,
  },
  content: {
    flexGrow: 1,
    gap: 18,
    padding: 20,
    paddingTop: 72,
  },
  eyebrow: {
    fontFamily: fontFamily.sansMd,
    fontSize: 12,
    textTransform: 'uppercase',
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 14,
  },
  headerText: {
    flex: 1,
  },
  icon: {
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 1,
    height: 48,
    justifyContent: 'center',
    width: 48,
  },
  metric: {
    flex: 1,
    gap: 4,
    minWidth: 82,
  },
  metricLabel: {
    fontFamily: fontFamily.sans,
    fontSize: 11,
  },
  metrics: {
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    padding: 14,
  },
  metricValue: {
    fontFamily: fontFamily.sansSb,
    fontSize: 14,
  },
  output: {
    borderRadius: 12,
    borderWidth: 1,
    gap: 10,
    minHeight: 160,
    padding: 16,
  },
  outputLabel: {
    fontFamily: fontFamily.sansMd,
    fontSize: 12,
    textTransform: 'uppercase',
  },
  outputText: {
    fontFamily: fontFamily.sans,
    fontSize: 16,
    lineHeight: 23,
  },
  intentText: {
    fontFamily: fontFamily.mono,
    fontSize: 13,
    lineHeight: 19,
  },
  progressFill: {
    borderRadius: 999,
    height: '100%',
  },
  progressTrack: {
    borderRadius: 999,
    height: 8,
    overflow: 'hidden',
  },
  status: {
    fontFamily: fontFamily.sans,
    fontSize: 14,
    lineHeight: 20,
  },
  title: {
    fontFamily: fontFamily.sansSb,
    fontSize: 28,
    letterSpacing: 0,
  },
});

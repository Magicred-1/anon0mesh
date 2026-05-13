import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, Stack } from 'expo-router';
import { Feather } from '@expo/vector-icons';

import { PigeonLoader, type PigeonLoaderStatus } from '@/components/ui/PigeonLoader';
import { fontFamily, fontSize, useTheme } from '@/theme';

const LABELS = ['Sending', 'Refreshing', 'Connecting', 'Confirming'] as const;
type Label = typeof LABELS[number];

const SUBLABELS: Record<Label, string> = {
  Sending: 'Routing through mesh',
  Refreshing: 'Fetching latest balance',
  Connecting: 'Finding nearby peers',
  Confirming: 'Waiting for confirmation',
};

export default function PigeonLoaderDevScreen() {
  const { colors, spacing } = useTheme();

  const [visible, setVisible] = useState(false);
  const [status, setStatus] = useState<PigeonLoaderStatus>('loading');
  const [labelIdx, setLabelIdx] = useState(0);
  const [withSublabel, setWithSublabel] = useState(false);
  const [withCancel, setWithCancel] = useState(false);

  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const clearTimers = useCallback(() => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  }, []);
  useEffect(() => clearTimers, [clearTimers]);

  const dismiss = useCallback(() => {
    clearTimers();
    setVisible(false);
    setStatus('loading');
  }, [clearTimers]);

  const playLoading = useCallback((ms: number) => {
    clearTimers();
    setStatus('loading');
    setVisible(true);
    timers.current.push(setTimeout(() => setVisible(false), ms));
  }, [clearTimers]);

  const playFullLifecycle = useCallback((loadingMs: number) => {
    clearTimers();
    setStatus('loading');
    setVisible(true);
    timers.current.push(setTimeout(() => setStatus('success'), loadingMs));
    timers.current.push(setTimeout(() => {
      setVisible(false);
      setStatus('loading');
    }, loadingMs + 1300));
  }, [clearTimers]);

  const label = LABELS[labelIdx];
  const sublabel = withSublabel ? SUBLABELS[label] : undefined;

  return (
    <View style={[S.container, { backgroundColor: colors.background }]}>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <View style={S.header}>
          <Pressable
            onPress={() => router.back()}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Back"
          >
            <Feather name="chevron-left" size={26} color={colors.textPrimary} />
          </Pressable>
          <Text style={[S.title, { color: colors.textPrimary, fontFamily: fontFamily.sansSb }]}>
            Pigeon Loader Preview
          </Text>
          <View style={{ width: 26 }} />
        </View>

        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ padding: spacing[5], gap: spacing[5] }}
        >
          <Section title="Full lifecycle (sending → sent → dismiss)">
            <RowButton label="Typical send (2.5s → success)" onPress={() => playFullLifecycle(2500)} colors={colors} />
            <RowButton label="Quick send (800ms → success)"   onPress={() => playFullLifecycle(800)}  colors={colors} />
            <RowButton label="Slow mesh send (6s → success)"  onPress={() => playFullLifecycle(6000)} colors={colors} />
          </Section>

          <Section title="Loading only (no success transition)">
            <RowButton label="Show 2.5s loading"    onPress={() => playLoading(2500)}    colors={colors} />
            <RowButton label="Show 300ms (flash)"   onPress={() => playLoading(300)}     colors={colors} />
            <RowButton label="Show until dismissed" onPress={() => { clearTimers(); setStatus('loading'); setVisible(true); }} colors={colors} />
            <RowButton label="Dismiss"              onPress={dismiss} colors={colors} />
          </Section>

          <Section title="Variants">
            <RowToggle label="Sublabel"        value={withSublabel} onChange={setWithSublabel} colors={colors} />
            <RowToggle label="Cancel button"   value={withCancel}   onChange={setWithCancel}   colors={colors} />
            <RowButton label={`Label — ${label}`} onPress={() => setLabelIdx((i) => (i + 1) % LABELS.length)} colors={colors} />
          </Section>

          <Section title="State (manual)">
            <RowButton label={`status: ${status}`} onPress={() => setStatus(s => s === 'loading' ? 'success' : 'loading')} colors={colors} />
          </Section>

          <Section title="Notes">
            <Text style={[S.note, { color: colors.textSecondary, fontFamily: fontFamily.sans }]}>
              {`Deep link: anonmesh://dev/pigeon-loader\n`}
              {`Asset: assets/animations/sending.webp (320×320 WebP, alpha, ~614KB)\n`}
              {`Renderer: expo-image · Mesh BG: react-native-svg + Reanimated`}
            </Text>
          </Section>
        </ScrollView>
      </SafeAreaView>

      <PigeonLoader
        visible={visible}
        status={status}
        label={label}
        sublabel={sublabel}
        onCancel={withCancel ? dismiss : undefined}
        testID="dev-pigeon-loader"
      />
    </View>
  );
}

function Section({ title, children }: { readonly title: string; readonly children: React.ReactNode }) {
  const { colors, spacing } = useTheme();
  return (
    <View style={{ gap: spacing[3] }}>
      <Text style={[S.section, { color: colors.textTertiary, fontFamily: fontFamily.sansMd }]}>
        {title.toUpperCase()}
      </Text>
      <View style={{ gap: spacing[2] }}>{children}</View>
    </View>
  );
}

function RowButton({
  label,
  onPress,
  colors,
}: {
  readonly label: string;
  readonly onPress: () => void;
  readonly colors: ReturnType<typeof useTheme>['colors'];
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        S.row,
        {
          backgroundColor: colors.surface1,
          borderColor: colors.borderSubtle,
          opacity: pressed ? 0.7 : 1,
        },
      ]}
      accessibilityRole="button"
    >
      <Text style={[S.rowLabel, { color: colors.textPrimary, fontFamily: fontFamily.sansMd }]}>
        {label}
      </Text>
      <Feather name="chevron-right" size={16} color={colors.textTertiary} />
    </Pressable>
  );
}

function RowToggle({
  label,
  value,
  onChange,
  colors,
}: {
  readonly label: string;
  readonly value: boolean;
  readonly onChange: (v: boolean) => void;
  readonly colors: ReturnType<typeof useTheme>['colors'];
}) {
  return (
    <View style={[S.row, { backgroundColor: colors.surface1, borderColor: colors.borderSubtle }]}>
      <Text style={[S.rowLabel, { color: colors.textPrimary, fontFamily: fontFamily.sansMd }]}>
        {label}
      </Text>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ false: colors.surface3, true: colors.primary + '80' }}
        thumbColor={value ? colors.primary : colors.textTertiary}
      />
    </View>
  );
}

const S = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  title: { fontSize: fontSize.lg, letterSpacing: 0.3 },
  section: { fontSize: fontSize.xs, letterSpacing: 1.2 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
  rowLabel: { fontSize: fontSize.md, flex: 1, marginRight: 12 },
  note: { fontSize: fontSize.sm, lineHeight: 20 },
});

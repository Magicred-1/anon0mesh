import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, Stack } from 'expo-router';
import { Feather } from '@expo/vector-icons';

import { PigeonLoader } from '@/components/ui/PigeonLoader';
import { fontFamily, fontSize, useTheme } from '@/theme';

const LABELS = ['Sending', 'Refreshing', 'Connecting', 'Confirming'] as const;
type Label = typeof LABELS[number];

const SUBLABELS: Record<Label, string> = {
  Sending: 'Routing through mesh network',
  Refreshing: 'Fetching latest balance',
  Connecting: 'Finding nearby peers',
  Confirming: 'Waiting for confirmation',
};

export default function PigeonLoaderDevScreen() {
  const { colors, spacing } = useTheme();

  const [visible, setVisible] = useState(false);
  const [labelIdx, setLabelIdx] = useState(0);
  const [withSublabel, setWithSublabel] = useState(true);
  const [withCancel, setWithCancel] = useState(false);

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);

  const playFor = useCallback((ms: number) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setVisible(true);
    timerRef.current = setTimeout(() => setVisible(false), ms);
  }, []);

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
          <Section title="Quick play">
            <RowButton
              label="Show for 2.5s (typical send)"
              onPress={() => playFor(2500)}
              colors={colors}
            />
            <RowButton
              label="Show for 300ms (instant)"
              onPress={() => playFor(300)}
              colors={colors}
            />
            <RowButton
              label="Show for 8s (slow / mesh)"
              onPress={() => playFor(8000)}
              colors={colors}
            />
            <RowButton
              label="Show forever (tap loader area to test cancel)"
              onPress={() => setVisible(true)}
              colors={colors}
            />
          </Section>

          <Section title="Variants">
            <RowToggle
              label="Show sublabel"
              value={withSublabel}
              onChange={setWithSublabel}
              colors={colors}
            />
            <RowToggle
              label="Show cancel button"
              value={withCancel}
              onChange={setWithCancel}
              colors={colors}
            />
            <RowButton
              label={`Cycle label — ${label}`}
              onPress={() => setLabelIdx((i) => (i + 1) % LABELS.length)}
              colors={colors}
            />
          </Section>

          <Section title="Notes">
            <Text style={[S.note, { color: colors.textSecondary, fontFamily: fontFamily.sans }]}>
              {`Deep link: anonmesh://dev/pigeon-loader\n`}
              {`Asset: assets/animations/sending.webp (240×240 WebP, ~350KB)\n`}
              {`Renderer: expo-image (no extra deps)`}
            </Text>
          </Section>
        </ScrollView>
      </SafeAreaView>

      <PigeonLoader
        visible={visible}
        label={label}
        sublabel={sublabel}
        onCancel={withCancel ? () => setVisible(false) : undefined}
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

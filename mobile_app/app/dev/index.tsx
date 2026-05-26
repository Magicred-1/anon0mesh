import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';

import { resetTutorial } from '@/src/services/tutorialState';
import { useTheme } from '@/theme';

/**
 * Dev menu — index of developer tools. Reachable only in development builds; the
 * app/dev/_layout guard redirects to the app shell in production. Lets us open
 * dev screens and reset first-run state to rehearse onboarding/tutorial flows
 * repeatedly without reinstalling the app.
 */
export default function DevIndexScreen() {
  const { colors } = useTheme();
  const [status, setStatus] = useState<string | null>(null);

  const handleResetTutorial = async () => {
    await resetTutorial();
    setStatus('Tutorial flag cleared — replay below or relaunch to see onboarding again.');
  };

  return (
    <ScrollView style={{ backgroundColor: colors.surface0 }} contentContainerStyle={S.content}>
      <Text style={[S.title, { color: colors.textPrimary }]}>Dev menu</Text>
      <Text style={[S.subtitle, { color: colors.textTertiary }]}>
        Development build only. Tools for rehearsing flows without reinstalling.
      </Text>

      <Text style={[S.section, { color: colors.textTertiary }]}>SCREENS</Text>
      <Row colors={colors} icon="image" label="Pigeon loader" onPress={() => router.push('/dev/pigeon-loader')} />

      <Text style={[S.section, { color: colors.textTertiary }]}>FIRST-RUN STATE</Text>
      <Row colors={colors} icon="rotate-ccw" label="Reset tutorial flag" onPress={handleResetTutorial} />
      <Row colors={colors} icon="play" label="Replay tutorial now" onPress={() => router.push('/tutorial')} />

      {status ? <Text style={[S.status, { color: colors.primary }]}>{status}</Text> : null}
    </ScrollView>
  );
}

function Row({ colors, icon, label, onPress }: {
  readonly colors: ReturnType<typeof useTheme>['colors'];
  readonly icon: keyof typeof Feather.glyphMap;
  readonly label: string;
  readonly onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={[S.row, { backgroundColor: colors.surface1, borderColor: colors.border }]}
    >
      <Feather name={icon} size={16} color={colors.primary} />
      <Text style={[S.rowLabel, { color: colors.textPrimary }]}>{label}</Text>
      <Feather name="chevron-right" size={16} color={colors.textTertiary} />
    </Pressable>
  );
}

const S = StyleSheet.create({
  content:  { padding: 20, paddingTop: 64, gap: 8 },
  title:    { fontSize: 24, fontWeight: '700' },
  subtitle: { fontSize: 13, marginBottom: 16 },
  section:  { fontSize: 11, fontWeight: '600', letterSpacing: 1, marginTop: 16, marginBottom: 4 },
  row:      { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 12, borderWidth: 0.5 },
  rowLabel: { flex: 1, fontSize: 15 },
  status:   { fontSize: 13, marginTop: 16, lineHeight: 18 },
});

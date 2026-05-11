import { Feather } from '@expo/vector-icons';
import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { AppBottomSheet } from '@/components/primitives';
import * as haptics from '@/src/design-system/haptics';
import { isQvacEnabled, type QvacProgress } from '@/src/services/qvac';
import { parseTransferIntent, type TransferIntent } from '@/src/services/qvac/intent';
import { fontFamily as FF, useTheme } from '@/theme';

type NlComposeSheetProps = {
  readonly visible: boolean;
  readonly onClose: () => void;
  readonly onIntent: (intent: TransferIntent) => void;
};

export function NlComposeSheet({ visible, onClose, onIntent }: NlComposeSheetProps) {
  const { colors } = useTheme();
  const enabled = isQvacEnabled();
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<QvacProgress | null>(null);

  async function handleSubmit() {
    const prompt = text.trim();
    if (!enabled || !prompt || busy) return;

    setBusy(true);
    setError(null);
    setProgress({ phase: 'load', percentage: null, message: 'Starting local QVAC model' });
    haptics.tap();

    try {
      const intent = await parseTransferIntent(prompt, setProgress);
      haptics.confirm();
      setText('');
      setProgress(null);
      onIntent(intent);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not parse that payment request.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <AppBottomSheet visible={visible} onClose={onClose}>
      <View style={S.header}>
        <View style={S.headerText}>
          <Text style={[S.kicker, { color: colors.textTertiary }]}>QVAC LOCAL AI</Text>
          <Text style={[S.title, { color: colors.textPrimary }]}>Compose transfer</Text>
        </View>
        <Pressable
          accessibilityLabel="Close AI compose"
          accessibilityRole="button"
          onPress={onClose}
          style={[S.iconButton, { backgroundColor: colors.surface1, borderColor: colors.border }]}
        >
          <Feather name="x" size={18} color={colors.textPrimary} />
        </Pressable>
      </View>

      <View style={[S.inputWrap, { backgroundColor: colors.surface0, borderColor: colors.border }]}>
        <TextInput
          autoCapitalize="sentences"
          multiline
          onChangeText={setText}
          placeholder="pay djason 0.05 SOL for coffee"
          placeholderTextColor={colors.textTertiary}
          selectionColor={colors.primary}
          style={[S.input, { color: colors.textPrimary }]}
          value={text}
        />
      </View>

      <View style={S.statusRow}>
        <Feather
          name={enabled ? 'cpu' : 'alert-circle'}
          size={14}
          color={enabled ? colors.primary : colors.error}
        />
        <Text style={[S.status, { color: error ? colors.error : colors.textSecondary }]}>
          {error ??
            progress?.message ??
            (enabled ? 'Parsed on-device. You still review before signing.' : 'QVAC is disabled for this build.')}
        </Text>
      </View>

      <Pressable
        accessibilityLabel="Parse payment request with QVAC"
        accessibilityRole="button"
        disabled={!enabled || !text.trim() || busy}
        onPress={handleSubmit}
        style={({ pressed }) => [
          S.button,
          {
            backgroundColor: enabled ? colors.primary : colors.surface2,
            opacity: pressed || busy || !text.trim() ? 0.68 : 1,
          },
        ]}
      >
        <Feather name="arrow-right" size={17} color="#001014" />
        <Text style={S.buttonText}>{busy ? 'Parsing locally...' : 'Review transfer'}</Text>
      </Pressable>
    </AppBottomSheet>
  );
}

const S = StyleSheet.create({
  button: {
    alignItems: 'center',
    borderRadius: 14,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    minHeight: 52,
    marginTop: 14,
  },
  buttonText: {
    color: '#001014',
    fontFamily: FF.sansSb,
    fontSize: 15,
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    marginBottom: 14,
  },
  headerText: {
    flex: 1,
  },
  iconButton: {
    alignItems: 'center',
    borderRadius: 18,
    borderWidth: 0.5,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  input: {
    fontFamily: FF.sans,
    fontSize: 16,
    lineHeight: 22,
    minHeight: 92,
    textAlignVertical: 'top',
  },
  inputWrap: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
  },
  kicker: {
    fontFamily: FF.sansMd,
    fontSize: 10,
    letterSpacing: 2,
  },
  status: {
    flex: 1,
    fontFamily: FF.sans,
    fontSize: 12,
    lineHeight: 17,
  },
  statusRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  title: {
    fontFamily: FF.sansBold,
    fontSize: 22,
  },
});

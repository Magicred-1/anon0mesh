import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { fontFamily, fontSize, useTheme } from '@/theme';

const PIGEON_SRC = require('@/assets/animations/sending.webp');

interface Props {
  readonly visible: boolean;
  readonly label?: string;
  readonly sublabel?: string;
  readonly onCancel?: () => void;
  readonly testID?: string;
}

export function PigeonLoader({
  visible,
  label = 'Sending',
  sublabel,
  onCancel,
  testID,
}: Props) {
  const { colors, spacing } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <Modal
      visible={visible}
      transparent
      statusBarTranslucent
      animationType="fade"
      onRequestClose={() => { if (onCancel) onCancel(); }}
      testID={testID}
    >
      <View
        style={[S.backdrop, { backgroundColor: colors.background }]}
        accessible
        accessibilityRole="alert"
        accessibilityLabel={sublabel ? `${label}. ${sublabel}` : label}
        accessibilityLiveRegion="polite"
      >
        <View style={S.content}>
          <Image
            source={PIGEON_SRC}
            style={S.pigeon}
            contentFit="contain"
            transition={0}
            recyclingKey="pigeon-sending"
          />
          <Text
            style={[
              S.label,
              { color: colors.textPrimary, fontFamily: fontFamily.sansMd },
            ]}
            numberOfLines={1}
          >
            {label}
          </Text>
          {sublabel ? (
            <Text
              style={[
                S.sublabel,
                { color: colors.textSecondary, fontFamily: fontFamily.sans },
              ]}
              numberOfLines={2}
            >
              {sublabel}
            </Text>
          ) : null}
        </View>

        {onCancel ? (
          <Pressable
            onPress={onCancel}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Cancel"
            style={({ pressed }) => [
              S.cancel,
              {
                bottom: insets.bottom + spacing[6],
                opacity: pressed ? 0.6 : 1,
              },
            ]}
          >
            <Text style={[S.cancelText, { color: colors.textSecondary, fontFamily: fontFamily.sansMd }]}>
              Cancel
            </Text>
          </Pressable>
        ) : null}
      </View>
    </Modal>
  );
}

const S = StyleSheet.create({
  backdrop: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  pigeon: {
    width: 220,
    height: 220,
  },
  label: {
    marginTop: 12,
    fontSize: fontSize.lg,
    letterSpacing: 0.3,
    textAlign: 'center',
  },
  sublabel: {
    marginTop: 6,
    fontSize: fontSize.sm,
    textAlign: 'center',
    maxWidth: 280,
  },
  cancel: {
    position: 'absolute',
    alignSelf: 'center',
    paddingVertical: 12,
    paddingHorizontal: 24,
  },
  cancelText: {
    fontSize: fontSize.md,
    letterSpacing: 0.4,
  },
});

import React, { useState } from 'react';
import {
  TextInput,
  View,
  Text,
  Pressable,
  StyleSheet,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';
import { useTheme } from '@/theme';

type Props = TextInputProps & {
  label?: string;
  hint?: string;
  error?: string;
  mono?: boolean;
  rightElement?: React.ReactNode;
};

export function Input({
  label,
  hint,
  error,
  mono = false,
  rightElement,
  style,
  ...rest
}: Props) {
  const { colors, radii, spacing, textVariants, fontFamily } = useTheme();
  const [focused, setFocused] = useState(false);

  const containerStyle: ViewStyle = {
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: error ? colors.error : focused ? colors.primary : colors.border,
    backgroundColor: colors.surface1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing[4],
    minHeight: 44,
  };

  return (
    <View style={{ gap: spacing[2] }}>
      {label && (
        <Text style={[textVariants.labelMd, { color: colors.textSecondary }]}>{label}</Text>
      )}
      <View style={containerStyle}>
        <TextInput
          style={[
            styles.input,
            mono ? textVariants.codeMd : textVariants.bodyMd,
            { color: colors.textPrimary, flex: 1, fontFamily: mono ? fontFamily.mono : undefined },
            style,
          ]}
          placeholderTextColor={colors.textDisabled}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          {...rest}
        />
        {rightElement}
      </View>
      {(error || hint) && (
        <Text
          style={[
            textVariants.labelSm,
            { color: error ? colors.error : colors.textTertiary },
          ]}
        >
          {error ?? hint}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  input: {
    paddingVertical: 10,
  },
});

/**
 * TextInput Component
 *
 * Styled text input with label and error support.
 */

import { View, TextInput as RNTextInput, Text, StyleSheet, TextInputProps as RNTextInputProps } from 'react-native';
import { colors, spacing, borderRadius, typography } from '../../theme';

interface TextInputProps extends Omit<RNTextInputProps, 'style'> {
  label?: string;
  error?: string;
  hint?: string;
}

export function TextInput({
  label,
  error,
  hint,
  ...props
}: TextInputProps) {
  return (
    <View style={styles.container}>
      {label && <Text style={styles.label}>{label}</Text>}
      <RNTextInput
        style={[
          styles.input,
          error && styles.inputError,
        ]}
        placeholderTextColor={colors.text.muted}
        {...props}
      />
      {error && <Text style={styles.error}>{error}</Text>}
      {hint && !error && <Text style={styles.hint}>{hint}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing.lg,
  },
  label: {
    ...typography.bodySmall,
    fontWeight: '600',
    marginBottom: spacing.sm,
  },
  input: {
    backgroundColor: colors.background.secondary,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: 14,
    fontSize: 16,
    color: colors.text.primary,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  inputError: {
    borderColor: colors.accent.danger,
  },
  error: {
    color: colors.accent.danger,
    fontSize: 14,
    marginTop: spacing.sm,
  },
  hint: {
    color: colors.text.secondary,
    fontSize: 14,
    marginTop: spacing.sm,
    lineHeight: 20,
  },
});

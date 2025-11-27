/**
 * Button Component
 *
 * Reusable button with variants for different actions.
 */

import { Pressable, Text, StyleSheet, ViewStyle, TextStyle, ActivityIndicator } from 'react-native';
import { colors, spacing, borderRadius, typography } from '../../theme';

export type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost';
export type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  disabled?: boolean;
  loading?: boolean;
  fullWidth?: boolean;
  style?: ViewStyle;
}

export function Button({
  title,
  onPress,
  variant = 'primary',
  size = 'md',
  disabled = false,
  loading = false,
  fullWidth = false,
  style,
}: ButtonProps) {
  const isDisabled = disabled || loading;

  return (
    <Pressable
      style={({ pressed }) => [
        styles.base,
        styles[variant],
        styles[`size_${size}`],
        fullWidth && styles.fullWidth,
        pressed && styles[`${variant}_pressed`],
        isDisabled && styles.disabled,
        style,
      ]}
      onPress={onPress}
      disabled={isDisabled}
    >
      {loading ? (
        <ActivityIndicator
          size="small"
          color={variant === 'primary' ? colors.text.inverse : colors.text.primary}
        />
      ) : (
        <Text
          style={[
            styles.text,
            styles[`text_${variant}`],
            styles[`text_size_${size}`],
            isDisabled && styles.text_disabled,
          ]}
        >
          {title}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: borderRadius.lg,
  },

  // Variants
  primary: {
    backgroundColor: colors.accent.primary,
  },
  primary_pressed: {
    backgroundColor: '#3bc96d',
  },
  secondary: {
    backgroundColor: colors.background.secondary,
  },
  secondary_pressed: {
    backgroundColor: colors.background.tertiary,
  },
  danger: {
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
  },
  danger_pressed: {
    backgroundColor: 'rgba(239, 68, 68, 0.3)',
  },
  ghost: {
    backgroundColor: 'transparent',
  },
  ghost_pressed: {
    backgroundColor: colors.background.secondary,
  },

  // Sizes
  size_sm: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  size_md: {
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
  },
  size_lg: {
    paddingHorizontal: spacing.xxl,
    paddingVertical: 18,
  },

  // Text variants
  text: {
    ...typography.button,
  },
  text_primary: {
    color: colors.text.inverse,
  },
  text_secondary: {
    color: colors.text.primary,
  },
  text_danger: {
    color: colors.accent.danger,
  },
  text_ghost: {
    color: colors.text.primary,
  },

  // Text sizes
  text_size_sm: {
    fontSize: 14,
  },
  text_size_md: {
    fontSize: 16,
  },
  text_size_lg: {
    fontSize: 18,
  },

  // States
  disabled: {
    backgroundColor: colors.background.tertiary,
    opacity: 0.6,
  },
  text_disabled: {
    color: colors.text.muted,
  },

  fullWidth: {
    width: '100%',
  },
});

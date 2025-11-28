/**
 * Badge Component
 *
 * Small status indicator with text.
 */

import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { colors, spacing, borderRadius } from '../../theme';

export type BadgeVariant = 'success' | 'warning' | 'error' | 'info' | 'neutral';

interface BadgeProps {
  text: string;
  variant?: BadgeVariant;
  style?: ViewStyle;
}

const variantColors: Record<BadgeVariant, { bg: string; text: string }> = {
  success: { bg: colors.accent.primary, text: colors.text.inverse },
  warning: { bg: colors.accent.warning, text: colors.text.inverse },
  error: { bg: colors.accent.danger, text: colors.text.primary },
  info: { bg: colors.accent.info, text: colors.text.primary },
  neutral: { bg: colors.background.tertiary, text: colors.text.secondary },
};

export function Badge({ text, variant = 'neutral', style }: BadgeProps) {
  const variantStyle = variantColors[variant];

  return (
    <View style={[styles.badge, { backgroundColor: variantStyle.bg }, style]}>
      <Text style={[styles.text, { color: variantStyle.text }]}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
  },
  text: {
    fontSize: 12,
    fontWeight: '600',
  },
});

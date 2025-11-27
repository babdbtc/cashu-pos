/**
 * Card Component
 *
 * Container for grouped content with consistent styling.
 * Supports optional glass effect for iOS 26+ Liquid Glass.
 */

import { View, StyleSheet, ViewStyle, StyleProp } from 'react-native';
import { colors, spacing, borderRadius } from '../../theme';
import { GlassCard } from './GlassView';

interface CardProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  padded?: boolean;
  /** Use glass/blur effect (iOS 26+ uses Liquid Glass, older iOS uses blur, others use fallback) */
  glass?: boolean;
}

export function Card({ children, style, padded = true, glass = false }: CardProps) {
  if (glass) {
    return (
      <GlassCard
        style={[styles.card, style]}
        padded={padded}
        rounded={borderRadius.md}
      >
        {children}
      </GlassCard>
    );
  }

  return (
    <View style={[styles.card, padded && styles.padded, style]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.background.secondary,
    borderRadius: borderRadius.md,
  },
  padded: {
    padding: spacing.lg,
  },
});

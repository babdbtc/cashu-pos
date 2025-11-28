/**
 * LoadingSpinner Component
 *
 * Centered loading indicator.
 */

import { View, ActivityIndicator, Text, StyleSheet, ViewStyle } from 'react-native';
import { colors, spacing, typography } from '../../theme';

interface LoadingSpinnerProps {
  message?: string;
  size?: 'small' | 'large';
  style?: ViewStyle;
}

export function LoadingSpinner({ message, size = 'large', style }: LoadingSpinnerProps) {
  return (
    <View style={[styles.container, style]}>
      <ActivityIndicator size={size} color={colors.accent.primary} />
      {message && <Text style={styles.message}>{message}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  message: {
    ...typography.body,
    color: colors.text.secondary,
    marginTop: spacing.lg,
  },
});

/**
 * StatusDot Component
 *
 * Small colored dot for status indication.
 */

import { View, StyleSheet, ViewStyle } from 'react-native';
import { colors } from '../../theme';

export type StatusDotVariant = 'success' | 'error' | 'warning' | 'info' | 'offline';

interface StatusDotProps {
  variant: StatusDotVariant;
  size?: number;
  style?: ViewStyle;
  pulsing?: boolean;
}

const dotColors: Record<StatusDotVariant, string> = {
  success: colors.status.success,
  error: colors.status.error,
  warning: colors.status.warning,
  info: colors.status.info,
  offline: colors.status.offline,
};

export function StatusDot({ variant, size = 10, style, pulsing = false }: StatusDotProps) {
  return (
    <View
      style={[
        styles.dot,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: dotColors[variant],
        },
        pulsing && styles.pulsing,
        style,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  dot: {},
  pulsing: {
    // Note: For actual pulsing animation, wrap with Animated.View
    shadowColor: '#4ade80',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 4,
    elevation: 4,
  },
});

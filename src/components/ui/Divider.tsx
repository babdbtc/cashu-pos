/**
 * Divider Component
 *
 * Horizontal line separator.
 */

import { View, StyleSheet, ViewStyle } from 'react-native';
import { colors, spacing } from '../../theme';

interface DividerProps {
  style?: ViewStyle;
}

export function Divider({ style }: DividerProps) {
  return <View style={[styles.divider, style]} />;
}

const styles = StyleSheet.create({
  divider: {
    height: 1,
    backgroundColor: colors.border.default,
    marginVertical: spacing.lg,
  },
});

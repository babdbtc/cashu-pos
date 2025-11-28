/**
 * Section Component
 *
 * Grouped content section with optional title.
 */

import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { colors, spacing, typography } from '../../theme';

interface SectionProps {
  title?: string;
  children: React.ReactNode;
  style?: ViewStyle;
}

export function Section({ title, children, style }: SectionProps) {
  return (
    <View style={[styles.section, style]}>
      {title && <Text style={styles.title}>{title}</Text>}
      <View style={styles.content}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    marginBottom: spacing.xxxl,
  },
  title: {
    ...typography.label,
    paddingHorizontal: spacing.xl,
    marginBottom: spacing.md,
  },
  content: {},
});

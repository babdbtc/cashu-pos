/**
 * Header Component
 *
 * Screen header with optional back button and actions.
 */

import { View, Text, Pressable, StyleSheet, ViewStyle } from 'react-native';
import { useRouter } from 'expo-router';
import { colors, spacing, typography } from '../../theme';

interface HeaderProps {
  title?: string;
  showBack?: boolean;
  backLabel?: string;
  rightElement?: React.ReactNode;
  style?: ViewStyle;
}

export function Header({
  title,
  showBack = false,
  backLabel = 'Back',
  rightElement,
  style,
}: HeaderProps) {
  const router = useRouter();

  return (
    <View style={[styles.header, style]}>
      <View style={styles.left}>
        {showBack && (
          <Pressable style={styles.backButton} onPress={() => router.back()}>
            <Text style={styles.backText}>‹ {backLabel}</Text>
          </Pressable>
        )}
      </View>

      {title && <Text style={styles.title}>{title}</Text>}

      <View style={styles.right}>{rightElement}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.default,
  },
  left: {
    flex: 1,
    alignItems: 'flex-start',
  },
  right: {
    flex: 1,
    alignItems: 'flex-end',
  },
  title: {
    ...typography.h4,
    flex: 2,
    textAlign: 'center',
  },
  backButton: {
    paddingVertical: spacing.sm,
    paddingRight: spacing.md,
  },
  backText: {
    fontSize: 16,
    color: colors.accent.primary,
  },
});

/**
 * SettingsRow Component
 *
 * Navigation row for settings screens.
 */

import { View, Text, Pressable, StyleSheet, ViewStyle } from 'react-native';
import { Link } from 'expo-router';
import { colors, spacing } from '../../theme';

interface SettingsRowProps {
  title: string;
  description?: string;
  value?: string;
  href?: string;
  onPress?: () => void;
  showArrow?: boolean;
  style?: ViewStyle;
}

export function SettingsRow({
  title,
  description,
  value,
  href,
  onPress,
  showArrow = true,
  style,
}: SettingsRowProps) {
  const content = (
    <View style={[styles.row, style]}>
      <View style={styles.content}>
        <Text style={styles.title}>{title}</Text>
        {description && <Text style={styles.description}>{description}</Text>}
      </View>
      <View style={styles.right}>
        {value && <Text style={styles.value}>{value}</Text>}
        {showArrow && <Text style={styles.arrow}>›</Text>}
      </View>
    </View>
  );

  if (href) {
    return (
      <Link href={href as any} asChild>
        <Pressable>{content}</Pressable>
      </Link>
    );
  }

  if (onPress) {
    return <Pressable onPress={onPress}>{content}</Pressable>;
  }

  return content;
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background.secondary,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.default,
  },
  content: {
    flex: 1,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text.primary,
    marginBottom: 4,
  },
  description: {
    fontSize: 14,
    color: colors.text.secondary,
  },
  right: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  value: {
    fontSize: 14,
    color: colors.text.secondary,
    marginRight: spacing.sm,
  },
  arrow: {
    fontSize: 20,
    color: colors.text.muted,
  },
});

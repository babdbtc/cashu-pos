/**
 * ListItem Component
 *
 * Generic list item with flexible content areas.
 */

import { View, Text, Pressable, StyleSheet, ViewStyle } from 'react-native';
import { colors, spacing, borderRadius } from '../../theme';
import { StatusDot, StatusDotVariant } from '../ui/StatusDot';

interface ListItemProps {
  title: string;
  subtitle?: string;
  leftElement?: React.ReactNode;
  rightElement?: React.ReactNode;
  status?: StatusDotVariant;
  onPress?: () => void;
  onLongPress?: () => void;
  style?: ViewStyle;
}

export function ListItem({
  title,
  subtitle,
  leftElement,
  rightElement,
  status,
  onPress,
  onLongPress,
  style,
}: ListItemProps) {
  const content = (
    <View style={[styles.container, style]}>
      {status && (
        <StatusDot variant={status} style={styles.statusDot} />
      )}
      {leftElement && <View style={styles.left}>{leftElement}</View>}
      <View style={styles.content}>
        <Text style={styles.title}>{title}</Text>
        {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
      </View>
      {rightElement && <View style={styles.right}>{rightElement}</View>}
    </View>
  );

  if (onPress || onLongPress) {
    return (
      <Pressable
        onPress={onPress}
        onLongPress={onLongPress}
        style={({ pressed }) => [pressed && styles.pressed]}
      >
        {content}
      </Pressable>
    );
  }

  return content;
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background.secondary,
    padding: spacing.lg,
    borderRadius: borderRadius.md,
  },
  pressed: {
    opacity: 0.8,
  },
  statusDot: {
    marginRight: spacing.md,
  },
  left: {
    marginRight: spacing.md,
  },
  content: {
    flex: 1,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text.primary,
  },
  subtitle: {
    fontSize: 14,
    color: colors.text.secondary,
    marginTop: 2,
  },
  right: {
    marginLeft: spacing.md,
  },
});

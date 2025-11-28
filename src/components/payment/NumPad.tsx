/**
 * NumPad Component
 *
 * A numeric keypad for entering payment amounts.
 */

import { View, Text, Pressable, StyleSheet } from 'react-native';
import { colors, spacing, typography, borderRadius } from '@/theme';

interface NumPadProps {
  onKeyPress: (key: string) => void;
  disabled?: boolean;
}

const keys = [
  ['1', '2', '3'],
  ['4', '5', '6'],
  ['7', '8', '9'],
  ['clear', '0', 'backspace'],
];

export function NumPad({ onKeyPress, disabled = false }: NumPadProps) {
  const renderKey = (key: string) => {
    const isSpecial = key === 'clear' || key === 'backspace';
    const displayText =
      key === 'clear' ? 'C' : key === 'backspace' ? '⌫' : key;

    return (
      <Pressable
        key={key}
        style={({ pressed }) => [
          styles.key,
          isSpecial && styles.specialKey,
          pressed && styles.keyPressed,
          disabled && styles.keyDisabled,
        ]}
        onPress={() => !disabled && onKeyPress(key)}
        disabled={disabled}
      >
        <Text
          style={[
            styles.keyText,
            isSpecial && styles.specialKeyText,
            disabled && styles.keyTextDisabled,
          ]}
        >
          {displayText}
        </Text>
      </Pressable>
    );
  };

  return (
    <View style={styles.container}>
      {keys.map((row, rowIndex) => (
        <View key={rowIndex} style={styles.row}>
          {row.map(renderKey)}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.md,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.md,
  },
  key: {
    width: 80,
    height: 64,
    backgroundColor: colors.background.secondary,
    borderRadius: borderRadius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  specialKey: {
    backgroundColor: colors.background.tertiary,
  },
  keyPressed: {
    backgroundColor: colors.background.tertiary,
    transform: [{ scale: 0.96 }],
  },
  keyDisabled: {
    opacity: 0.5,
  },
  keyText: {
    fontSize: 28,
    fontWeight: '600',
    color: colors.text.primary,
  },
  specialKeyText: {
    fontSize: 22,
    color: colors.text.secondary,
  },
  keyTextDisabled: {
    color: colors.text.muted,
  },
});

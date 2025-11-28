/**
 * OverpaymentDialog
 *
 * Dialog for handling overpayment scenarios with options to return change or add as tip.
 */

import { View, Text, StyleSheet, Modal, Pressable } from 'react-native';
import { Button } from '@/components/ui';
import { colors, spacing, typography, borderRadius } from '@/theme';
import { getCurrencySymbol } from '@/constants/currencies';

interface OverpaymentDialogProps {
  visible: boolean;
  overpaymentSats: number;
  requiredSats: number;
  receivedSats: number;
  fiatCurrency: string;
  exchangeRate: number;
  onReturnChange: () => void;
  onAddAsTip: () => void;
  onDismiss: () => void;
}

export function OverpaymentDialog({
  visible,
  overpaymentSats,
  requiredSats,
  receivedSats,
  fiatCurrency,
  exchangeRate,
  onReturnChange,
  onAddAsTip,
  onDismiss,
}: OverpaymentDialogProps) {
  // Calculate fiat equivalent of overpayment
  const overpaymentFiat = (overpaymentSats / 100000000) * exchangeRate;
  const overpaymentPercent = ((overpaymentSats / requiredSats) * 100).toFixed(1);
  const currencySymbol = getCurrencySymbol(fiatCurrency);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onDismiss}
    >
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={onDismiss} />

        <View style={styles.dialog}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.iconCircle}>
              <Text style={styles.iconText}>💰</Text>
            </View>
            <Text style={styles.title}>Payment Complete!</Text>
            <Text style={styles.subtitle}>Extra amount received</Text>
          </View>

          {/* Amount Breakdown */}
          <View style={styles.amountSection}>
            <View style={styles.amountRow}>
              <Text style={styles.amountLabel}>Paid:</Text>
              <Text style={styles.amountValue}>{receivedSats.toLocaleString()} sats</Text>
            </View>
            <View style={styles.amountRow}>
              <Text style={styles.amountLabel}>Required:</Text>
              <Text style={styles.amountValue}>{requiredSats.toLocaleString()} sats</Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.amountRow}>
              <Text style={styles.changeLabel}>Change:</Text>
              <View style={styles.changeValueContainer}>
                <Text style={styles.changeValue}>
                  {overpaymentSats.toLocaleString()} sats
                </Text>
                <Text style={styles.changeFiat}>
                  ≈ {currencySymbol}{overpaymentFiat.toFixed(2)}
                </Text>
              </View>
            </View>
            <View style={styles.percentBadge}>
              <Text style={styles.percentText}>+{overpaymentPercent}%</Text>
            </View>
          </View>

          {/* Question */}
          <Text style={styles.question}>How would you like to handle the change?</Text>

          {/* Options */}
          <View style={styles.options}>
            {/* Return Change Option */}
            <Pressable
              style={({ pressed }) => [
                styles.option,
                pressed && styles.optionPressed,
              ]}
              onPress={onReturnChange}
            >
              <View style={styles.optionContent}>
                <View style={styles.optionIcon}>
                  <Text style={styles.optionIconText}>📤</Text>
                </View>
                <View style={styles.optionText}>
                  <Text style={styles.optionTitle}>Return to Customer</Text>
                  <Text style={styles.optionDescription}>
                    Generate Cashu token QR code
                  </Text>
                </View>
                <Text style={styles.optionArrow}>›</Text>
              </View>
            </Pressable>

            {/* Add as Tip Option */}
            <Pressable
              style={({ pressed }) => [
                styles.option,
                pressed && styles.optionPressed,
              ]}
              onPress={onAddAsTip}
            >
              <View style={styles.optionContent}>
                <View style={styles.optionIcon}>
                  <Text style={styles.optionIconText}>✨</Text>
                </View>
                <View style={styles.optionText}>
                  <Text style={styles.optionTitle}>Add as Tip</Text>
                  <Text style={styles.optionDescription}>
                    Keep extra sats as gratuity
                  </Text>
                </View>
                <Text style={styles.optionArrow}>›</Text>
              </View>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
  },
  dialog: {
    width: '90%',
    maxWidth: 400,
    backgroundColor: colors.background.primary,
    borderRadius: borderRadius.xl,
    padding: spacing.xl,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 20 },
        shadowOpacity: 0.25,
        shadowRadius: 25,
      },
      android: {
        elevation: 20,
      },
    }),
  },
  header: {
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  iconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.accent.success + '20',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  iconText: {
    fontSize: 30,
  },
  title: {
    ...typography.h2,
    marginBottom: spacing.xs,
  },
  subtitle: {
    ...typography.body,
    color: colors.text.secondary,
  },
  amountSection: {
    backgroundColor: colors.background.secondary,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  amountRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  amountLabel: {
    ...typography.bodySmall,
    color: colors.text.muted,
  },
  amountValue: {
    ...typography.bodySmall,
    fontWeight: '600',
    color: colors.text.primary,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border.default,
    marginVertical: spacing.sm,
  },
  changeLabel: {
    ...typography.button,
    color: colors.accent.success,
  },
  changeValueContainer: {
    alignItems: 'flex-end',
  },
  changeValue: {
    ...typography.button,
    color: colors.accent.success,
    fontWeight: '700',
  },
  changeFiat: {
    ...typography.caption,
    color: colors.text.muted,
    marginTop: spacing.xs,
  },
  percentBadge: {
    alignSelf: 'center',
    backgroundColor: colors.accent.success + '20',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.round,
    marginTop: spacing.sm,
  },
  percentText: {
    ...typography.caption,
    color: colors.accent.success,
    fontWeight: '700',
  },
  question: {
    ...typography.body,
    textAlign: 'center',
    marginBottom: spacing.lg,
    color: colors.text.primary,
  },
  options: {
    gap: spacing.md,
  },
  option: {
    backgroundColor: colors.background.secondary,
    borderRadius: borderRadius.md,
    borderWidth: 2,
    borderColor: colors.border.default,
    overflow: 'hidden',
  },
  optionPressed: {
    backgroundColor: colors.background.tertiary,
    borderColor: colors.accent.primary,
  },
  optionContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
  },
  optionIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.background.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  optionIconText: {
    fontSize: 20,
  },
  optionText: {
    flex: 1,
  },
  optionTitle: {
    ...typography.button,
    marginBottom: spacing.xs / 2,
  },
  optionDescription: {
    ...typography.caption,
    color: colors.text.muted,
  },
  optionArrow: {
    fontSize: 24,
    color: colors.text.muted,
  },
});

// Platform import for shadows
import { Platform } from 'react-native';

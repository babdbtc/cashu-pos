/**
 * PaymentErrorModal
 *
 * Modal for displaying payment errors with contextual messages and recovery actions.
 */

import { View, Text, StyleSheet, Modal, Pressable, ScrollView } from 'react-native';
import { useState } from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import { Button } from '@/components/ui';
import {
  PaymentErrorDetails,
  PaymentErrorRecovery,
  formatErrorMessage,
  getPrimaryRecovery,
  getRecoveryActionLabel,
} from '@/types/payment-error';
import { colors, spacing, typography, borderRadius } from '@/theme';

interface PaymentErrorModalProps {
  error: PaymentErrorDetails | null;
  visible: boolean;
  onRecoveryAction: (action: PaymentErrorRecovery) => void;
  onDismiss: () => void;
}

export function PaymentErrorModal({
  error,
  visible,
  onRecoveryAction,
  onDismiss,
}: PaymentErrorModalProps) {
  const [showTechnical, setShowTechnical] = useState(false);

  if (!error) return null;

  const primaryAction = getPrimaryRecovery(error);
  const secondaryAction = error.recovery[1];
  const formattedMessage = formatErrorMessage(error);

  // Get icon color based on severity
  const iconColors = getIconColors(error.severity);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onDismiss}
    >
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={onDismiss} />

        <View style={styles.modal}>
          <ScrollView
            style={styles.scrollContent}
            contentContainerStyle={styles.contentContainer}
            showsVerticalScrollIndicator={false}
          >
            {/* Error Icon */}
            <View style={styles.iconContainer}>
              <LinearGradient
                colors={iconColors}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.iconCircle}
              >
                <Text style={styles.iconText}>{getIconEmoji(error.icon)}</Text>
              </LinearGradient>
            </View>

            {/* Error Title */}
            <Text style={styles.title}>{error.title}</Text>

            {/* Error Message */}
            <Text style={styles.message}>{formattedMessage}</Text>

            {/* Amount difference (if applicable) */}
            {error.code === 'insufficient_amount' && error.metadata && (
              <View style={styles.amountDiff}>
                <View style={styles.amountRow}>
                  <Text style={styles.amountLabel}>Received:</Text>
                  <Text style={styles.amountValue}>
                    {error.metadata.receivedSats} sats
                  </Text>
                </View>
                <View style={styles.amountRow}>
                  <Text style={styles.amountLabel}>Required:</Text>
                  <Text style={styles.amountValueRequired}>
                    {error.metadata.requiredSats} sats
                  </Text>
                </View>
                <View style={styles.divider} />
                <View style={styles.amountRow}>
                  <Text style={styles.amountLabel}>Short by:</Text>
                  <Text style={styles.amountValueShort}>
                    {error.metadata.requiredSats - error.metadata.receivedSats} sats
                  </Text>
                </View>
              </View>
            )}

            {/* Rate change info (if applicable) */}
            {error.code === 'exchange_rate_changed' && error.metadata && (
              <View style={styles.rateChange}>
                <View style={styles.rateRow}>
                  <Text style={styles.rateLabel}>Locked rate:</Text>
                  <Text style={styles.rateValue}>
                    {error.metadata.oldAmount} sats
                  </Text>
                </View>
                <View style={styles.rateRow}>
                  <Text style={styles.rateLabel}>Current rate:</Text>
                  <Text style={styles.rateValue}>
                    {error.metadata.newAmount} sats
                  </Text>
                </View>
                <View style={styles.rateChangeIndicator}>
                  <Text style={styles.rateChangeText}>
                    {error.metadata.changePercent > 0 ? '↑' : '↓'}{' '}
                    {Math.abs(error.metadata.changePercent).toFixed(1)}%
                  </Text>
                </View>
              </View>
            )}

            {/* Technical Details (Collapsible) */}
            {error.technical && (
              <View style={styles.technicalContainer}>
                <Pressable
                  style={styles.technicalToggle}
                  onPress={() => setShowTechnical(!showTechnical)}
                >
                  <Text style={styles.technicalToggleText}>
                    {showTechnical ? '▼' : '▶'} Technical Details
                  </Text>
                </Pressable>
                {showTechnical && (
                  <View style={styles.technicalContent}>
                    <Text style={styles.technicalText}>{error.technical}</Text>
                  </View>
                )}
              </View>
            )}

            {/* Action Buttons */}
            <View style={styles.actions}>
              {/* Primary Action */}
              <Button
                title={getRecoveryActionLabel(primaryAction)}
                onPress={() => onRecoveryAction(primaryAction)}
                variant="primary"
                size="lg"
                fullWidth
              />

              {/* Secondary Action */}
              {secondaryAction && (
                <Button
                  title={getRecoveryActionLabel(secondaryAction)}
                  onPress={() => onRecoveryAction(secondaryAction)}
                  variant="secondary"
                  size="md"
                  fullWidth
                />
              )}

              {/* Cancel Button (if no secondary action) */}
              {!secondaryAction && (
                <Button
                  title="Cancel"
                  onPress={onDismiss}
                  variant="ghost"
                  size="md"
                  fullWidth
                />
              )}
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function getIconColors(severity: 'error' | 'warning' | 'info'): readonly [string, string] {
  switch (severity) {
    case 'error':
      return ['#EF4444', '#F87171'] as const;
    case 'warning':
      return ['#F59E0B', '#FBBF24'] as const;
    case 'info':
      return [colors.accent.primary, '#60A5FA'] as const;
    default:
      return ['#EF4444', '#F87171'] as const;
  }
}

function getIconEmoji(icon: string): string {
  const iconMap: Record<string, string> = {
    'nfc-off': '📵',
    'device': '📱',
    'nfc-error': '⚠️',
    'alert': '⚠️',
    'link-off': '🔗',
    'currency': '💰',
    'check-circle': '✓',
    'wifi-off': '📡',
    'server': '🖥️',
    'refresh': '🔄',
    'trending': '📈',
    'sync': '🔄',
  };
  return iconMap[icon] || '⚠️';
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
  modal: {
    width: '90%',
    maxWidth: 400,
    maxHeight: '80%',
    backgroundColor: colors.background.primary,
    borderRadius: borderRadius.xl,
    overflow: 'hidden',
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
  scrollContent: {
    flex: 1,
  },
  contentContainer: {
    padding: spacing.xl,
    alignItems: 'center',
  },
  iconContainer: {
    marginBottom: spacing.lg,
  },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconText: {
    fontSize: 40,
  },
  title: {
    ...typography.h2,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  message: {
    ...typography.body,
    color: colors.text.secondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: spacing.lg,
  },
  amountDiff: {
    width: '100%',
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
  amountValueRequired: {
    ...typography.bodySmall,
    fontWeight: '600',
    color: colors.accent.warning,
  },
  amountValueShort: {
    ...typography.bodySmall,
    fontWeight: '600',
    color: colors.accent.danger,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border.default,
    marginVertical: spacing.sm,
  },
  rateChange: {
    width: '100%',
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.3)',
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  rateRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  rateLabel: {
    ...typography.bodySmall,
    color: colors.text.secondary,
  },
  rateValue: {
    ...typography.bodySmall,
    fontWeight: '600',
    color: colors.text.primary,
  },
  rateChangeIndicator: {
    marginTop: spacing.sm,
    alignItems: 'center',
  },
  rateChangeText: {
    ...typography.button,
    color: '#F59E0B',
  },
  technicalContainer: {
    width: '100%',
    marginBottom: spacing.lg,
  },
  technicalToggle: {
    paddingVertical: spacing.sm,
  },
  technicalToggleText: {
    ...typography.caption,
    color: colors.accent.primary,
    fontWeight: '600',
  },
  technicalContent: {
    backgroundColor: colors.background.secondary,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginTop: spacing.sm,
  },
  technicalText: {
    ...typography.caption,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    color: colors.text.muted,
  },
  actions: {
    width: '100%',
    gap: spacing.md,
  },
});

// Platform import for shadows
import { Platform } from 'react-native';

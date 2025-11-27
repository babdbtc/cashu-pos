/**
 * Result Screen
 *
 * Shows payment success or failure with receipt option.
 */

import { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Easing } from 'react-native';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { Screen } from '@/components/layout';
import { Button } from '@/components/ui';
import { colors, spacing, typography, borderRadius } from '@/theme';
import { usePaymentStore } from '@/store/payment.store';

export default function ResultScreen() {
  const router = useRouter();
  const { currentPayment, clearCurrentPayment } = usePaymentStore();

  const scaleAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  const isSuccess = currentPayment?.state === 'completed';

  // Redirect if no payment (must be in useEffect, not during render)
  useEffect(() => {
    if (!currentPayment) {
      router.replace('/');
    }
  }, [currentPayment, router]);

  useEffect(() => {
    if (!currentPayment) return;

    // Play haptic feedback
    if (isSuccess) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }

    // Animate success/failure icon
    Animated.parallel([
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 5,
        tension: 100,
        useNativeDriver: true,
      }),
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 400,
        delay: 200,
        useNativeDriver: true,
      }),
    ]).start();

    // Auto-return to home after success
    if (isSuccess) {
      const timer = setTimeout(() => {
        handleDone();
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [currentPayment, isSuccess]);

  const handleDone = () => {
    clearCurrentPayment();
    router.replace('/');
  };

  const handleRetry = () => {
    clearCurrentPayment();
    router.replace('/amount');
  };

  const handlePrintReceipt = () => {
    // TODO: Implement receipt printing
    console.log('Print receipt');
  };

  // Show nothing while redirecting
  if (!currentPayment) {
    return null;
  }

  const { satsAmount, fiatAmount, fiatCurrency, transactionId, error } =
    currentPayment;

  return (
    <Screen style={styles.screen}>
      {/* Result Icon */}
      <View style={styles.iconContainer}>
        <Animated.View
          style={[
            styles.iconCircle,
            isSuccess ? styles.successCircle : styles.errorCircle,
            { transform: [{ scale: scaleAnim }] },
          ]}
        >
          <Text style={styles.icon}>{isSuccess ? '✓' : '✕'}</Text>
        </Animated.View>
      </View>

      {/* Result Message */}
      <Animated.View style={[styles.messageContainer, { opacity: fadeAnim }]}>
        <Text style={[styles.title, isSuccess ? styles.successText : styles.errorText]}>
          {isSuccess ? 'Payment Complete' : 'Payment Failed'}
        </Text>

        {isSuccess ? (
          <>
            <Text style={styles.amount}>
              ${fiatAmount.toFixed(2)} {fiatCurrency}
            </Text>
            <Text style={styles.satsAmount}>
              {satsAmount.toLocaleString()} sats
            </Text>

            {transactionId && (
              <View style={styles.txInfo}>
                <Text style={styles.txLabel}>Transaction ID</Text>
                <Text style={styles.txId}>{transactionId}</Text>
              </View>
            )}
          </>
        ) : (
          <Text style={styles.errorMessage}>
            {error || 'The payment could not be processed. Please try again.'}
          </Text>
        )}
      </Animated.View>

      {/* Auto-return countdown for success */}
      {isSuccess && (
        <Text style={styles.countdown}>Returning to home in 5 seconds...</Text>
      )}

      {/* Actions */}
      <View style={styles.actions}>
        {isSuccess ? (
          <>
            <Button
              title="Print Receipt"
              onPress={handlePrintReceipt}
              variant="secondary"
              size="lg"
              fullWidth
            />
            <Button
              title="Done"
              onPress={handleDone}
              variant="primary"
              size="lg"
              fullWidth
            />
          </>
        ) : (
          <>
            <Button
              title="Try Again"
              onPress={handleRetry}
              variant="primary"
              size="lg"
              fullWidth
            />
            <Button
              title="Cancel"
              onPress={handleDone}
              variant="ghost"
              size="lg"
              fullWidth
            />
          </>
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    padding: spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconContainer: {
    marginBottom: spacing.xxxl,
  },
  iconCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    alignItems: 'center',
    justifyContent: 'center',
  },
  successCircle: {
    backgroundColor: colors.accent.primary,
  },
  errorCircle: {
    backgroundColor: colors.accent.danger,
  },
  icon: {
    fontSize: 56,
    fontWeight: '700',
    color: colors.text.inverse,
  },
  messageContainer: {
    alignItems: 'center',
    marginBottom: spacing.xxl,
  },
  title: {
    ...typography.h2,
    marginBottom: spacing.lg,
  },
  successText: {
    color: colors.accent.primary,
  },
  errorText: {
    color: colors.accent.danger,
  },
  amount: {
    ...typography.amountMedium,
    marginBottom: spacing.xs,
  },
  satsAmount: {
    ...typography.bodyLarge,
    color: colors.text.secondary,
    marginBottom: spacing.xxl,
  },
  txInfo: {
    alignItems: 'center',
    backgroundColor: colors.background.secondary,
    padding: spacing.lg,
    borderRadius: borderRadius.lg,
    width: '100%',
  },
  txLabel: {
    ...typography.label,
    marginBottom: spacing.xs,
  },
  txId: {
    ...typography.mono,
    fontSize: 12,
  },
  errorMessage: {
    ...typography.body,
    color: colors.text.secondary,
    textAlign: 'center',
    maxWidth: 280,
  },
  countdown: {
    ...typography.bodySmall,
    color: colors.text.muted,
    marginBottom: spacing.xxl,
  },
  actions: {
    width: '100%',
    gap: spacing.md,
    marginTop: 'auto',
  },
});

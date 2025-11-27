/**
 * Amount Entry Screen
 *
 * Allows merchant to enter payment amount using a numpad.
 */

import { useState, useCallback } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { Screen } from '@/components/layout';
import { Button } from '@/components/ui';
import { NumPad } from '@/components/payment/NumPad';
import { colors, spacing, typography, borderRadius } from '@/theme';
import { usePaymentStore } from '@/store/payment.store';
import { useConfigStore } from '@/store/config.store';

export default function AmountScreen() {
  const router = useRouter();
  const { createPayment } = usePaymentStore();
  const { currency } = useConfigStore();

  // Amount in cents (or smallest currency unit)
  const [amountCents, setAmountCents] = useState(0);

  // For demo purposes, using a fixed exchange rate
  // In production, this would come from exchange-rate.service
  const exchangeRate = 100000; // sats per USD (example: $1 = 100,000 sats)

  const displayAmount = (amountCents / 100).toFixed(2);
  const satsAmount = Math.round((amountCents / 100) * exchangeRate);

  const handleKeyPress = useCallback((key: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    if (key === 'backspace') {
      setAmountCents((prev) => Math.floor(prev / 10));
    } else if (key === 'clear') {
      setAmountCents(0);
    } else {
      // Limit to reasonable amount (e.g., $99,999.99)
      const newAmount = amountCents * 10 + parseInt(key, 10);
      if (newAmount <= 9999999) {
        setAmountCents(newAmount);
      }
    }
  }, [amountCents]);

  const handleContinue = () => {
    if (satsAmount <= 0) return;

    // Create payment in store
    createPayment({
      satsAmount,
      fiatAmount: amountCents / 100,
      fiatCurrency: currency.displayCurrency,
      exchangeRate,
    });

    router.push('/payment');
  };

  const handleCancel = () => {
    router.back();
  };

  return (
    <Screen style={styles.screen}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={handleCancel} style={styles.cancelButton}>
          <Text style={styles.cancelText}>Cancel</Text>
        </Pressable>
        <Text style={styles.headerTitle}>Enter Amount</Text>
        <View style={styles.cancelButton} />
      </View>

      {/* Amount Display */}
      <View style={styles.amountContainer}>
        <View style={styles.amountDisplay}>
          <Text style={styles.currencySymbol}>$</Text>
          <Text style={styles.amount}>{displayAmount}</Text>
        </View>

        {satsAmount > 0 && (
          <Text style={styles.satsAmount}>
            {satsAmount.toLocaleString()} sats
          </Text>
        )}
      </View>

      {/* NumPad */}
      <View style={styles.numpadContainer}>
        <NumPad onKeyPress={handleKeyPress} />
      </View>

      {/* Continue Button */}
      <View style={styles.footer}>
        <Button
          title="Continue"
          onPress={handleContinue}
          variant="primary"
          size="lg"
          fullWidth
          disabled={satsAmount <= 0}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    padding: spacing.xl,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xxl,
  },
  cancelButton: {
    width: 60,
  },
  cancelText: {
    ...typography.body,
    color: colors.text.secondary,
  },
  headerTitle: {
    ...typography.h4,
  },
  amountContainer: {
    alignItems: 'center',
    paddingVertical: spacing.xxxl,
  },
  amountDisplay: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  currencySymbol: {
    fontSize: 32,
    fontWeight: '600',
    color: colors.text.secondary,
    marginTop: 12,
    marginRight: spacing.xs,
  },
  amount: {
    ...typography.amountLarge,
  },
  satsAmount: {
    ...typography.bodyLarge,
    color: colors.accent.primary,
    marginTop: spacing.md,
  },
  numpadContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  footer: {
    paddingTop: spacing.lg,
  },
});

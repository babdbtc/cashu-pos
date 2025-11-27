/**
 * Amount Entry Screen
 *
 * Allows merchant to enter payment amount using a numpad.
 */

import { useState, useCallback, useEffect } from 'react';
import { View, Text, StyleSheet, Pressable, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { Screen } from '@/components/layout';
import { Button } from '@/components/ui';
import { NumPad } from '@/components/payment/NumPad';
import { colors, spacing, typography, borderRadius } from '@/theme';
import { usePaymentStore } from '@/store/payment.store';
import { useConfigStore } from '@/store/config.store';
import {
  getExchangeRate,
  startRateRefresh,
  fiatToSatsSync,
} from '@/services/exchange-rate.service';
import type { ExchangeRate } from '@/types/payment';

export default function AmountScreen() {
  const router = useRouter();
  const { createPayment } = usePaymentStore();
  const { currency } = useConfigStore();

  // Amount in cents (or smallest currency unit)
  const [amountCents, setAmountCents] = useState(0);

  // Exchange rate state
  const [rate, setRate] = useState<ExchangeRate | null>(null);
  const [rateLoading, setRateLoading] = useState(true);

  // Fetch and auto-refresh exchange rate
  useEffect(() => {
    let cleanup: (() => void) | undefined;

    const initRate = async () => {
      try {
        const fetchedRate = await getExchangeRate(currency.displayCurrency, currency);
        setRate(fetchedRate);
        // Start auto-refresh based on config interval
        cleanup = startRateRefresh(
          currency.displayCurrency,
          currency.rateRefreshInterval,
          currency
        );
      } catch (error) {
        console.error('Failed to fetch exchange rate:', error);
      } finally {
        setRateLoading(false);
      }
    };

    initRate();

    return () => {
      if (cleanup) cleanup();
    };
  }, [currency.displayCurrency, currency.rateRefreshInterval]);

  const displayAmount = (amountCents / 100).toFixed(2);
  const satsAmount = rate ? fiatToSatsSync(amountCents / 100, currency.displayCurrency) ?? 0 : 0;

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
    if (satsAmount <= 0 || !rate) return;

    // Create payment in store
    createPayment({
      satsAmount,
      fiatAmount: amountCents / 100,
      fiatCurrency: currency.displayCurrency,
      exchangeRate: rate.ratePerBtc,
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

        {rateLoading ? (
          <ActivityIndicator color={colors.accent.primary} style={{ marginTop: spacing.md }} />
        ) : satsAmount > 0 ? (
          <Text style={styles.satsAmount}>
            {satsAmount.toLocaleString()} sats
          </Text>
        ) : null}

        {rate && !rateLoading && (
          <Text style={styles.rateInfo}>
            1 BTC = {rate.ratePerBtc.toLocaleString()} {currency.displayCurrency}
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
          disabled={satsAmount <= 0 || rateLoading || !rate}
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
  rateInfo: {
    ...typography.caption,
    color: colors.text.muted,
    marginTop: spacing.sm,
  },
  numpadContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  footer: {
    paddingTop: spacing.lg,
  },
});

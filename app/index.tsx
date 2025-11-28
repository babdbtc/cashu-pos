/**
 * Welcome/Home Screen
 *
 * The main landing screen showing terminal status and quick actions.
 */

import { useEffect } from 'react';
import { View, Text, StyleSheet, Pressable, useWindowDimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { Screen } from '@/components/layout';
import { Button, StatusDot } from '@/components/ui';
import { colors, spacing, typography } from '@/theme';
import { useThemeColors } from '@/hooks/useThemeColors';
import { useConfigStore } from '@/store/config.store';

export default function HomeScreen() {
  const router = useRouter();
  const { merchantName, terminalName, mints, currency, hasCompletedOnboarding } = useConfigStore();
  const { width, height } = useWindowDimensions();
  const themeColors = useThemeColors();

  // Check if onboarding has been completed
  useEffect(() => {
    const timer = setTimeout(() => {
      if (!hasCompletedOnboarding) {
        router.replace('/onboarding');
      }
    }, 100);

    return () => clearTimeout(timer);
  }, [hasCompletedOnboarding, router]);

  const hasMintConfigured = mints.trusted.length > 0;
  const isBitcoinOnly = currency.priceDisplayMode === 'sats_only';
  const isPhone = width < 768;
  const isTabletPortrait = width >= 768 && width < 1024;
  const isCompact = isPhone || isTabletPortrait;

  // Show loading while checking onboarding status
  if (!hasCompletedOnboarding) {
    return null;
  }

  // TODO: Replace with actual data from payment store
  const todayStats = {
    sales: 1250.50,
    transactions: 23,
    satsReceived: 52500,
  };

  const weeklyStats = {
    sales: 8450.75,
    sats: 352500,
    transactions: 142,
    avgTransaction: 59.50,
    avgSats: 2483,
  };

  const monthlyStats = {
    sales: 32150.00,
    sats: 1340000,
    transactions: 587,
    topProduct: 'Espresso',
  };

  const handlePOS = () => {
    router.push('/pos');
  };

  const handleNewPayment = () => {
    router.push('/amount');
  };

  const handleSettings = () => {
    router.push('/settings');
  };

  const handleHistory = () => {
    router.push('/history');
  };

  return (
    <Screen style={styles.screen}>
      {/* Compact Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.merchantName}>{merchantName}</Text>
          <Text style={styles.terminalName}>{terminalName}</Text>
        </View>
        <View style={styles.headerRight}>
          <View style={styles.statusItem}>
            <StatusDot variant={hasMintConfigured ? 'success' : 'warning'} />
            <Text style={styles.statusText}>
              {hasMintConfigured ? 'Ready' : 'Setup'}
            </Text>
          </View>
          <Pressable onPress={handleSettings} style={styles.settingsIcon}>
            <Text style={styles.settingsIconText}>⚙</Text>
          </Pressable>
        </View>
      </View>

      {/* Stats Section */}
      <View style={styles.statsSection}>
        <Text style={styles.todayLabel}>Today</Text>
        {isCompact ? (
          // Compact: Simplified stats (Phone & Tablet Portrait)
          <View style={styles.statsPhoneContainer}>
            <View style={styles.statPhoneItem}>
              <Text style={styles.statValueLarge}>
                {isBitcoinOnly
                  ? `₿${todayStats.satsReceived.toLocaleString()}`
                  : `$${todayStats.sales.toFixed(2)}`}
              </Text>
              <Text style={styles.statLabelPhone}>sales</Text>
            </View>
            <View style={styles.statPhoneItem}>
              <Text style={styles.statValuePhone}>{todayStats.transactions}</Text>
              <Text style={styles.statLabelPhone}>transactions</Text>
            </View>
            {!isBitcoinOnly && (
              <View style={styles.statPhoneItem}>
                <Text style={styles.statValuePhone}>₿{todayStats.satsReceived.toLocaleString()}</Text>
                <Text style={styles.statLabelPhone}>received</Text>
              </View>
            )}
          </View>
        ) : (
          // Widescreen: Full stats row (Tablet Landscape & Desktop)
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={styles.statValueLarge}>
                {isBitcoinOnly
                  ? `₿${todayStats.satsReceived.toLocaleString()}`
                  : `$${todayStats.sales.toFixed(2)}`}
              </Text>
              <Text style={styles.statLabelInline}>sales</Text>
            </View>
            <View style={styles.statSeparator} />
            <View style={styles.statItem}>
              <Text style={styles.statValueMedium}>{todayStats.transactions}</Text>
              <Text style={styles.statLabelInline}>transactions</Text>
            </View>
            {!isBitcoinOnly && (
              <>
                <View style={styles.statSeparator} />
                <View style={styles.statItem}>
                  <Text style={styles.statValueMedium}>₿{todayStats.satsReceived.toLocaleString()}</Text>
                  <Text style={styles.statLabelInline}>received</Text>
                </View>
              </>
            )}
          </View>
        )}
      </View>

      {/* Quick Actions */}
      <View style={styles.actions}>
        <Pressable
          style={[styles.primaryAction, isCompact && styles.primaryActionPhone]}
          onPress={handlePOS}
        >
          <Text style={[
            styles.primaryActionTitle,
            isCompact && styles.primaryActionTitlePhone,
            { color: themeColors.accent }
          ]}>
            Point of Sale
          </Text>
          <Text style={styles.primaryActionSubtitle}>Full product catalog</Text>
        </Pressable>

        <View style={styles.secondaryActions}>
          <Pressable style={styles.secondaryAction} onPress={handleNewPayment}>
            <Text style={styles.secondaryActionTitle}>
              Quick Payment
            </Text>
          </Pressable>

          <Pressable style={styles.secondaryAction} onPress={handleHistory}>
            <Text style={styles.secondaryActionTitle}>
              History
            </Text>
          </Pressable>
        </View>
      </View>

      {/* Performance Overview */}
      <View style={styles.summarySection}>
        <View style={styles.summaryRow}>
          <View style={styles.summaryColumn}>
            <Text style={styles.summaryLabel}>Week</Text>
            <Text style={styles.summaryValue}>
              {isBitcoinOnly
                ? `₿${weeklyStats.sats.toLocaleString()}`
                : `$${weeklyStats.sales.toLocaleString()}`}
            </Text>
          </View>
          <View style={styles.summaryColumn}>
            <Text style={styles.summaryLabel}>Month</Text>
            <Text style={styles.summaryValue}>
              {isBitcoinOnly
                ? `₿${monthlyStats.sats.toLocaleString()}`
                : `$${monthlyStats.sales.toLocaleString()}`}
            </Text>
          </View>
          {!isCompact && (
            <View style={styles.summaryColumn}>
              <Text style={styles.summaryLabel}>Avg</Text>
              <Text style={styles.summaryValue}>
                {isBitcoinOnly
                  ? `₿${weeklyStats.avgSats.toLocaleString()}`
                  : `$${weeklyStats.avgTransaction.toFixed(0)}`}
              </Text>
            </View>
          )}
        </View>
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
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xxxl,
  },
  merchantName: {
    ...typography.h3,
    color: colors.text.primary,
    marginBottom: 2,
  },
  terminalName: {
    ...typography.bodySmall,
    color: colors.text.muted,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
  },
  statusItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  statusText: {
    ...typography.bodySmall,
    color: colors.text.secondary,
    fontWeight: '600',
  },
  settingsIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.background.secondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingsIconText: {
    fontSize: 24,
    color: colors.text.primary,
  },
  statsSection: {
    marginBottom: spacing.xxxl,
  },
  todayLabel: {
    ...typography.caption,
    color: colors.text.muted,
    textTransform: 'uppercase',
    letterSpacing: 2,
    fontSize: 11,
    marginBottom: spacing.md,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: spacing.sm,
  },
  statsPhoneContainer: {
    gap: spacing.lg,
  },
  statPhoneItem: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: spacing.sm,
  },
  statSeparator: {
    width: 1,
    height: 40,
    backgroundColor: colors.border.default,
    marginHorizontal: spacing.md,
  },
  statValueLarge: {
    ...typography.h1,
    color: colors.text.primary,
    fontSize: 36,
  },
  statValueMedium: {
    ...typography.h2,
    color: colors.text.primary,
    fontSize: 28,
  },
  statValuePhone: {
    ...typography.h3,
    color: colors.text.primary,
    fontSize: 24,
  },
  statLabelInline: {
    ...typography.bodySmall,
    color: colors.text.muted,
  },
  statLabelPhone: {
    ...typography.bodySmall,
    color: colors.text.muted,
  },
  actions: {
    flex: 1,
    gap: spacing.md,
  },
  primaryAction: {
    paddingVertical: spacing.xxl,
    paddingHorizontal: spacing.xl,
    backgroundColor: colors.background.secondary,
    borderRadius: 20,
  },
  primaryActionPhone: {
    paddingVertical: spacing.huge,
    minHeight: 140,
  },
  primaryActionTitle: {
    ...typography.h1,
    fontSize: 32,
    marginBottom: spacing.xs,
  },
  primaryActionTitlePhone: {
    fontSize: 40,
    marginBottom: spacing.sm,
  },
  primaryActionSubtitle: {
    ...typography.body,
    color: colors.text.secondary,
  },
  secondaryActions: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  secondaryAction: {
    flex: 1,
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.background.secondary,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryActionTitle: {
    ...typography.h4,
    color: colors.text.primary,
  },
  summarySection: {
    marginTop: 'auto',
    paddingTop: spacing.xl,
  },
  summaryRow: {
    flexDirection: 'row',
    gap: spacing.xxl,
  },
  summaryColumn: {
    flex: 1,
  },
  summaryLabel: {
    ...typography.caption,
    color: colors.text.muted,
    textTransform: 'uppercase',
    fontSize: 10,
    letterSpacing: 1.5,
    marginBottom: spacing.xs,
  },
  summaryValue: {
    ...typography.h3,
    color: colors.text.secondary,
    fontSize: 20,
  },
});

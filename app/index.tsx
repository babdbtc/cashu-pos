/**
 * Welcome/Home Screen
 *
 * The main landing screen showing terminal status and quick actions.
 */

import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, useWindowDimensions, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { Screen } from '@/components/layout';
import { StatusDot } from '@/components/ui';
import { GlassCard } from '@/components/ui/GlassView';
import { colors, spacing, typography } from '@/theme';
import { useConfigStore } from '@/store/config.store';
import { useSeedStore } from '@/store/seed.store';
import { usePaymentStats } from '@/hooks/usePaymentStats';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

export default function HomeScreen() {
  const router = useRouter();
  const { merchantName, terminalName, mints, currency, hasCompletedOnboarding, syncEnabled } = useConfigStore();
  const { isWalletInitialized, checkWalletStatus } = useSeedStore();
  const { width } = useWindowDimensions();
  const stats = usePaymentStats();
  const [showStoreStats, setShowStoreStats] = useState(false);
  const [isCheckingWallet, setIsCheckingWallet] = useState(true);

  // Current stats based on toggle (device or store-wide)
  const currentStats = showStoreStats ? stats.store : stats.device;

  // Check wallet status on mount
  useEffect(() => {
    checkWalletStatus().finally(() => setIsCheckingWallet(false));
  }, []);

  // Check if onboarding and wallet setup have been completed
  useEffect(() => {
    if (isCheckingWallet) return;

    const timer = setTimeout(() => {
      if (!hasCompletedOnboarding) {
        router.replace('/onboarding');
      } else if (!isWalletInitialized) {
        router.push('/wallet/setup');
      }
    }, 100);

    return () => clearTimeout(timer);
  }, [hasCompletedOnboarding, isWalletInitialized, isCheckingWallet, router]);

  const hasMintConfigured = mints.trusted.length > 0;
  const isBitcoinOnly = currency.priceDisplayMode === 'sats_only';
  const isPhone = width < 768;

  // Show loading while checking onboarding and wallet status
  if (!hasCompletedOnboarding || isCheckingWallet) {
    return null;
  }

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

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency.displayCurrency,
    }).format(amount);
  };

  const formatSats = (amount: number) => {
    return `⚡ ${amount.toLocaleString()}`;
  };

  return (
    <Screen style={styles.screen}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.merchantName}>{merchantName}</Text>
            <View style={styles.terminalBadge}>
              <Ionicons name="terminal-outline" size={14} color={colors.text.muted} />
              <Text style={styles.terminalName}>{terminalName}</Text>
            </View>
          </View>
          <View style={styles.headerRight}>
            {syncEnabled && stats.hasSyncedData && (
              <View style={[styles.statusItem, styles.syncStatus]}>
                <Ionicons name="sync-outline" size={14} color={colors.accent.primary} />
                <Text style={[styles.statusText, { color: colors.accent.primary }]}>
                  Synced
                </Text>
              </View>
            )}
            <View style={styles.statusItem}>
              <StatusDot variant={hasMintConfigured ? 'success' : 'warning'} />
              <Text style={styles.statusText}>
                {hasMintConfigured ? 'Online' : 'Setup Required'}
              </Text>
            </View>
            <Pressable onPress={handleSettings} style={styles.settingsButton}>
              <Ionicons name="settings-outline" size={24} color={colors.text.primary} />
            </Pressable>
          </View>
        </View>

        {/* Hero / Main Action */}
        <Pressable onPress={handlePOS} style={styles.heroContainer}>
          <LinearGradient
            colors={[colors.background.secondary, colors.background.tertiary]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.heroGradient}
          >
            <View style={styles.heroContent}>
              <View>
                <Text style={styles.heroTitle}>Start New Sale</Text>
                <Text style={styles.heroSubtitle}>Open Point of Sale Terminal</Text>
              </View>
              <View style={styles.heroIconContainer}>
                <Ionicons name="grid-outline" size={32} color={colors.accent.primary} />
              </View>
            </View>
          </LinearGradient>
        </Pressable>

        {/* Stats Toggle Header */}
        <View style={styles.statsHeader}>
          <Text style={styles.sectionTitleNoMargin}>Today&apos;s Overview</Text>
          {stats.hasSyncedData && (
            <View style={styles.statsToggle}>
              <Pressable
                style={[styles.toggleButton, !showStoreStats && styles.toggleButtonActive]}
                onPress={() => setShowStoreStats(false)}
              >
                <Ionicons
                  name="phone-portrait-outline"
                  size={14}
                  color={!showStoreStats ? colors.text.inverse : colors.text.muted}
                />
                <Text style={[styles.toggleText, !showStoreStats && styles.toggleTextActive]}>
                  Device
                </Text>
              </Pressable>
              <Pressable
                style={[styles.toggleButton, showStoreStats && styles.toggleButtonActive]}
                onPress={() => setShowStoreStats(true)}
              >
                <Ionicons
                  name="storefront-outline"
                  size={14}
                  color={showStoreStats ? colors.text.inverse : colors.text.muted}
                />
                <Text style={[styles.toggleText, showStoreStats && styles.toggleTextActive]}>
                  Store ({stats.terminalCount})
                </Text>
              </Pressable>
            </View>
          )}
        </View>

        <View style={isPhone ? styles.statsGridPhone : styles.statsGrid}>
          <GlassCard style={styles.statCard}>
            <View style={styles.statIconBg}>
              <Ionicons name="cash-outline" size={20} color={colors.accent.primary} />
            </View>
            <Text style={styles.statLabel}>Total Sales</Text>
            <Text style={styles.statValue}>
              {isBitcoinOnly ? formatSats(currentStats.today.sats) : formatCurrency(currentStats.today.sales)}
            </Text>
          </GlassCard>

          <GlassCard style={styles.statCard}>
            <View style={[styles.statIconBg, { backgroundColor: 'rgba(59, 130, 246, 0.1)' }]}>
              <Ionicons name="receipt-outline" size={20} color={colors.accent.info} />
            </View>
            <Text style={styles.statLabel}>Transactions</Text>
            <Text style={styles.statValue}>{currentStats.today.transactions}</Text>
          </GlassCard>

          <GlassCard style={styles.statCard}>
            <View style={[styles.statIconBg, { backgroundColor: 'rgba(245, 158, 11, 0.1)' }]}>
              <Ionicons name="flash-outline" size={20} color={colors.accent.warning} />
            </View>
            <Text style={styles.statLabel}>Sats Received</Text>
            <Text style={styles.statValue}>{currentStats.today.sats.toLocaleString()}</Text>
          </GlassCard>
        </View>

        {/* Quick Actions */}
        <Text style={styles.sectionTitle}>Quick Actions</Text>
        <View style={styles.actionsGrid}>
          <Pressable style={styles.actionButton} onPress={handleNewPayment}>
            <GlassCard style={styles.actionCard}>
              <Ionicons name="keypad-outline" size={28} color={colors.text.primary} />
              <Text style={styles.actionLabel}>Quick Pay</Text>
            </GlassCard>
          </Pressable>

          <Pressable style={styles.actionButton} onPress={handleHistory}>
            <GlassCard style={styles.actionCard}>
              <Ionicons name="time-outline" size={28} color={colors.text.primary} />
              <Text style={styles.actionLabel}>History</Text>
            </GlassCard>
          </Pressable>

          <Pressable style={styles.actionButton} onPress={() => router.push('/refund/search')}>
            <GlassCard style={styles.actionCard}>
              <Ionicons name="return-down-back-outline" size={28} color={colors.text.primary} />
              <Text style={styles.actionLabel}>Refund</Text>
            </GlassCard>
          </Pressable>
        </View>

        {/* Restaurant Actions */}
        <Text style={styles.sectionTitle}>Restaurant</Text>
        <View style={styles.actionsGrid}>
          <Pressable style={styles.actionButton} onPress={() => router.push('/tables')}>
            <GlassCard style={styles.actionCard}>
              <Ionicons name="restaurant-outline" size={28} color={colors.text.primary} />
              <Text style={styles.actionLabel}>Floor Plan</Text>
            </GlassCard>
          </Pressable>

          <Pressable style={styles.actionButton} onPress={() => router.push('/waiter')}>
            <GlassCard style={styles.actionCard}>
              <Ionicons name="person-outline" size={28} color={colors.text.primary} />
              <Text style={styles.actionLabel}>Waiter View</Text>
            </GlassCard>
          </Pressable>
        </View>

        {/* Performance Summary */}
        <Text style={styles.sectionTitle}>
          {showStoreStats && stats.hasSyncedData ? 'Store Performance' : 'Performance'}
        </Text>
        <GlassCard style={styles.summaryCard}>
          <View style={styles.summaryRow}>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>This Week</Text>
              <Text style={styles.summaryValue}>
                {isBitcoinOnly ? formatSats(currentStats.week.sats) : formatCurrency(currentStats.week.sales)}
              </Text>
            </View>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>This Month</Text>
              <Text style={styles.summaryValue}>
                {isBitcoinOnly ? formatSats(currentStats.month.sats) : formatCurrency(currentStats.month.sales)}
              </Text>
            </View>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>Avg. Ticket</Text>
              <Text style={styles.summaryValue}>
                {isBitcoinOnly ? formatSats(Math.round(currentStats.week.avgSats)) : formatCurrency(currentStats.week.avgTransaction)}
              </Text>
            </View>
          </View>
        </GlassCard>

        <View style={{ height: 40 }} />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  contentContainer: {
    padding: 0,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xl,
    marginBottom: spacing.xl,
  },
  merchantName: {
    ...typography.h3,
    color: colors.text.primary,
    marginBottom: 4,
  },
  terminalBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
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
    backgroundColor: colors.background.secondary,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  syncStatus: {
    backgroundColor: 'rgba(74, 222, 128, 0.1)',
    borderColor: 'rgba(74, 222, 128, 0.3)',
  },
  statusText: {
    ...typography.caption,
    color: colors.text.secondary,
    fontWeight: '600',
  },
  settingsButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.background.secondary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  heroContainer: {
    marginHorizontal: spacing.xl,
    marginBottom: spacing.xxl,
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border.light,
  },
  heroGradient: {
    padding: spacing.xl,
  },
  heroContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  heroTitle: {
    ...typography.h2,
    color: colors.text.primary,
    marginBottom: 4,
  },
  heroSubtitle: {
    ...typography.body,
    color: colors.text.secondary,
  },
  heroIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(74, 222, 128, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionTitle: {
    ...typography.h4,
    color: colors.text.primary,
    marginBottom: spacing.md,
    paddingHorizontal: spacing.xl,
  },
  sectionTitleNoMargin: {
    ...typography.h4,
    color: colors.text.primary,
    paddingHorizontal: spacing.xl,
  },
  statsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingRight: spacing.xl,
    marginBottom: spacing.md,
  },
  statsToggle: {
    flexDirection: 'row',
    backgroundColor: colors.background.secondary,
    borderRadius: 20,
    padding: 3,
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  toggleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  toggleButtonActive: {
    backgroundColor: colors.accent.primary,
  },
  toggleText: {
    ...typography.caption,
    color: colors.text.muted,
    fontWeight: '600',
  },
  toggleTextActive: {
    color: colors.text.inverse,
  },
  statsGrid: {
    flexDirection: 'row',
    gap: spacing.md,
    paddingHorizontal: spacing.xl,
    marginBottom: spacing.xxl,
  },
  statsGridPhone: {
    flexDirection: 'column',
    gap: spacing.md,
    paddingHorizontal: spacing.xl,
    marginBottom: spacing.xxl,
  },
  statCard: {
    flex: 1,
    padding: spacing.lg,
    alignItems: 'flex-start',
  },
  statIconBg: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(74, 222, 128, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  statLabel: {
    ...typography.caption,
    color: colors.text.muted,
    marginBottom: 4,
  },
  statValue: {
    ...typography.h3,
    color: colors.text.primary,
  },
  actionsGrid: {
    flexDirection: 'row',
    gap: spacing.md,
    paddingHorizontal: spacing.xl,
    marginBottom: spacing.xxl,
  },
  actionButton: {
    flex: 1,
  },
  actionCard: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
    gap: spacing.sm,
    height: 100,
  },
  actionLabel: {
    ...typography.bodySmall,
    color: colors.text.primary,
    fontWeight: '600',
  },
  summaryCard: {
    marginHorizontal: spacing.xl,
    padding: spacing.lg,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  summaryItem: {
    flex: 1,
    alignItems: 'center',
  },
  summaryDivider: {
    width: 1,
    height: 40,
    backgroundColor: colors.border.default,
  },
  summaryLabel: {
    ...typography.caption,
    color: colors.text.muted,
    marginBottom: 4,
  },
  summaryValue: {
    ...typography.h4,
    color: colors.text.primary,
  },
});

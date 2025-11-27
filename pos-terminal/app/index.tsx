/**
 * Welcome/Home Screen
 *
 * The main landing screen showing terminal status and quick actions.
 */

import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { Screen } from '@/components/layout';
import { Button, StatusDot } from '@/components/ui';
import { colors, spacing, typography } from '@/theme';
import { useConfigStore } from '@/store/config.store';

export default function HomeScreen() {
  const router = useRouter();
  const { merchantName, terminalName, mints } = useConfigStore();

  const hasMintConfigured = mints.trusted.length > 0;

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
      {/* Status Bar */}
      <View style={styles.statusBar}>
        <View style={styles.statusItem}>
          <StatusDot variant={hasMintConfigured ? 'success' : 'warning'} />
          <Text style={styles.statusText}>
            {hasMintConfigured ? 'Ready' : 'Setup Required'}
          </Text>
        </View>
        <Text style={styles.terminalName}>{terminalName}</Text>
      </View>

      {/* Main Content */}
      <View style={styles.content}>
        <View style={styles.logoContainer}>
          <Text style={styles.logo}>C</Text>
        </View>

        <Text style={styles.title}>CashuPay</Text>
        <Text style={styles.subtitle}>{merchantName}</Text>

        <Text style={styles.readyText}>
          {hasMintConfigured
            ? 'Ready to accept payments'
            : 'Configure a mint to start accepting payments'}
        </Text>
      </View>

      {/* Action Buttons */}
      <View style={styles.actions}>
        <Button
          title="Point of Sale"
          onPress={handlePOS}
          variant="primary"
          size="lg"
          fullWidth
        />

        <Button
          title="Quick Payment"
          onPress={handleNewPayment}
          variant="secondary"
          size="lg"
          fullWidth
        />

        <View style={styles.secondaryActions}>
          <Pressable style={styles.secondaryButton} onPress={handleHistory}>
            <Text style={styles.secondaryButtonText}>History</Text>
          </Pressable>

          <Pressable style={styles.secondaryButton} onPress={handleSettings}>
            <Text style={styles.secondaryButtonText}>Settings</Text>
          </Pressable>
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
  statusBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  statusItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  statusText: {
    ...typography.bodySmall,
    color: colors.text.secondary,
  },
  terminalName: {
    ...typography.bodySmall,
    color: colors.text.muted,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: spacing.huge,
  },
  logoContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: colors.accent.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xxl,
  },
  logo: {
    fontSize: 64,
    fontWeight: '700',
    color: colors.text.inverse,
  },
  title: {
    ...typography.h2,
    marginBottom: spacing.xs,
  },
  subtitle: {
    ...typography.bodyLarge,
    color: colors.text.secondary,
    marginBottom: spacing.xxl,
  },
  readyText: {
    ...typography.body,
    color: colors.text.muted,
    textAlign: 'center',
  },
  actions: {
    gap: spacing.lg,
  },
  secondaryActions: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  secondaryButton: {
    flex: 1,
    paddingVertical: spacing.lg,
    alignItems: 'center',
    backgroundColor: colors.background.secondary,
    borderRadius: 12,
  },
  secondaryButtonText: {
    ...typography.button,
    color: colors.text.primary,
  },
});

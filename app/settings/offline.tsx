/**
 * Offline Mode Settings Screen
 *
 * Configure offline payment acceptance settings.
 */

import { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  Switch,
  TextInput,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { useConfigStore } from '../../src/store/config.store';

export default function OfflineSettingsScreen() {
  const router = useRouter();
  const offline = useConfigStore((state) => state.offline);
  const setOfflineEnabled = useConfigStore((state) => state.setOfflineEnabled);
  const setOfflineMaxAmount = useConfigStore((state) => state.setOfflineMaxAmount);
  const setOfflineMaxTransactions = useConfigStore((state) => state.setOfflineMaxTransactions);

  const [maxAmountInput, setMaxAmountInput] = useState(offline.maxAmountPerTransaction.toString());
  const [maxTransactionsInput, setMaxTransactionsInput] = useState(
    offline.maxQueuedTransactions.toString()
  );

  const handleToggleOffline = useCallback(
    (value: boolean) => {
      setOfflineEnabled(value);
    },
    [setOfflineEnabled]
  );

  const handleMaxAmountChange = useCallback(
    (text: string) => {
      setMaxAmountInput(text);
      const value = parseInt(text, 10);
      if (!isNaN(value) && value > 0) {
        setOfflineMaxAmount(value);
      }
    },
    [setOfflineMaxAmount]
  );

  const handleMaxTransactionsChange = useCallback(
    (text: string) => {
      setMaxTransactionsInput(text);
      const value = parseInt(text, 10);
      if (!isNaN(value) && value > 0) {
        setOfflineMaxTransactions(value);
      }
    },
    [setOfflineMaxTransactions]
  );

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      {/* Back Button */}
      <Pressable onPress={() => router.back()} style={styles.backButton}>
        <Ionicons name="chevron-back" size={28} color="#fff" />
      </Pressable>

      <ScrollView style={styles.scrollView}>
        {/* Enable Offline Mode */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Offline Payments</Text>

          <View style={styles.toggleRow}>
            <View style={styles.toggleInfo}>
              <Text style={styles.toggleLabel}>Enable Offline Mode</Text>
              <Text style={styles.toggleDescription}>
                Accept payments when internet is unavailable
              </Text>
            </View>
            <Switch
              value={offline.enabled}
              onValueChange={handleToggleOffline}
              trackColor={{ false: '#2a2a3e', true: '#4ade80' }}
              thumbColor="#ffffff"
            />
          </View>
        </View>

        {/* Offline Limits */}
        {offline.enabled && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Offline Limits</Text>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Max Amount Per Transaction (sats)</Text>
              <Text style={styles.inputDescription}>
                Maximum payment amount allowed when offline
              </Text>
              <TextInput
                style={styles.input}
                value={maxAmountInput}
                onChangeText={handleMaxAmountChange}
                keyboardType="number-pad"
                placeholder="50000"
                placeholderTextColor="#555"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Max Queued Transactions</Text>
              <Text style={styles.inputDescription}>
                Maximum number of offline payments to queue
              </Text>
              <TextInput
                style={styles.input}
                value={maxTransactionsInput}
                onChangeText={handleMaxTransactionsChange}
                keyboardType="number-pad"
                placeholder="20"
                placeholderTextColor="#555"
              />
            </View>
          </View>
        )}

        {/* Queue Status */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Queue Status</Text>

          <View style={styles.statusBox}>
            <View style={styles.statusRow}>
              <Text style={styles.statusLabel}>Connection Status</Text>
              <View style={styles.statusBadge}>
                <View style={[styles.statusDot, styles.statusDotOnline]} />
                <Text style={styles.statusBadgeText}>Online</Text>
              </View>
            </View>

            <View style={styles.statusRow}>
              <Text style={styles.statusLabel}>Queued Payments</Text>
              <Text style={styles.statusValue}>0</Text>
            </View>

            <View style={styles.statusRow}>
              <Text style={styles.statusLabel}>Pending Verification</Text>
              <Text style={styles.statusValue}>0</Text>
            </View>
          </View>

          <Pressable style={[styles.syncButton, styles.syncButtonDisabled]} disabled>
            <Text style={styles.syncButtonText}>Sync Queue</Text>
          </Pressable>
        </View>

        {/* Security Warning */}
        <View style={styles.section}>
          <View style={styles.warningBox}>
            <Text style={styles.warningTitle}>⚠️ Security Notice</Text>
            <Text style={styles.warningText}>
              Offline payments carry additional risk since tokens cannot be verified
              in real-time. Set conservative limits and review queued payments
              promptly when connectivity is restored.
            </Text>
          </View>
        </View>

        {/* How It Works */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>How It Works</Text>

          <View style={styles.infoBox}>
            <Text style={styles.infoText}>
              1. When offline, payments are accepted and queued locally{'\n'}
              2. Tokens are stored securely until verification{'\n'}
              3. When online, queued payments are verified automatically{'\n'}
              4. Invalid tokens are flagged for review{'\n'}
              5. Valid tokens are settled per your settlement settings
            </Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f0f1a',
  },
  backButton: {
    padding: 12,
    paddingLeft: 8,
  },
  scrollView: {
    flex: 1,
  },
  section: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#2a2a3e',
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#888',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 16,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#1a1a2e',
    padding: 16,
    borderRadius: 8,
  },
  toggleInfo: {
    flex: 1,
    marginRight: 16,
  },
  toggleLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 4,
  },
  toggleDescription: {
    fontSize: 14,
    color: '#888',
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 4,
  },
  inputDescription: {
    fontSize: 14,
    color: '#888',
    marginBottom: 12,
  },
  input: {
    backgroundColor: '#1a1a2e',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: '#ffffff',
  },
  statusBox: {
    backgroundColor: '#1a1a2e',
    padding: 16,
    borderRadius: 8,
    marginBottom: 16,
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  statusLabel: {
    fontSize: 16,
    color: '#888',
  },
  statusValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2a3a2e',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  statusDotOnline: {
    backgroundColor: '#4ade80',
  },
  statusDotOffline: {
    backgroundColor: '#ef4444',
  },
  statusBadgeText: {
    fontSize: 14,
    color: '#4ade80',
    fontWeight: '500',
  },
  syncButton: {
    backgroundColor: '#4ade80',
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  syncButtonDisabled: {
    backgroundColor: '#2a2a3e',
  },
  syncButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#555',
  },
  warningBox: {
    backgroundColor: 'rgba(234, 179, 8, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(234, 179, 8, 0.3)',
    padding: 16,
    borderRadius: 8,
  },
  warningTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#eab308',
    marginBottom: 8,
  },
  warningText: {
    fontSize: 14,
    color: '#888',
    lineHeight: 20,
  },
  infoBox: {
    backgroundColor: '#1a1a2e',
    padding: 16,
    borderRadius: 8,
  },
  infoText: {
    fontSize: 14,
    color: '#888',
    lineHeight: 22,
  },
});

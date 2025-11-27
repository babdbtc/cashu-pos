/**
 * Security Settings Screen
 *
 * Configure PIN, limits, and other security settings.
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
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAlert } from '../../src/hooks/useAlert';
import { useConfigStore } from '../../src/store/config.store';

export default function SecuritySettingsScreen() {
  const { success, error: showError, confirm } = useAlert();
  const security = useConfigStore((state) => state.security);
  const setRequirePin = useConfigStore((state) => state.setRequirePin);
  const setRequirePinForRefunds = useConfigStore((state) => state.setRequirePinForRefunds);
  const setRequirePinForSettings = useConfigStore((state) => state.setRequirePinForSettings);
  const setMaxPaymentAmount = useConfigStore((state) => state.setMaxPaymentAmount);
  const setDailyLimit = useConfigStore((state) => state.setDailyLimit);

  const [showPinSetup, setShowPinSetup] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [confirmPinInput, setConfirmPinInput] = useState('');
  const [maxAmountInput, setMaxAmountInput] = useState(security.maxPaymentAmount.toString());
  const [dailyLimitInput, setDailyLimitInput] = useState(security.dailyLimit.toString());

  const handleSetPin = useCallback(() => {
    if (pinInput.length < 4) {
      showError('Error', 'PIN must be at least 4 digits');
      return;
    }
    if (pinInput !== confirmPinInput) {
      showError('Error', 'PINs do not match');
      return;
    }

    // In production, this would hash and store the PIN securely
    setRequirePin(true);
    setShowPinSetup(false);
    setPinInput('');
    setConfirmPinInput('');
    success('Success', 'PIN has been set successfully');
  }, [pinInput, confirmPinInput, setRequirePin, showError, success]);

  const handleRemovePin = useCallback(() => {
    confirm(
      'Remove PIN',
      'Are you sure you want to remove the PIN requirement?',
      () => setRequirePin(false)
    );
  }, [setRequirePin, confirm]);

  const handleMaxAmountChange = useCallback(
    (text: string) => {
      setMaxAmountInput(text);
      const value = parseInt(text, 10);
      if (!isNaN(value) && value > 0) {
        setMaxPaymentAmount(value);
      }
    },
    [setMaxPaymentAmount]
  );

  const handleDailyLimitChange = useCallback(
    (text: string) => {
      setDailyLimitInput(text);
      const value = parseInt(text, 10);
      if (!isNaN(value) && value > 0) {
        setDailyLimit(value);
      }
    },
    [setDailyLimit]
  );

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView style={styles.scrollView}>
        {/* PIN Settings */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>PIN Protection</Text>

          <View style={styles.toggleRow}>
            <View style={styles.toggleInfo}>
              <Text style={styles.toggleLabel}>Require PIN</Text>
              <Text style={styles.toggleDescription}>
                {security.requirePin ? 'PIN is set' : 'No PIN configured'}
              </Text>
            </View>
            {security.requirePin ? (
              <Pressable style={styles.changePinButton} onPress={handleRemovePin}>
                <Text style={styles.changePinText}>Remove</Text>
              </Pressable>
            ) : (
              <Pressable
                style={styles.setPinButton}
                onPress={() => setShowPinSetup(true)}
              >
                <Text style={styles.setPinText}>Set PIN</Text>
              </Pressable>
            )}
          </View>

          {security.requirePin && (
            <>
              <View style={[styles.toggleRow, { marginTop: 8 }]}>
                <View style={styles.toggleInfo}>
                  <Text style={styles.toggleLabel}>PIN for Refunds</Text>
                  <Text style={styles.toggleDescription}>
                    Require PIN to process refunds
                  </Text>
                </View>
                <Switch
                  value={security.requirePinForRefunds}
                  onValueChange={setRequirePinForRefunds}
                  trackColor={{ false: '#2a2a3e', true: '#4ade80' }}
                  thumbColor="#ffffff"
                />
              </View>

              <View style={[styles.toggleRow, { marginTop: 8 }]}>
                <View style={styles.toggleInfo}>
                  <Text style={styles.toggleLabel}>PIN for Settings</Text>
                  <Text style={styles.toggleDescription}>
                    Require PIN to access settings
                  </Text>
                </View>
                <Switch
                  value={security.requirePinForSettings}
                  onValueChange={setRequirePinForSettings}
                  trackColor={{ false: '#2a2a3e', true: '#4ade80' }}
                  thumbColor="#ffffff"
                />
              </View>
            </>
          )}
        </View>

        {/* PIN Setup Form */}
        {showPinSetup && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Set PIN</Text>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Enter PIN</Text>
              <TextInput
                style={styles.input}
                value={pinInput}
                onChangeText={setPinInput}
                placeholder="••••"
                placeholderTextColor="#555"
                keyboardType="number-pad"
                secureTextEntry
                maxLength={6}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Confirm PIN</Text>
              <TextInput
                style={styles.input}
                value={confirmPinInput}
                onChangeText={setConfirmPinInput}
                placeholder="••••"
                placeholderTextColor="#555"
                keyboardType="number-pad"
                secureTextEntry
                maxLength={6}
              />
            </View>

            <View style={styles.formActions}>
              <Pressable
                style={styles.cancelButton}
                onPress={() => {
                  setShowPinSetup(false);
                  setPinInput('');
                  setConfirmPinInput('');
                }}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </Pressable>
              <Pressable style={styles.saveButton} onPress={handleSetPin}>
                <Text style={styles.saveButtonText}>Save PIN</Text>
              </Pressable>
            </View>
          </View>
        )}

        {/* Transaction Limits */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Transaction Limits</Text>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Max Single Payment (sats)</Text>
            <Text style={styles.inputDescription}>
              Maximum amount for a single transaction
            </Text>
            <TextInput
              style={styles.input}
              value={maxAmountInput}
              onChangeText={handleMaxAmountChange}
              keyboardType="number-pad"
              placeholder="1000000"
              placeholderTextColor="#555"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Daily Limit (sats)</Text>
            <Text style={styles.inputDescription}>
              Maximum total payments per day
            </Text>
            <TextInput
              style={styles.input}
              value={dailyLimitInput}
              onChangeText={handleDailyLimitChange}
              keyboardType="number-pad"
              placeholder="10000000"
              placeholderTextColor="#555"
            />
          </View>
        </View>

        {/* Today's Usage */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Today&apos;s Usage</Text>

          <View style={styles.usageBox}>
            <View style={styles.usageRow}>
              <Text style={styles.usageLabel}>Transactions</Text>
              <Text style={styles.usageValue}>0</Text>
            </View>
            <View style={styles.usageRow}>
              <Text style={styles.usageLabel}>Total Volume</Text>
              <Text style={styles.usageValue}>0 sats</Text>
            </View>
            <View style={styles.usageRow}>
              <Text style={styles.usageLabel}>Daily Limit Remaining</Text>
              <Text style={styles.usageValue}>
                {security.dailyLimit.toLocaleString()} sats
              </Text>
            </View>
          </View>

          <View style={styles.progressContainer}>
            <View style={styles.progressBar}>
              <View style={[styles.progressFill, { width: '0%' }]} />
            </View>
            <Text style={styles.progressText}>0% of daily limit used</Text>
          </View>
        </View>

        {/* Security Tips */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Security Tips</Text>

          <View style={styles.tipBox}>
            <Text style={styles.tipText}>
              • Set a strong PIN that only authorized staff know{'\n'}
              • Review daily transaction limits regularly{'\n'}
              • Enable PIN for refunds to prevent unauthorized returns{'\n'}
              • Monitor the daily usage to detect unusual activity{'\n'}
              • Use different staff accounts for accountability
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
  setPinButton: {
    backgroundColor: '#4ade80',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
  },
  setPinText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0f0f1a',
  },
  changePinButton: {
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
  },
  changePinText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ef4444',
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
  formActions: {
    flexDirection: 'row',
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 8,
    backgroundColor: '#2a2a3e',
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#888',
  },
  saveButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 8,
    backgroundColor: '#4ade80',
    alignItems: 'center',
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0f0f1a',
  },
  usageBox: {
    backgroundColor: '#1a1a2e',
    padding: 16,
    borderRadius: 8,
    marginBottom: 16,
  },
  usageRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  usageLabel: {
    fontSize: 16,
    color: '#888',
  },
  usageValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
  },
  progressContainer: {
    marginBottom: 8,
  },
  progressBar: {
    height: 8,
    backgroundColor: '#2a2a3e',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#4ade80',
  },
  progressText: {
    fontSize: 12,
    color: '#888',
    marginTop: 8,
    textAlign: 'center',
  },
  tipBox: {
    backgroundColor: '#1a1a2e',
    padding: 16,
    borderRadius: 8,
  },
  tipText: {
    fontSize: 14,
    color: '#888',
    lineHeight: 22,
  },
});

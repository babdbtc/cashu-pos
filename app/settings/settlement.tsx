/**
 * Settlement Settings Screen
 *
 * Configure how payments are settled (instant vs batched).
 */

import { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  TextInput,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { useConfigStore } from '../../src/store/config.store';
import type { SettlementMode } from '../../src/types/config';

const SETTLEMENT_MODES: { mode: SettlementMode; title: string; description: string }[] = [
  {
    mode: 'instant',
    title: 'Instant',
    description: 'Swap tokens immediately after each payment. Higher fees but immediate liquidity.',
  },
  {
    mode: 'batched',
    title: 'Batched',
    description: 'Accumulate tokens and swap in batches. Lower fees but delayed settlement.',
  },
  {
    mode: 'hybrid',
    title: 'Hybrid',
    description: 'Instant for large amounts, batched for small. Best balance of fees and liquidity.',
  },
  {
    mode: 'manual',
    title: 'Manual',
    description: 'Only settle when manually triggered. Full control over timing.',
  },
];

export default function SettlementSettingsScreen() {
  const router = useRouter();
  const settlement = useConfigStore((state) => state.settlement);
  const setSettlementMode = useConfigStore((state) => state.setSettlementMode);
  const setBatchThreshold = useConfigStore((state) => state.setBatchThreshold);
  const setHybridThreshold = useConfigStore((state) => state.setHybridThreshold);

  const [batchInput, setBatchInput] = useState(settlement.batchThreshold.toString());
  const [hybridInput, setHybridInput] = useState(settlement.hybridThreshold.toString());

  const handleModeSelect = useCallback(
    (mode: SettlementMode) => {
      setSettlementMode(mode);
    },
    [setSettlementMode]
  );

  const handleBatchThresholdChange = useCallback(
    (text: string) => {
      setBatchInput(text);
      const value = parseInt(text, 10);
      if (!isNaN(value) && value > 0) {
        setBatchThreshold(value);
      }
    },
    [setBatchThreshold]
  );

  const handleHybridThresholdChange = useCallback(
    (text: string) => {
      setHybridInput(text);
      const value = parseInt(text, 10);
      if (!isNaN(value) && value > 0) {
        setHybridThreshold(value);
      }
    },
    [setHybridThreshold]
  );

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      {/* Back Button */}
      <Pressable onPress={() => router.back()} style={styles.backButton}>
        <Ionicons name="chevron-back" size={28} color="#fff" />
      </Pressable>

      <ScrollView style={styles.scrollView}>
        {/* Settlement Mode Selection */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Settlement Mode</Text>

          {SETTLEMENT_MODES.map(({ mode, title, description }) => (
            <Pressable
              key={mode}
              style={[
                styles.modeItem,
                settlement.mode === mode && styles.modeItemSelected,
              ]}
              onPress={() => handleModeSelect(mode)}
            >
              <View style={styles.modeRadio}>
                <View
                  style={[
                    styles.radioOuter,
                    settlement.mode === mode && styles.radioOuterSelected,
                  ]}
                >
                  {settlement.mode === mode && <View style={styles.radioInner} />}
                </View>
              </View>
              <View style={styles.modeInfo}>
                <Text style={styles.modeTitle}>{title}</Text>
                <Text style={styles.modeDescription}>{description}</Text>
              </View>
            </Pressable>
          ))}
        </View>

        {/* Batch Settings */}
        {(settlement.mode === 'batched' || settlement.mode === 'hybrid') && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Batch Settings</Text>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Batch Threshold (sats)</Text>
              <Text style={styles.inputDescription}>
                Trigger batch settlement when accumulated tokens reach this amount
              </Text>
              <TextInput
                style={styles.input}
                value={batchInput}
                onChangeText={handleBatchThresholdChange}
                keyboardType="number-pad"
                placeholder="100000"
                placeholderTextColor="#555"
              />
            </View>
          </View>
        )}

        {/* Hybrid Settings */}
        {settlement.mode === 'hybrid' && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Hybrid Settings</Text>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Instant Threshold (sats)</Text>
              <Text style={styles.inputDescription}>
                Payments above this amount are settled instantly
              </Text>
              <TextInput
                style={styles.input}
                value={hybridInput}
                onChangeText={handleHybridThresholdChange}
                keyboardType="number-pad"
                placeholder="50000"
                placeholderTextColor="#555"
              />
            </View>
          </View>
        )}

        {/* Settlement Info */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Information</Text>

          <View style={styles.infoBox}>
            <Text style={styles.infoTitle}>About Settlement</Text>
            <Text style={styles.infoText}>
              Settlement refers to converting received Cashu tokens into your
              preferred form (Lightning or on-chain Bitcoin). Each swap may incur
              a small fee from the mint.
            </Text>
          </View>

          <View style={styles.infoBox}>
            <Text style={styles.infoTitle}>Fee Considerations</Text>
            <Text style={styles.infoText}>
              • Instant: Higher total fees, immediate access{'\n'}
              • Batched: Lower fees, delayed access{'\n'}
              • Hybrid: Optimized balance{'\n'}
              • Manual: Full control, requires attention
            </Text>
          </View>
        </View>

        {/* Pending Settlement */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Pending Settlement</Text>

          <View style={styles.pendingBox}>
            <View style={styles.pendingRow}>
              <Text style={styles.pendingLabel}>Unsettled Tokens</Text>
              <Text style={styles.pendingValue}>0 sats</Text>
            </View>
            <View style={styles.pendingRow}>
              <Text style={styles.pendingLabel}>Pending Swaps</Text>
              <Text style={styles.pendingValue}>0</Text>
            </View>
          </View>

          <Pressable style={styles.settleButton} disabled>
            <Text style={styles.settleButtonText}>Settle Now</Text>
          </Pressable>
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
  modeItem: {
    flexDirection: 'row',
    backgroundColor: '#1a1a2e',
    padding: 16,
    borderRadius: 8,
    marginBottom: 8,
  },
  modeItemSelected: {
    backgroundColor: '#2a3a2e',
    borderWidth: 1,
    borderColor: '#4ade80',
  },
  modeRadio: {
    marginRight: 12,
    paddingTop: 2,
  },
  radioOuter: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#555',
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioOuterSelected: {
    borderColor: '#4ade80',
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#4ade80',
  },
  modeInfo: {
    flex: 1,
  },
  modeTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 4,
  },
  modeDescription: {
    fontSize: 14,
    color: '#888',
    lineHeight: 20,
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
  infoBox: {
    backgroundColor: '#1a1a2e',
    padding: 16,
    borderRadius: 8,
    marginBottom: 12,
  },
  infoTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 8,
  },
  infoText: {
    fontSize: 14,
    color: '#888',
    lineHeight: 20,
  },
  pendingBox: {
    backgroundColor: '#1a1a2e',
    padding: 16,
    borderRadius: 8,
    marginBottom: 16,
  },
  pendingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  pendingLabel: {
    fontSize: 16,
    color: '#888',
  },
  pendingValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
  },
  settleButton: {
    backgroundColor: '#2a2a3e',
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  settleButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#555',
  },
});

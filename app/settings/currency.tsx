/**
 * Currency Settings Screen
 *
 * Configure display currency and exchange rate preferences.
 */

import { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useConfigStore } from '../../src/store/config.store';

import { CURRENCIES } from '@/constants/currencies';

export default function CurrencySettingsScreen() {
  const currency = useConfigStore((state) => state.currency);
  const setDisplayCurrency = useConfigStore((state) => state.setDisplayCurrency);
  const setPriceDisplayMode = useConfigStore((state) => state.setPriceDisplayMode);
  const setSatsDisplayFormat = useConfigStore((state) => state.setSatsDisplayFormat);

  const handleCurrencySelect = useCallback(
    (currencyCode: string) => {
      setDisplayCurrency(currencyCode);
    },
    [setDisplayCurrency]
  );



  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView style={styles.scrollView}>
        {/* Display Options */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Display Options</Text>

          {/* Price Display Mode */}
          <View style={styles.settingGroup}>
            <Text style={styles.settingLabel}>Price Display</Text>
            <View style={styles.optionsRow}>
              <Pressable
                style={[
                  styles.optionButton,
                  currency.priceDisplayMode === 'fiat_sats' && styles.optionButtonActive,
                ]}
                onPress={() => setPriceDisplayMode('fiat_sats')}
              >
                <Text style={[
                  styles.optionText,
                  currency.priceDisplayMode === 'fiat_sats' && styles.optionTextActive
                ]}>Fiat (Sats)</Text>
              </Pressable>
              <Pressable
                style={[
                  styles.optionButton,
                  currency.priceDisplayMode === 'sats_fiat' && styles.optionButtonActive,
                ]}
                onPress={() => setPriceDisplayMode('sats_fiat')}
              >
                <Text style={[
                  styles.optionText,
                  currency.priceDisplayMode === 'sats_fiat' && styles.optionTextActive
                ]}>Sats (Fiat)</Text>
              </Pressable>
              <Pressable
                style={[
                  styles.optionButton,
                  currency.priceDisplayMode === 'sats_only' && styles.optionButtonActive,
                ]}
                onPress={() => setPriceDisplayMode('sats_only')}
              >
                <Text style={[
                  styles.optionText,
                  currency.priceDisplayMode === 'sats_only' && styles.optionTextActive
                ]}>Sats Only</Text>
              </Pressable>
            </View>
          </View>

          {/* Sats Format */}
          <View style={styles.settingGroup}>
            <Text style={styles.settingLabel}>Sats Format</Text>
            <View style={styles.optionsRow}>
              <Pressable
                style={[
                  styles.optionButton,
                  currency.satsDisplayFormat === 'sats' && styles.optionButtonActive,
                ]}
                onPress={() => setSatsDisplayFormat('sats')}
              >
                <Text style={[
                  styles.optionText,
                  currency.satsDisplayFormat === 'sats' && styles.optionTextActive
                ]}>123 sats</Text>
              </Pressable>
              <Pressable
                style={[
                  styles.optionButton,
                  currency.satsDisplayFormat === 'btc' && styles.optionButtonActive,
                ]}
                onPress={() => setSatsDisplayFormat('btc')}
              >
                <Text style={[
                  styles.optionText,
                  currency.satsDisplayFormat === 'btc' && styles.optionTextActive
                ]}>₿123</Text>
              </Pressable>
            </View>
          </View>
        </View>

        {/* Currency Selection */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Display Currency</Text>

          {CURRENCIES.map((curr) => (
            <Pressable
              key={curr.code}
              style={[
                styles.currencyItem,
                currency.displayCurrency === curr.code && styles.currencyItemSelected,
              ]}
              onPress={() => handleCurrencySelect(curr.code)}
            >
              <View style={styles.currencyInfo}>
                <Text style={styles.currencyCode}>{curr.code}</Text>
                <Text style={styles.currencyName}>{curr.name}</Text>
              </View>
              <Text style={styles.currencySymbol}>{curr.symbol}</Text>
              {currency.displayCurrency === curr.code && (
                <View style={styles.checkmark}>
                  <Text style={styles.checkmarkText}>✓</Text>
                </View>
              )}
            </Pressable>
          ))}
        </View>

        {/* Exchange Rate Info */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Exchange Rate</Text>

          <View style={styles.infoBox}>
            <Text style={styles.infoText}>
              Exchange rates are fetched from CoinGecko and cached for 60 seconds.
              Rates are used for display purposes only - actual payments are in
              satoshis.
            </Text>
          </View>

          <View style={styles.rateInfo}>
            <Text style={styles.rateLabel}>Current Rate</Text>
            <Text style={styles.rateValue}>
              {currency.exchangeRate
                ? `1 BTC = ${currency.exchangeRate.toLocaleString()} ${currency.displayCurrency}`
                : 'Loading...'}
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
  settingGroup: {
    marginBottom: 20,
  },
  settingLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#ffffff',
    marginBottom: 12,
  },
  optionsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  optionButton: {
    flex: 1,
    backgroundColor: '#1a1a2e',
    borderWidth: 1,
    borderColor: '#2a2a3e',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  optionButtonActive: {
    backgroundColor: 'rgba(74, 222, 128, 0.1)',
    borderColor: '#4ade80',
  },
  optionText: {
    fontSize: 14,
    color: '#888',
  },
  optionTextActive: {
    color: '#4ade80',
    fontWeight: '600',
  },
  currencyItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a2e',
    padding: 16,
    borderRadius: 8,
    marginBottom: 8,
  },
  currencyItemSelected: {
    backgroundColor: '#2a3a2e',
    borderWidth: 1,
    borderColor: '#4ade80',
  },
  currencyInfo: {
    flex: 1,
  },
  currencyCode: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
  },
  currencyName: {
    fontSize: 14,
    color: '#888',
    marginTop: 2,
  },
  currencySymbol: {
    fontSize: 18,
    color: '#888',
    marginRight: 12,
    width: 40,
    textAlign: 'right',
  },
  checkmark: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#4ade80',
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkmarkText: {
    color: '#0f0f1a',
    fontSize: 14,
    fontWeight: '700',
  },
  infoBox: {
    backgroundColor: '#1a1a2e',
    padding: 16,
    borderRadius: 8,
    marginBottom: 16,
  },
  infoText: {
    fontSize: 14,
    color: '#888',
    lineHeight: 20,
  },
  rateInfo: {
    backgroundColor: '#1a1a2e',
    padding: 16,
    borderRadius: 8,
  },
  rateLabel: {
    fontSize: 14,
    color: '#888',
    marginBottom: 4,
  },
  rateValue: {
    fontSize: 18,
    fontWeight: '600',
    color: '#ffffff',
  },
});

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

const CURRENCIES = [
  { code: 'USD', name: 'US Dollar', symbol: '$' },
  { code: 'EUR', name: 'Euro', symbol: '€' },
  { code: 'GBP', name: 'British Pound', symbol: '£' },
  { code: 'JPY', name: 'Japanese Yen', symbol: '¥' },
  { code: 'CHF', name: 'Swiss Franc', symbol: 'CHF' },
  { code: 'CAD', name: 'Canadian Dollar', symbol: 'CA$' },
  { code: 'AUD', name: 'Australian Dollar', symbol: 'A$' },
  { code: 'MXN', name: 'Mexican Peso', symbol: 'MX$' },
  { code: 'BRL', name: 'Brazilian Real', symbol: 'R$' },
];

export default function CurrencySettingsScreen() {
  const currency = useConfigStore((state) => state.currency);
  const setDisplayCurrency = useConfigStore((state) => state.setDisplayCurrency);
  const setShowSatsBelow = useConfigStore((state) => state.setShowSatsBelow);

  const handleCurrencySelect = useCallback(
    (currencyCode: string) => {
      setDisplayCurrency(currencyCode);
    },
    [setDisplayCurrency]
  );

  const handleToggleSats = useCallback(
    (value: boolean) => {
      setShowSatsBelow(value);
    },
    [setShowSatsBelow]
  );

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView style={styles.scrollView}>
        {/* Display Options */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Display Options</Text>

          <View style={styles.toggleRow}>
            <View style={styles.toggleInfo}>
              <Text style={styles.toggleLabel}>Show Sats Below Price</Text>
              <Text style={styles.toggleDescription}>
                Display satoshi equivalent under fiat amounts
              </Text>
            </View>
            <Switch
              value={currency.showSatsBelow}
              onValueChange={handleToggleSats}
              trackColor={{ false: '#2a2a3e', true: '#4ade80' }}
              thumbColor="#ffffff"
            />
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

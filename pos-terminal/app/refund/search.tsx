/**
 * Refund Search Screen
 *
 * Find a transaction to refund by searching or browsing recent transactions.
 */

import { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  TextInput,
  FlatList,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { usePaymentStore } from '../../src/store/payment.store';
import { formatFiat, formatSats } from '../../src/services/exchange-rate.service';
import type { Payment } from '../../src/types/payment';

type SearchFilter = 'all' | 'today' | 'week';

export default function RefundSearchScreen() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState<SearchFilter>('all');

  const recentPayments = usePaymentStore((state) => state.recentPayments);

  // Filter payments that can be refunded (completed only)
  const refundablePayments = useMemo(() => {
    let filtered = recentPayments.filter(
      (p) => p.state === 'completed' && p.transactionId
    );

    // Apply search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      filtered = filtered.filter(
        (p) =>
          p.transactionId?.toLowerCase().includes(query) ||
          p.id.toLowerCase().includes(query) ||
          p.memo?.toLowerCase().includes(query) ||
          p.fiatAmount.toString().includes(query) ||
          p.satsAmount.toString().includes(query)
      );
    }

    // Apply date filter
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfWeek = new Date(startOfToday);
    startOfWeek.setDate(startOfWeek.getDate() - 7);

    if (filter === 'today') {
      filtered = filtered.filter((p) => p.createdAt >= startOfToday);
    } else if (filter === 'week') {
      filtered = filtered.filter((p) => p.createdAt >= startOfWeek);
    }

    return filtered;
  }, [recentPayments, searchQuery, filter]);

  const handleSelectTransaction = useCallback(
    (payment: Payment) => {
      if (payment.transactionId) {
        router.push(`/refund/${payment.transactionId}`);
      }
    },
    [router]
  );

  const renderPaymentItem = useCallback(
    ({ item }: { item: Payment }) => {
      const formattedDate = item.createdAt.toLocaleDateString();
      const formattedTime = item.createdAt.toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
      });

      return (
        <Pressable
          style={({ pressed }) => [
            styles.paymentItem,
            pressed && styles.paymentItemPressed,
          ]}
          onPress={() => handleSelectTransaction(item)}
        >
          <View style={styles.paymentMain}>
            <View style={styles.paymentInfo}>
              <Text style={styles.paymentAmount}>
                {formatFiat(item.fiatAmount, item.fiatCurrency)}
              </Text>
              <Text style={styles.paymentSats}>{formatSats(item.satsAmount)}</Text>
            </View>

            <View style={styles.paymentMeta}>
              <Text style={styles.paymentDate}>{formattedDate}</Text>
              <Text style={styles.paymentTime}>{formattedTime}</Text>
            </View>
          </View>

          {item.memo && (
            <Text style={styles.paymentMemo} numberOfLines={1}>
              {item.memo}
            </Text>
          )}

          <View style={styles.paymentFooter}>
            <Text style={styles.paymentId}>
              ID: {item.transactionId?.slice(0, 12)}...
            </Text>
            <View style={styles.refundIndicator}>
              <Text style={styles.refundIndicatorText}>Tap to refund</Text>
            </View>
          </View>
        </Pressable>
      );
    },
    [handleSelectTransaction]
  );

  const renderEmptyList = useCallback(() => {
    if (searchQuery) {
      return (
        <View style={styles.emptyState}>
          <Text style={styles.emptyStateIcon}>🔍</Text>
          <Text style={styles.emptyStateTitle}>No Results</Text>
          <Text style={styles.emptyStateText}>
            No transactions match your search.{'\n'}
            Try a different search term.
          </Text>
        </View>
      );
    }

    return (
      <View style={styles.emptyState}>
        <Text style={styles.emptyStateIcon}>📋</Text>
        <Text style={styles.emptyStateTitle}>No Transactions</Text>
        <Text style={styles.emptyStateText}>
          No refundable transactions found.{'\n'}
          Completed payments will appear here.
        </Text>
      </View>
    );
  }, [searchQuery]);

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        {/* Search Input */}
        <View style={styles.searchContainer}>
          <View style={styles.searchInputWrapper}>
            <Text style={styles.searchIcon}>🔍</Text>
            <TextInput
              style={styles.searchInput}
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Search by ID, amount, or memo"
              placeholderTextColor="#555"
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="search"
            />
            {searchQuery.length > 0 && (
              <Pressable
                style={styles.clearButton}
                onPress={() => setSearchQuery('')}
              >
                <Text style={styles.clearButtonText}>✕</Text>
              </Pressable>
            )}
          </View>
        </View>

        {/* Filter Tabs */}
        <View style={styles.filterContainer}>
          {(['all', 'today', 'week'] as SearchFilter[]).map((f) => (
            <Pressable
              key={f}
              style={[styles.filterTab, filter === f && styles.filterTabActive]}
              onPress={() => setFilter(f)}
            >
              <Text
                style={[
                  styles.filterTabText,
                  filter === f && styles.filterTabTextActive,
                ]}
              >
                {f === 'all' ? 'All' : f === 'today' ? 'Today' : 'This Week'}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* Results Count */}
        <View style={styles.resultsHeader}>
          <Text style={styles.resultsCount}>
            {refundablePayments.length} transaction
            {refundablePayments.length !== 1 ? 's' : ''} found
          </Text>
        </View>

        {/* Transaction List */}
        <FlatList
          data={refundablePayments}
          renderItem={renderPaymentItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          ListEmptyComponent={renderEmptyList}
          showsVerticalScrollIndicator={false}
        />

        {/* Manual Entry Option */}
        <View style={styles.manualEntryContainer}>
          <Text style={styles.manualEntryLabel}>Have a transaction ID?</Text>
          <Pressable
            style={styles.manualEntryButton}
            onPress={() => {
              if (searchQuery.startsWith('tx_') || searchQuery.startsWith('pay_')) {
                router.push(`/refund/${searchQuery}`);
              }
            }}
            disabled={!searchQuery.startsWith('tx_') && !searchQuery.startsWith('pay_')}
          >
            <Text
              style={[
                styles.manualEntryButtonText,
                (!searchQuery.startsWith('tx_') && !searchQuery.startsWith('pay_')) &&
                  styles.manualEntryButtonTextDisabled,
              ]}
            >
              Go to Transaction
            </Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f0f1a',
  },
  keyboardView: {
    flex: 1,
  },
  searchContainer: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#2a2a3e',
  },
  searchInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a2e',
    borderRadius: 12,
    paddingHorizontal: 16,
  },
  searchIcon: {
    fontSize: 16,
    marginRight: 12,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 14,
    fontSize: 16,
    color: '#ffffff',
  },
  clearButton: {
    padding: 8,
  },
  clearButtonText: {
    color: '#888',
    fontSize: 16,
  },
  filterContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
  },
  filterTab: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#1a1a2e',
  },
  filterTabActive: {
    backgroundColor: '#4ade80',
  },
  filterTabText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#888',
  },
  filterTabTextActive: {
    color: '#0f0f1a',
  },
  resultsHeader: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  resultsCount: {
    fontSize: 14,
    color: '#888',
  },
  listContent: {
    padding: 16,
    flexGrow: 1,
  },
  paymentItem: {
    backgroundColor: '#1a1a2e',
    borderRadius: 12,
    padding: 16,
  },
  paymentItemPressed: {
    backgroundColor: '#2a2a3e',
  },
  paymentMain: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  paymentInfo: {},
  paymentAmount: {
    fontSize: 20,
    fontWeight: '700',
    color: '#ffffff',
  },
  paymentSats: {
    fontSize: 14,
    color: '#4ade80',
    marginTop: 2,
  },
  paymentMeta: {
    alignItems: 'flex-end',
  },
  paymentDate: {
    fontSize: 14,
    color: '#888',
  },
  paymentTime: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  paymentMemo: {
    fontSize: 14,
    color: '#888',
    marginBottom: 8,
  },
  paymentFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#2a2a3e',
  },
  paymentId: {
    fontSize: 12,
    color: '#666',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  refundIndicator: {
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  refundIndicatorText: {
    fontSize: 12,
    color: '#ef4444',
    fontWeight: '500',
  },
  separator: {
    height: 12,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyStateIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyStateTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: 8,
  },
  emptyStateText: {
    fontSize: 16,
    color: '#888',
    textAlign: 'center',
    lineHeight: 24,
  },
  manualEntryContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: '#1a1a2e',
    borderTopWidth: 1,
    borderTopColor: '#2a2a3e',
  },
  manualEntryLabel: {
    fontSize: 14,
    color: '#888',
  },
  manualEntryButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#2a2a3e',
  },
  manualEntryButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#4ade80',
  },
  manualEntryButtonTextDisabled: {
    color: '#555',
  },
});

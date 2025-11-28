/**
 * Transaction History Screen
 *
 * Displays recent transactions with filtering.
 */

import { useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Link, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { usePaymentStore } from '../../src/store/payment.store';
import { useConfigStore } from '../../src/store/config.store';
import { PriceDisplay } from '@/components/common/PriceDisplay';
import { getCurrencySymbol } from '@/constants/currencies';
import type { Payment } from '../../src/types/payment';

export default function HistoryScreen() {
  const router = useRouter();
  const recentPayments = usePaymentStore((state) => state.recentPayments);
  const currency = useConfigStore((state) => state.currency);

  const handleRefund = useCallback((payment: Payment) => {
    if (payment.transactionId) {
      router.push(`/refund/${payment.transactionId}`);
    }
  }, [router]);

  const renderPaymentItem = ({ item }: { item: Payment }) => {
    const isSuccess = item.state === 'completed';
    const statusColor = isSuccess ? '#4ade80' : '#ef4444';
    const statusText = isSuccess ? 'Completed' : 'Failed';
    const canRefund = isSuccess && item.transactionId;

    return (
      <View style={styles.paymentItem}>
        <View style={styles.paymentContent}>
          <View style={styles.paymentLeft}>
            <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
            <View style={styles.paymentInfo}>
              <PriceDisplay
                fiatAmount={item.fiatAmount}
                satsAmount={item.satsAmount}
                currencySymbol={getCurrencySymbol(item.fiatCurrency)}
                fiatStyle={styles.paymentAmount}
                satsStyle={styles.paymentSats}
                showSats={true}
              />
            </View>
          </View>

          <View style={styles.paymentRight}>
            <Text style={[styles.paymentStatus, { color: statusColor }]}>
              {statusText}
            </Text>
            <Text style={styles.paymentTime}>
              {item.createdAt.toLocaleTimeString()}
            </Text>
          </View>
        </View>

        {canRefund && (
          <Pressable
            style={styles.refundButton}
            onPress={() => handleRefund(item)}
          >
            <Text style={styles.refundButtonText}>Refund</Text>
          </Pressable>
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      {/* Back Button */}
      <Pressable onPress={() => router.back()} style={styles.backButton}>
        <Ionicons name="chevron-back" size={28} color="#fff" />
      </Pressable>

      {/* Refund Search Link */}
      <View style={styles.headerActions}>
        <Link href="/refund/search" asChild>
          <Pressable style={styles.searchRefundButton}>
            <Text style={styles.searchRefundIcon}>🔍</Text>
            <Text style={styles.searchRefundText}>Find Transaction to Refund</Text>
          </Pressable>
        </Link>
      </View>

      {recentPayments.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyStateIcon}>📋</Text>
          <Text style={styles.emptyStateTitle}>No Transactions Yet</Text>
          <Text style={styles.emptyStateText}>
            Your recent transactions will appear here.
          </Text>
        </View>
      ) : (
        <FlatList
          data={recentPayments}
          renderItem={renderPaymentItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
        />
      )}
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
  headerActions: {
    padding: 16,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#2a2a3e',
  },
  searchRefundButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a2e',
    padding: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#2a2a3e',
  },
  searchRefundIcon: {
    fontSize: 16,
    marginRight: 10,
  },
  searchRefundText: {
    fontSize: 15,
    fontWeight: '500',
    color: '#888',
  },
  listContent: {
    padding: 20,
  },
  paymentItem: {
    backgroundColor: '#1a1a2e',
    padding: 16,
    borderRadius: 8,
  },
  paymentContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  paymentLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 12,
  },
  paymentInfo: {},
  paymentAmount: {
    fontSize: 18,
    fontWeight: '600',
    color: '#ffffff',
  },
  paymentSats: {
    fontSize: 14,
    color: '#888',
    marginTop: 2,
    fontWeight: '500',
  },
  paymentRight: {
    alignItems: 'flex-end',
  },
  paymentStatus: {
    fontSize: 14,
    fontWeight: '500',
  },
  paymentTime: {
    fontSize: 12,
    color: '#888',
    marginTop: 2,
  },
  separator: {
    height: 12,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
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
  },
  refundButton: {
    marginTop: 12,
    paddingVertical: 10,
    paddingHorizontal: 16,
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderRadius: 8,
    alignSelf: 'flex-end',
  },
  refundButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ef4444',
  },
});

/**
 * Refund Transaction Screen
 *
 * Process a refund for a specific transaction.
 */

import { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  TextInput,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import QRCode from 'react-native-qrcode-svg';

import { useAlert } from '../../src/hooks/useAlert';
import { usePaymentStore } from '../../src/store/payment.store';
import { useConfigStore } from '../../src/store/config.store';
import { formatFiat, formatSats } from '../../src/services/exchange-rate.service';
import { refundService, type Refund } from '../../src/services/refund.service';
import { PriceDisplay } from '@/components/common/PriceDisplay';
import { getCurrencySymbol } from '@/constants/currencies';
import type { Payment } from '../../src/types/payment';

type RefundType = 'full' | 'partial';

interface RefundReason {
  code: string;
  label: string;
  requiresApproval: boolean;
}

const REFUND_REASONS: RefundReason[] = [
  { code: 'ITEM_RETURNED', label: 'Item Returned', requiresApproval: false },
  { code: 'WRONG_ITEM', label: 'Wrong Item Provided', requiresApproval: false },
  { code: 'QUALITY_ISSUE', label: 'Quality/Defect Issue', requiresApproval: false },
  { code: 'DUPLICATE_CHARGE', label: 'Duplicate Charge', requiresApproval: false },
  { code: 'PRICE_ADJUSTMENT', label: 'Price Adjustment', requiresApproval: true },
  { code: 'CUSTOMER_SATISFACTION', label: 'Customer Satisfaction', requiresApproval: true },
  { code: 'OTHER', label: 'Other', requiresApproval: true },
];

export default function RefundTransactionScreen() {
  const router = useRouter();
  const { txId } = useLocalSearchParams<{ txId: string }>();
  const { error: showError } = useAlert();

  const [isLoading, setIsLoading] = useState(false);
  const [refundType, setRefundType] = useState<RefundType>('full');
  const [partialAmount, setPartialAmount] = useState('');
  const [selectedReason, setSelectedReason] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const [showPinInput, setShowPinInput] = useState(false);
  const [pin, setPin] = useState('');
  const [completedRefund, setCompletedRefund] = useState<Refund | null>(null);
  const [qrCodeData, setQrCodeData] = useState<string | null>(null);

  const recentPayments = usePaymentStore((state) => state.recentPayments);
  const security = useConfigStore((state) => state.security);
  const currency = useConfigStore((state) => state.currency);

  // Find the transaction
  const transaction = useMemo(() => {
    return recentPayments.find(
      (p) => p.transactionId === txId || p.id === txId
    );
  }, [recentPayments, txId]);

  // Calculate refund amount
  const refundAmount = useMemo(() => {
    if (!transaction) return 0;
    if (refundType === 'full') return transaction.satsAmount;

    const partial = parseFloat(partialAmount);
    if (isNaN(partial) || partial <= 0) return 0;

    // Convert from fiat to sats if needed
    const satsAmount = Math.round(
      (partial / transaction.fiatAmount) * transaction.satsAmount
    );
    return Math.min(satsAmount, transaction.satsAmount);
  }, [transaction, refundType, partialAmount]);

  const refundFiatAmount = useMemo(() => {
    if (!transaction) return 0;
    if (refundType === 'full') return transaction.fiatAmount;

    const partial = parseFloat(partialAmount);
    if (isNaN(partial) || partial <= 0) return 0;
    return Math.min(partial, transaction.fiatAmount);
  }, [transaction, refundType, partialAmount]);

  // Check if approval is required
  const requiresApproval = useMemo(() => {
    const reason = REFUND_REASONS.find((r) => r.code === selectedReason);
    if (reason?.requiresApproval) return true;
    if (security.requirePinForRefunds) return true;
    return false;
  }, [selectedReason, security.requirePinForRefunds]);

  // Validation
  const canProceed = useMemo(() => {
    if (!transaction) return false;
    if (!selectedReason) return false;
    if (refundAmount <= 0) return false;
    if (selectedReason === 'OTHER' && !notes.trim()) return false;
    return true;
  }, [transaction, selectedReason, refundAmount, notes]);

  // Handle refund submission
  const handleProcessRefund = useCallback(async () => {
    if (!canProceed || !transaction || !selectedReason) return;

    if (requiresApproval && !showPinInput) {
      setShowPinInput(true);
      return;
    }

    if (requiresApproval && pin.length < 4) {
      showError('Error', 'Please enter your PIN');
      return;
    }

    setIsLoading(true);

    try {
      const result = await refundService.processRefund(
        {
          transactionId: txId || '',
          amount: refundAmount,
          reasonCode: selectedReason,
          notes,
          approverPin: requiresApproval ? pin : undefined,
        },
        transaction
      );

      if (result.success) {
        setCompletedRefund(result.refund);
        setQrCodeData(result.qrCodeData || null);
        setShowPinInput(false);
      } else {
        showError('Refund Failed', result.error || 'Failed to process refund');
      }
    } catch (error: any) {
      showError('Refund Failed', error.message || 'Failed to process refund');
    } finally {
      setIsLoading(false);
    }
  }, [
    canProceed,
    transaction,
    requiresApproval,
    showPinInput,
    pin,
    refundAmount,
    selectedReason,
    notes,
    txId,
  ]);

  // Handle not found
  if (!transaction) {
    return (
      <SafeAreaView style={styles.container} edges={['bottom']}>
        <View style={styles.notFoundContainer}>
          <Text style={styles.notFoundIcon}>🔍</Text>
          <Text style={styles.notFoundTitle}>Transaction Not Found</Text>
          <Text style={styles.notFoundText}>
            The transaction "{txId}" could not be found.
          </Text>
          <Pressable style={styles.backButton} onPress={() => router.back()}>
            <Text style={styles.backButtonText}>Go Back</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  // Show success screen with QR code
  if (completedRefund && qrCodeData) {
    return (
      <SafeAreaView style={styles.container} edges={['bottom']}>
        <View style={styles.successContainer}>
          <View style={styles.successIcon}>
            <Text style={styles.successIconText}>✓</Text>
          </View>

          <Text style={styles.successTitle}>Refund Processed</Text>
          <Text style={styles.successSubtitle}>
            Show this QR code to the customer to claim their refund
          </Text>

          <View style={styles.qrContainer}>
            <QRCode
              value={qrCodeData}
              size={200}
              backgroundColor="#ffffff"
              color="#000000"
            />
          </View>

          <View style={styles.refundDetails}>
            <View style={styles.refundDetailRow}>
              <Text style={styles.refundDetailLabel}>Amount</Text>
              <PriceDisplay
                fiatAmount={completedRefund.fiatAmount}
                satsAmount={completedRefund.refundedAmount}
                currencySymbol={getCurrencySymbol(completedRefund.fiatCurrency)}
                fiatStyle={styles.refundDetailValue}
                satsStyle={styles.refundDetailValueSats}
                showSats={true}
              />
            </View>
            {completedRefund.claimCode && (
              <View style={styles.refundDetailRow}>
                <Text style={styles.refundDetailLabel}>Claim Code</Text>
                <Text style={styles.claimCode}>{completedRefund.claimCode}</Text>
              </View>
            )}
            <View style={styles.refundDetailRow}>
              <Text style={styles.refundDetailLabel}>Expires</Text>
              <Text style={styles.refundDetailValue}>
                {completedRefund.expiresAt?.toLocaleString() || '24 hours'}
              </Text>
            </View>
          </View>

          <Text style={styles.instructionText}>
            Customer should scan this QR code with their Cashu wallet to receive the refund tokens.
          </Text>

          <Pressable
            style={styles.doneButton}
            onPress={() => router.replace('/')}
          >
            <Text style={styles.doneButtonText}>Done</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  // Show PIN input modal
  if (showPinInput) {
    return (
      <SafeAreaView style={styles.container} edges={['bottom']}>
        <View style={styles.pinContainer}>
          <Text style={styles.pinTitle}>Enter PIN to Approve</Text>
          <Text style={styles.pinSubtitle}>
            This refund requires manager approval
          </Text>

          <View style={styles.pinInputContainer}>
            <TextInput
              style={styles.pinInput}
              value={pin}
              onChangeText={setPin}
              placeholder="Enter PIN"
              placeholderTextColor="#555"
              keyboardType="number-pad"
              secureTextEntry
              maxLength={6}
              autoFocus
            />
          </View>

          <View style={styles.pinActions}>
            <Pressable
              style={styles.pinCancelButton}
              onPress={() => {
                setShowPinInput(false);
                setPin('');
              }}
            >
              <Text style={styles.pinCancelButtonText}>Cancel</Text>
            </Pressable>

            <Pressable
              style={[
                styles.pinApproveButton,
                (isLoading || pin.length < 4) && styles.pinApproveButtonDisabled,
              ]}
              onPress={handleProcessRefund}
              disabled={isLoading || pin.length < 4}
            >
              {isLoading ? (
                <ActivityIndicator size="small" color="#0f0f1a" />
              ) : (
                <Text style={styles.pinApproveButtonText}>Approve</Text>
              )}
            </Pressable>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Original Transaction */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Original Transaction</Text>

          <View style={styles.transactionCard}>
            <View style={styles.transactionRow}>
              <Text style={styles.transactionLabel}>Amount</Text>
              <View style={styles.transactionAmounts}>
                <PriceDisplay
                  fiatAmount={transaction.fiatAmount}
                  satsAmount={transaction.satsAmount}
                  currencySymbol={getCurrencySymbol(transaction.fiatCurrency)}
                  fiatStyle={styles.transactionFiat}
                  satsStyle={styles.transactionSats}
                  showSats={true}
                />
              </View>
            </View>

            <View style={styles.transactionRow}>
              <Text style={styles.transactionLabel}>Date</Text>
              <Text style={styles.transactionValue}>
                {transaction.createdAt.toLocaleDateString()}{' '}
                {transaction.createdAt.toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </Text>
            </View>

            <View style={styles.transactionRow}>
              <Text style={styles.transactionLabel}>Transaction ID</Text>
              <Text style={styles.transactionId}>
                {transaction.transactionId?.slice(0, 20)}...
              </Text>
            </View>

            {transaction.memo && (
              <View style={styles.transactionRow}>
                <Text style={styles.transactionLabel}>Memo</Text>
                <Text style={styles.transactionValue}>{transaction.memo}</Text>
              </View>
            )}

            <View style={styles.transactionRow}>
              <Text style={styles.transactionLabel}>Status</Text>
              <View style={styles.statusBadge}>
                <Text style={styles.statusBadgeText}>Completed</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Refund Type */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Refund Type</Text>

          <View style={styles.refundTypeContainer}>
            <Pressable
              style={[
                styles.refundTypeOption,
                refundType === 'full' && styles.refundTypeOptionSelected,
              ]}
              onPress={() => setRefundType('full')}
            >
              <View style={styles.radioOuter}>
                {refundType === 'full' && <View style={styles.radioInner} />}
              </View>
              <View style={styles.refundTypeInfo}>
                <Text style={styles.refundTypeLabel}>Full Refund</Text>
                <Text style={styles.refundTypeDescription}>
                  Refund the entire amount
                </Text>
              </View>
              <Text style={styles.refundTypeAmount}>
                {formatFiat(transaction.fiatAmount, transaction.fiatCurrency)}
              </Text>
            </Pressable>

            <Pressable
              style={[
                styles.refundTypeOption,
                refundType === 'partial' && styles.refundTypeOptionSelected,
              ]}
              onPress={() => setRefundType('partial')}
            >
              <View style={styles.radioOuter}>
                {refundType === 'partial' && <View style={styles.radioInner} />}
              </View>
              <View style={styles.refundTypeInfo}>
                <Text style={styles.refundTypeLabel}>Partial Refund</Text>
                <Text style={styles.refundTypeDescription}>
                  Refund a specific amount
                </Text>
              </View>
            </Pressable>
          </View>

          {/* Partial Amount Input */}
          {refundType === 'partial' && (
            <View style={styles.partialAmountContainer}>
              <Text style={styles.inputLabel}>Refund Amount</Text>
              <View style={styles.amountInputWrapper}>
                <Text style={styles.amountCurrency}>
                  {getCurrencySymbol(transaction.fiatCurrency)}
                </Text>
                <TextInput
                  style={styles.amountInput}
                  value={partialAmount}
                  onChangeText={setPartialAmount}
                  placeholder="0.00"
                  placeholderTextColor="#555"
                  keyboardType="decimal-pad"
                />
              </View>
              {refundAmount > 0 && (
                <Text style={styles.amountSats}>
                  {formatSats(refundAmount)}
                </Text>
              )}
              <Text style={styles.maxAmountHint}>
                Maximum: {formatFiat(transaction.fiatAmount, transaction.fiatCurrency)}
              </Text>
            </View>
          )}
        </View>

        {/* Refund Reason */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Reason for Refund</Text>

          {REFUND_REASONS.map((reason) => (
            <Pressable
              key={reason.code}
              style={[
                styles.reasonOption,
                selectedReason === reason.code && styles.reasonOptionSelected,
              ]}
              onPress={() => setSelectedReason(reason.code)}
            >
              <View style={styles.radioOuter}>
                {selectedReason === reason.code && <View style={styles.radioInner} />}
              </View>
              <Text style={styles.reasonLabel}>{reason.label}</Text>
              {reason.requiresApproval && (
                <View style={styles.approvalBadge}>
                  <Text style={styles.approvalBadgeText}>Requires Approval</Text>
                </View>
              )}
            </Pressable>
          ))}
        </View>

        {/* Notes */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            Notes {selectedReason === 'OTHER' && <Text style={styles.required}>*</Text>}
          </Text>
          <TextInput
            style={styles.notesInput}
            value={notes}
            onChangeText={setNotes}
            placeholder="Add notes about this refund..."
            placeholderTextColor="#555"
            multiline
            numberOfLines={3}
            textAlignVertical="top"
          />
        </View>

        {/* Refund Summary */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Refund Summary</Text>

          <View style={styles.summaryCard}>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Refund Amount</Text>
              <PriceDisplay
                fiatAmount={refundFiatAmount}
                satsAmount={refundAmount}
                currencySymbol={getCurrencySymbol(transaction.fiatCurrency)}
                fiatStyle={styles.summaryValue}
                satsStyle={styles.summaryValueSats}
                showSats={true}
              />
            </View>
            {requiresApproval && (
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Approval</Text>
                <Text style={styles.summaryWarning}>Required</Text>
              </View>
            )}
          </View>
        </View>
      </ScrollView>

      {/* Action Button */}
      <View style={styles.actionContainer}>
        <Pressable
          style={[
            styles.processButton,
            !canProceed && styles.processButtonDisabled,
          ]}
          onPress={handleProcessRefund}
          disabled={!canProceed || isLoading}
        >
          {isLoading ? (
            <ActivityIndicator size="small" color="#0f0f1a" />
          ) : (
            <Text style={styles.processButtonText}>
              {requiresApproval ? 'Request Approval' : 'Process Refund'}
            </Text>
          )}
        </Pressable>
      </View>
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
  required: {
    color: '#ef4444',
  },

  // Transaction Card
  transactionCard: {
    backgroundColor: '#1a1a2e',
    borderRadius: 12,
    padding: 16,
  },
  transactionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#2a2a3e',
  },
  transactionLabel: {
    fontSize: 14,
    color: '#888',
  },
  transactionAmounts: {
    alignItems: 'flex-end',
  },
  transactionFiat: {
    fontSize: 18,
    fontWeight: '700',
    color: '#ffffff',
  },
  transactionSats: {
    fontSize: 14,
    color: '#4ade80',
    marginTop: 2,
    fontWeight: '500',
  },
  transactionValue: {
    fontSize: 14,
    color: '#ffffff',
  },
  transactionId: {
    fontSize: 12,
    color: '#888',
    fontFamily: 'monospace',
  },
  statusBadge: {
    backgroundColor: '#2a3a2e',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusBadgeText: {
    fontSize: 12,
    color: '#4ade80',
    fontWeight: '500',
  },

  // Refund Type
  refundTypeContainer: {
    gap: 12,
  },
  refundTypeOption: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a2e',
    padding: 16,
    borderRadius: 12,
  },
  refundTypeOptionSelected: {
    backgroundColor: '#2a3a2e',
    borderWidth: 1,
    borderColor: '#4ade80',
  },
  radioOuter: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: '#555',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  radioInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#4ade80',
  },
  refundTypeInfo: {
    flex: 1,
  },
  refundTypeLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
  },
  refundTypeDescription: {
    fontSize: 14,
    color: '#888',
    marginTop: 2,
  },
  refundTypeAmount: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
  },

  // Partial Amount
  partialAmountContainer: {
    marginTop: 16,
    backgroundColor: '#1a1a2e',
    borderRadius: 12,
    padding: 16,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 8,
  },
  amountInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0f0f1a',
    borderRadius: 8,
    paddingHorizontal: 16,
  },
  amountCurrency: {
    fontSize: 24,
    color: '#888',
    marginRight: 8,
  },
  amountInput: {
    flex: 1,
    fontSize: 32,
    fontWeight: '700',
    color: '#ffffff',
    paddingVertical: 12,
  },
  amountSats: {
    fontSize: 16,
    color: '#4ade80',
    marginTop: 8,
  },
  maxAmountHint: {
    fontSize: 12,
    color: '#888',
    marginTop: 8,
  },

  // Reason
  reasonOption: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a2e',
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
  },
  reasonOptionSelected: {
    backgroundColor: '#2a3a2e',
    borderWidth: 1,
    borderColor: '#4ade80',
  },
  reasonLabel: {
    flex: 1,
    fontSize: 16,
    color: '#ffffff',
  },
  approvalBadge: {
    backgroundColor: 'rgba(245, 158, 11, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  approvalBadgeText: {
    fontSize: 10,
    color: '#f59e0b',
    fontWeight: '600',
  },

  // Notes
  notesInput: {
    backgroundColor: '#1a1a2e',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: '#ffffff',
    minHeight: 100,
  },

  // Summary
  summaryCard: {
    backgroundColor: '#1a1a2e',
    borderRadius: 12,
    padding: 16,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  summaryLabel: {
    fontSize: 16,
    color: '#888',
  },
  summaryValue: {
    fontSize: 20,
    fontWeight: '700',
    color: '#ffffff',
  },
  summaryValueSats: {
    fontSize: 16,
    color: '#4ade80',
    fontWeight: '500',
  },
  summaryWarning: {
    fontSize: 14,
    fontWeight: '600',
    color: '#f59e0b',
  },

  // Action
  actionContainer: {
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#2a2a3e',
  },
  processButton: {
    backgroundColor: '#ef4444',
    paddingVertical: 18,
    borderRadius: 12,
    alignItems: 'center',
  },
  processButtonDisabled: {
    backgroundColor: '#2a2a3e',
  },
  processButtonText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#ffffff',
  },

  // Not Found
  notFoundContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  notFoundIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  notFoundTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: 8,
  },
  notFoundText: {
    fontSize: 16,
    color: '#888',
    textAlign: 'center',
    marginBottom: 24,
  },
  backButton: {
    backgroundColor: '#1a1a2e',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  backButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
  },

  // PIN Entry
  pinContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  pinTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: 8,
  },
  pinSubtitle: {
    fontSize: 16,
    color: '#888',
    marginBottom: 32,
    textAlign: 'center',
  },
  pinInputContainer: {
    width: '100%',
    marginBottom: 32,
  },
  pinInput: {
    backgroundColor: '#1a1a2e',
    borderRadius: 12,
    paddingHorizontal: 24,
    paddingVertical: 16,
    fontSize: 24,
    fontWeight: '600',
    color: '#ffffff',
    textAlign: 'center',
    letterSpacing: 8,
  },
  pinActions: {
    flexDirection: 'row',
    gap: 16,
    width: '100%',
  },
  pinCancelButton: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 12,
    backgroundColor: '#2a2a3e',
    alignItems: 'center',
  },
  pinCancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#888',
  },
  pinApproveButton: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 12,
    backgroundColor: '#4ade80',
    alignItems: 'center',
  },
  pinApproveButtonDisabled: {
    backgroundColor: '#2a2a3e',
  },
  pinApproveButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0f0f1a',
  },

  // Success Screen
  successContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  successIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#4ade80',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  successIconText: {
    fontSize: 40,
    color: '#0f0f1a',
    fontWeight: '700',
  },
  successTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: 8,
  },
  successSubtitle: {
    fontSize: 16,
    color: '#888',
    textAlign: 'center',
    marginBottom: 32,
  },
  qrContainer: {
    backgroundColor: '#ffffff',
    padding: 20,
    borderRadius: 16,
    marginBottom: 24,
  },
  refundDetails: {
    width: '100%',
    backgroundColor: '#1a1a2e',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
  },
  refundDetailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  refundDetailLabel: {
    fontSize: 14,
    color: '#888',
  },
  refundDetailValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
  },
  refundDetailValueSats: {
    fontSize: 16,
    fontWeight: '600',
    color: '#4ade80',
  },
  claimCode: {
    fontSize: 18,
    fontWeight: '700',
    color: '#f59e0b',
    fontFamily: 'monospace',
    letterSpacing: 2,
  },
  instructionText: {
    fontSize: 14,
    color: '#888',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 20,
    paddingHorizontal: 16,
  },
  doneButton: {
    backgroundColor: '#4ade80',
    paddingVertical: 16,
    paddingHorizontal: 48,
    borderRadius: 12,
  },
  doneButtonText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#0f0f1a',
  },
});

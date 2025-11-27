/**
 * Checkout Screen
 *
 * Review order, add tip, and proceed to payment.
 * Integrates with existing Cashu payment flow.
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
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

import { useCartStore, useConfigStore, usePaymentStore } from '@/store';
import { DEFAULT_TIP_PRESETS } from '@/types/cart';
import type { OrderType } from '@/types/cart';
import {
  getExchangeRate,
  fiatToSats,
} from '@/services/exchange-rate.service';

// Format price from cents to display string
function formatPrice(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

// Order type options
const ORDER_TYPES: { value: OrderType; label: string; icon: string }[] = [
  { value: 'dine_in', label: 'Dine In', icon: '🍽️' },
  { value: 'takeout', label: 'Takeout', icon: '🥡' },
  { value: 'delivery', label: 'Delivery', icon: '🚗' },
];

export default function CheckoutScreen() {
  const router = useRouter();

  // Cart state
  const cart = useCartStore((s) => s.cart);
  const setTipAmount = useCartStore((s) => s.setTipAmount);
  const setTipPercentage = useCartStore((s) => s.setTipPercentage);
  const clearTip = useCartStore((s) => s.clearTip);
  const setOrderType = useCartStore((s) => s.setOrderType);
  const setNotes = useCartStore((s) => s.setNotes);
  const clearCart = useCartStore((s) => s.clearCart);

  // Config
  const tipsEnabled = useConfigStore((s) => s.currency); // TODO: Use actual tips config

  // Payment store
  const createPayment = usePaymentStore((s) => s.createPayment);

  // Config
  const currency = useConfigStore((s) => s.currency);

  // Local state
  const [selectedTipPreset, setSelectedTipPreset] = useState<number | null>(null);
  const [customTip, setCustomTip] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const cartTotals = cart.totals;

  // Handle tip preset selection
  const handleTipPreset = useCallback(
    (percentage: number) => {
      if (selectedTipPreset === percentage) {
        // Deselect
        clearTip();
        setSelectedTipPreset(null);
      } else {
        setTipPercentage(percentage);
        setSelectedTipPreset(percentage);
        setCustomTip('');
      }
    },
    [selectedTipPreset, setTipPercentage, clearTip]
  );

  // Handle custom tip
  const handleCustomTip = useCallback(
    (value: string) => {
      setCustomTip(value);
      setSelectedTipPreset(null);

      const amount = parseFloat(value);
      if (!isNaN(amount) && amount >= 0) {
        setTipAmount(Math.round(amount * 100)); // Convert to cents
      } else {
        clearTip();
      }
    },
    [setTipAmount, clearTip]
  );

  // Handle order type selection
  const handleOrderType = useCallback(
    (type: OrderType) => {
      setOrderType(type);
    },
    [setOrderType]
  );

  // Handle proceed to payment
  const handleProceedToPayment = useCallback(async () => {
    if (cart.items.length === 0) return;

    setIsLoading(true);
    try {
      // Convert cents to dollars for fiat amount
      const fiatAmount = cartTotals.total / 100;

      // Get exchange rate and convert to sats
      const rate = await getExchangeRate(currency.displayCurrency);
      const satsAmount = await fiatToSats(fiatAmount, currency.displayCurrency);

      // Build memo with order summary
      const itemsSummary = cart.items
        .map((item) => `${item.quantity}x ${item.product.name}`)
        .join(', ');

      // Create payment
      createPayment({
        satsAmount,
        fiatAmount,
        fiatCurrency: currency.displayCurrency,
        exchangeRate: rate.ratePerBtc,
        memo: `Order: ${itemsSummary}`,
      });

      // Navigate to payment screen
      router.push('/payment');
    } catch (error) {
      console.error('Failed to create payment:', error);
      // TODO: Show error toast
    } finally {
      setIsLoading(false);
    }
  }, [cart.items, cartTotals.total, currency.displayCurrency, createPayment, router]);

  // Handle order complete (called after successful payment)
  const handleOrderComplete = useCallback(() => {
    clearCart();
    router.replace('/');
  }, [clearCart, router]);

  if (cart.items.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>Your cart is empty</Text>
          <Pressable style={styles.backLink} onPress={() => router.back()}>
            <Text style={styles.backLinkText}>Go back to menu</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView style={styles.scrollContent}>
        {/* Order Type */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Order Type</Text>
          <View style={styles.orderTypeRow}>
            {ORDER_TYPES.map((type) => (
              <Pressable
                key={type.value}
                style={[
                  styles.orderTypeButton,
                  cart.orderType === type.value && styles.orderTypeButtonSelected,
                ]}
                onPress={() => handleOrderType(type.value)}
              >
                <Text style={styles.orderTypeIcon}>{type.icon}</Text>
                <Text
                  style={[
                    styles.orderTypeLabel,
                    cart.orderType === type.value && styles.orderTypeLabelSelected,
                  ]}
                >
                  {type.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        {/* Order Summary */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Order Summary</Text>
          {cart.items.map((item) => (
            <View key={item.id} style={styles.summaryItem}>
              <View style={styles.summaryItemLeft}>
                <Text style={styles.summaryItemQty}>{item.quantity}x</Text>
                <View style={styles.summaryItemInfo}>
                  <Text style={styles.summaryItemName}>
                    {item.product.name}
                    {item.variant && ` (${item.variant.name})`}
                  </Text>
                  {item.selectedModifiers.length > 0 && (
                    <Text style={styles.summaryItemMods}>
                      {item.selectedModifiers.map((m) => m.modifier.name).join(', ')}
                    </Text>
                  )}
                  {item.notes && (
                    <Text style={styles.summaryItemNotes}>Note: {item.notes}</Text>
                  )}
                </View>
              </View>
              <Text style={styles.summaryItemPrice}>{formatPrice(item.subtotal)}</Text>
            </View>
          ))}
        </View>

        {/* Add Tip */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Add Tip</Text>
          <View style={styles.tipPresets}>
            {DEFAULT_TIP_PRESETS.map((preset) => (
              <Pressable
                key={preset.percentage}
                style={[
                  styles.tipButton,
                  selectedTipPreset === preset.percentage && styles.tipButtonSelected,
                ]}
                onPress={() => handleTipPreset(preset.percentage)}
              >
                <Text
                  style={[
                    styles.tipButtonText,
                    selectedTipPreset === preset.percentage && styles.tipButtonTextSelected,
                  ]}
                >
                  {preset.label}
                </Text>
                <Text
                  style={[
                    styles.tipAmount,
                    selectedTipPreset === preset.percentage && styles.tipAmountSelected,
                  ]}
                >
                  {formatPrice(Math.round(cartTotals.subtotal * (preset.percentage / 100)))}
                </Text>
              </Pressable>
            ))}
          </View>

          <View style={styles.customTipRow}>
            <Text style={styles.customTipLabel}>Custom:</Text>
            <View style={styles.customTipInput}>
              <Text style={styles.currencySymbol}>$</Text>
              <TextInput
                style={styles.customTipField}
                placeholder="0.00"
                placeholderTextColor="#666"
                value={customTip}
                onChangeText={handleCustomTip}
                keyboardType="decimal-pad"
              />
            </View>
          </View>
        </View>

        {/* Order Notes */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Order Notes</Text>
          <TextInput
            style={styles.notesInput}
            placeholder="Add special instructions..."
            placeholderTextColor="#666"
            value={cart.notes || ''}
            onChangeText={setNotes}
            multiline
            numberOfLines={2}
          />
        </View>

        {/* Totals */}
        <View style={styles.totalsSection}>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Subtotal</Text>
            <Text style={styles.totalValue}>{formatPrice(cartTotals.subtotal)}</Text>
          </View>

          {cartTotals.discountTotal > 0 && (
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Discount</Text>
              <Text style={[styles.totalValue, styles.discountValue]}>
                -{formatPrice(cartTotals.discountTotal)}
              </Text>
            </View>
          )}

          {cartTotals.taxTotal > 0 && (
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Tax</Text>
              <Text style={styles.totalValue}>{formatPrice(cartTotals.taxTotal)}</Text>
            </View>
          )}

          {cartTotals.tipAmount > 0 && (
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Tip</Text>
              <Text style={styles.totalValue}>{formatPrice(cartTotals.tipAmount)}</Text>
            </View>
          )}

          <View style={[styles.totalRow, styles.grandTotalRow]}>
            <Text style={styles.grandTotalLabel}>Total</Text>
            <Text style={styles.grandTotalValue}>{formatPrice(cartTotals.total)}</Text>
          </View>
        </View>
      </ScrollView>

      {/* Charge Button */}
      <View style={styles.footer}>
        <Pressable
          style={[styles.chargeButton, isLoading && styles.chargeButtonDisabled]}
          onPress={handleProceedToPayment}
          disabled={isLoading}
        >
          <Text style={styles.chargeButtonText}>
            {isLoading ? 'Processing...' : `Charge ${formatPrice(cartTotals.total)}`}
          </Text>
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
  scrollContent: {
    flex: 1,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    color: '#888',
    fontSize: 18,
    marginBottom: 16,
  },
  backLink: {
    padding: 12,
  },
  backLinkText: {
    color: '#4ade80',
    fontSize: 16,
  },
  section: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#2a2a3e',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 16,
  },
  orderTypeRow: {
    flexDirection: 'row',
    gap: 12,
  },
  orderTypeButton: {
    flex: 1,
    backgroundColor: '#1a1a2e',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#2a2a3e',
  },
  orderTypeButtonSelected: {
    backgroundColor: '#4ade80',
    borderColor: '#4ade80',
  },
  orderTypeIcon: {
    fontSize: 24,
    marginBottom: 4,
  },
  orderTypeLabel: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },
  orderTypeLabelSelected: {
    color: '#0f0f1a',
  },
  summaryItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#2a2a3e',
  },
  summaryItemLeft: {
    flex: 1,
    flexDirection: 'row',
  },
  summaryItemQty: {
    color: '#888',
    fontSize: 14,
    fontWeight: '600',
    width: 30,
  },
  summaryItemInfo: {
    flex: 1,
  },
  summaryItemName: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },
  summaryItemMods: {
    color: '#666',
    fontSize: 12,
    marginTop: 2,
  },
  summaryItemNotes: {
    color: '#f59e0b',
    fontSize: 12,
    marginTop: 4,
    fontStyle: 'italic',
  },
  summaryItemPrice: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 12,
  },
  tipPresets: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
  },
  tipButton: {
    flex: 1,
    backgroundColor: '#1a1a2e',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#2a2a3e',
  },
  tipButtonSelected: {
    backgroundColor: '#4ade80',
    borderColor: '#4ade80',
  },
  tipButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  tipButtonTextSelected: {
    color: '#0f0f1a',
  },
  tipAmount: {
    color: '#888',
    fontSize: 12,
    marginTop: 2,
  },
  tipAmountSelected: {
    color: '#0f0f1a',
    opacity: 0.7,
  },
  customTipRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  customTipLabel: {
    color: '#888',
    fontSize: 14,
    marginRight: 12,
  },
  customTipInput: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a2e',
    borderRadius: 8,
    paddingHorizontal: 12,
  },
  currencySymbol: {
    color: '#888',
    fontSize: 16,
    marginRight: 4,
  },
  customTipField: {
    flex: 1,
    color: '#fff',
    fontSize: 16,
    paddingVertical: 12,
  },
  notesInput: {
    backgroundColor: '#1a1a2e',
    borderRadius: 8,
    padding: 16,
    color: '#fff',
    fontSize: 14,
    minHeight: 60,
    textAlignVertical: 'top',
  },
  totalsSection: {
    padding: 20,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  totalLabel: {
    color: '#888',
    fontSize: 16,
  },
  totalValue: {
    color: '#fff',
    fontSize: 16,
  },
  discountValue: {
    color: '#4ade80',
  },
  grandTotalRow: {
    marginTop: 8,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#2a2a3e',
  },
  grandTotalLabel: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '700',
  },
  grandTotalValue: {
    color: '#4ade80',
    fontSize: 24,
    fontWeight: '700',
  },
  footer: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#2a2a3e',
  },
  chargeButton: {
    backgroundColor: '#4ade80',
    paddingVertical: 18,
    borderRadius: 12,
    alignItems: 'center',
  },
  chargeButtonDisabled: {
    backgroundColor: '#2a2a3e',
  },
  chargeButtonText: {
    color: '#0f0f1a',
    fontSize: 20,
    fontWeight: '700',
  },
});

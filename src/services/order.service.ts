/**
 * Order Service
 *
 * Handles order creation, persistence, and management.
 * Links orders with tables, waiters, and payments.
 */

import { databaseService, type Transaction } from './database.service';
import type { Cart } from '@/types/cart';
import type { Payment } from '@/types/payment';

export interface OrderMetadata {
  orderType: string;
  tableId?: string;
  tableName?: string;
  areaId?: string;
  areaName?: string;
  staffId?: string;
  staffName?: string;
  customerId?: string;
  customerName?: string;
  notes?: string;
  discounts?: Array<{
    id: string;
    name: string;
    amount: number;
  }>;
  tipAmount?: number;
  tipPercentage?: number;
}

export interface CreateOrderParams {
  cart: Cart;
  payment: Payment;
  merchantId: string;
  terminalId: string;
  staffId?: string;
}

class OrderService {
  /**
   * Create order from cart and payment
   */
  async createOrder(params: CreateOrderParams): Promise<string> {
    const { cart, payment, merchantId, terminalId, staffId } = params;

    // Generate unique order ID
    const orderId = `order_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Build order metadata
    const metadata: OrderMetadata = {
      orderType: cart.orderType,
      tableId: cart.tableId,
      tableName: cart.tableName,
      areaId: cart.areaId,
      areaName: cart.areaName,
      staffId,
      customerId: cart.customerId,
      customerName: cart.customerName,
      notes: cart.notes,
      tipAmount: cart.tipAmount,
      tipPercentage: cart.tipPercentage,
    };

    // Add discount information
    if (cart.discounts && cart.discounts.length > 0) {
      metadata.discounts = cart.discounts.map((d) => ({
        id: d.id,
        name: d.name,
        amount: d.calculatedAmount,
      }));
    }

    // Create transaction object
    const transaction: Transaction = {
      id: orderId,
      merchantId,
      terminalId,
      total: cart.totals.total,
      items: JSON.stringify({
        items: cart.items.map((item) => ({
          id: item.id,
          productId: item.product.id,
          productName: item.product.name,
          variantId: item.variant?.id,
          variantName: item.variant?.name,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          subtotal: item.subtotal,
          modifiers: item.selectedModifiers.map((m) => ({
            id: m.modifier.id,
            name: m.modifier.name,
            groupName: m.modifierGroupName,
            priceAdjustment: m.modifier.price_adjustment,
          })),
          notes: item.notes,
        })),
        subtotal: cart.totals.subtotal,
        discountTotal: cart.totals.discountTotal,
        taxTotal: cart.totals.taxTotal,
        tipAmount: cart.tipAmount,
        total: cart.totals.total,
        metadata,
      }),
      paymentMethod: payment.method || 'cashu_nfc',
      tableId: cart.tableId,
      customerId: cart.customerId,
      createdAt: Date.now(),
    };

    // Save to local database
    try {
      await databaseService.insertTransaction(transaction);
      console.log('[OrderService] Order created:', orderId);

      // TODO: If Supabase is configured, also save to remote database
      // This will be handled by the sync service

      return orderId;
    } catch (error) {
      console.error('[OrderService] Failed to create order:', error);
      throw new Error('Failed to save order');
    }
  }

  /**
   * Get order by ID
   */
  async getOrder(orderId: string): Promise<Transaction | null> {
    try {
      const transactions = await databaseService.getTransactions();
      return transactions.find((t) => t.id === orderId) || null;
    } catch (error) {
      console.error('[OrderService] Failed to get order:', error);
      return null;
    }
  }

  /**
   * Get orders for a specific table
   */
  async getTableOrders(tableId: string): Promise<Transaction[]> {
    try {
      const transactions = await databaseService.getTransactions();
      return transactions.filter((t) => t.tableId === tableId);
    } catch (error) {
      console.error('[OrderService] Failed to get table orders:', error);
      return [];
    }
  }

  /**
   * Get active orders (not completed/cancelled)
   */
  async getActiveTableOrders(tableId: string): Promise<Transaction[]> {
    try {
      const transactions = await databaseService.getTransactions();
      // Filter for table and check metadata for status
      return transactions.filter((t) => {
        if (t.tableId !== tableId) return false;

        try {
          const items = JSON.parse(t.items);
          const status = items.metadata?.status;
          // Consider active if no status or status is not completed/cancelled
          return !status || !['completed', 'cancelled'].includes(status);
        } catch {
          return true; // If can't parse, assume active
        }
      });
    } catch (error) {
      console.error('[OrderService] Failed to get active table orders:', error);
      return [];
    }
  }

  /**
   * Update order status
   */
  async updateOrderStatus(
    orderId: string,
    status: 'pending' | 'preparing' | 'ready' | 'completed' | 'cancelled'
  ): Promise<void> {
    try {
      const order = await this.getOrder(orderId);
      if (!order) {
        throw new Error('Order not found');
      }

      // Parse items and update metadata
      const items = JSON.parse(order.items);
      items.metadata = items.metadata || {};
      items.metadata.status = status;
      items.metadata.statusUpdatedAt = Date.now();

      // TODO: Update in database
      // This requires adding an update method to database service

      console.log('[OrderService] Order status updated:', orderId, status);
    } catch (error) {
      console.error('[OrderService] Failed to update order status:', error);
      throw error;
    }
  }
}

export const orderService = new OrderService();

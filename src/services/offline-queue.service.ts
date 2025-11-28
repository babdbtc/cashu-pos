/**
 * Offline Queue Service
 *
 * Manages offline payment acceptance and synchronization.
 * Stores unverified tokens locally and processes them when connectivity returns.
 */

import * as SecureStore from 'expo-secure-store';
import * as Network from 'expo-network';
import { validateToken, swapTokens, parseToken, hashToken } from './cashu.service';
import type { OfflinePayment } from '@/types/transaction';
import type { Proof } from '@/types/mint';

const QUEUE_STORAGE_KEY = 'cashupay_offline_queue';
const PROCESSED_TOKENS_KEY = 'cashupay_processed_tokens';

export interface QueuedPayment {
  id: string;
  tokenString: string;
  tokenHash: string;
  amount: number;
  mintUrl: string;
  receivedAt: Date;
  status: 'pending' | 'processing' | 'verified' | 'failed' | 'duplicate';
  error?: string;
  verifiedAt?: Date;
  transactionId?: string;
}

export interface QueueStatus {
  isOnline: boolean;
  pendingCount: number;
  pendingAmount: number;
  processingCount: number;
  failedCount: number;
}

export interface QueueConfig {
  maxPendingCount: number;
  maxPendingAmount: number;
  maxSinglePayment: number;
  autoProcessOnReconnect: boolean;
}

type QueueEventCallback = (status: QueueStatus) => void;

class OfflineQueueService {
  private queue: QueuedPayment[] = [];
  private processedHashes: Set<string> = new Set();
  private isProcessing = false;
  private onStatusChange: QueueEventCallback | null = null;
  private networkSubscription: any = null;
  private config: QueueConfig = {
    maxPendingCount: 20,
    maxPendingAmount: 100000,
    maxSinglePayment: 50000,
    autoProcessOnReconnect: true,
  };

  /**
   * Initialize the offline queue
   */
  async initialize(): Promise<void> {
    await this.loadQueue();
    await this.loadProcessedHashes();
    this.startNetworkMonitoring();
  }

  /**
   * Configure queue limits
   */
  configure(config: Partial<QueueConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Set callback for status changes
   */
  setStatusCallback(callback: QueueEventCallback | null): void {
    this.onStatusChange = callback;
  }

  /**
   * Add a payment to the offline queue
   */
  async queuePayment(
    tokenString: string,
    trustedMints: string[]
  ): Promise<{ success: boolean; error?: string; payment?: QueuedPayment }> {
    // Parse the token
    const parsed = parseToken(tokenString);
    if (!parsed) {
      return { success: false, error: 'Invalid token format' };
    }

    const { token } = parsed;

    // Check mint is trusted
    if (!trustedMints.includes(token.mint)) {
      return { success: false, error: 'Token from untrusted mint' };
    }

    // Calculate amount
    const amount = token.proofs.reduce((sum, p) => sum + p.amount, 0);

    // Check single payment limit
    if (amount > this.config.maxSinglePayment) {
      return {
        success: false,
        error: `Amount ${amount} exceeds offline limit of ${this.config.maxSinglePayment} sats`
      };
    }

    // Check queue count limit
    const pendingCount = this.queue.filter(p => p.status === 'pending').length;
    if (pendingCount >= this.config.maxPendingCount) {
      return {
        success: false,
        error: `Queue full (${this.config.maxPendingCount} payments pending)`
      };
    }

    // Check total pending amount limit
    const pendingAmount = this.queue
      .filter(p => p.status === 'pending')
      .reduce((sum, p) => sum + p.amount, 0);
    if (pendingAmount + amount > this.config.maxPendingAmount) {
      return {
        success: false,
        error: `Would exceed pending amount limit of ${this.config.maxPendingAmount} sats`
      };
    }

    // Hash the token to check for duplicates
    const tokenHash = await hashToken(tokenString);

    // Check for duplicate
    if (this.processedHashes.has(tokenHash)) {
      return { success: false, error: 'Token already processed' };
    }

    const existingInQueue = this.queue.find(p => p.tokenHash === tokenHash);
    if (existingInQueue) {
      return { success: false, error: 'Token already in queue' };
    }

    // Create queued payment
    const payment: QueuedPayment = {
      id: `offline_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      tokenString,
      tokenHash,
      amount,
      mintUrl: token.mint,
      receivedAt: new Date(),
      status: 'pending',
    };

    // Add to queue
    this.queue.push(payment);
    await this.saveQueue();
    this.notifyStatusChange();

    return { success: true, payment };
  }

  /**
   * Process all pending payments in the queue
   */
  async processQueue(trustedMints: string[]): Promise<{
    processed: number;
    verified: number;
    failed: number;
  }> {
    if (this.isProcessing) {
      return { processed: 0, verified: 0, failed: 0 };
    }

    // Check network connectivity
    const networkState = await Network.getNetworkStateAsync();
    if (!networkState.isConnected || !networkState.isInternetReachable) {
      return { processed: 0, verified: 0, failed: 0 };
    }

    this.isProcessing = true;
    let processed = 0;
    let verified = 0;
    let failed = 0;

    const pendingPayments = this.queue.filter(p => p.status === 'pending');

    for (const payment of pendingPayments) {
      payment.status = 'processing';
      this.notifyStatusChange();

      try {
        // Validate the token
        const validation = await validateToken(payment.tokenString, trustedMints);

        if (!validation.valid) {
          payment.status = 'failed';
          payment.error = validation.error;
          failed++;
          continue;
        }

        // Parse and swap the tokens
        const parsed = parseToken(payment.tokenString);
        if (!parsed) {
          payment.status = 'failed';
          payment.error = 'Failed to parse token';
          failed++;
          continue;
        }

        // Attempt to swap (this verifies the tokens aren't spent)
        const swapResult = await swapTokens(
          payment.mintUrl,
          parsed.token.proofs as unknown as Proof[]
        );

        // Mark as verified
        payment.status = 'verified';
        payment.verifiedAt = new Date();
        payment.transactionId = `tx_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

        // Add to processed hashes
        this.processedHashes.add(payment.tokenHash);
        await this.saveProcessedHashes();

        verified++;
      } catch (error: any) {
        payment.status = 'failed';
        payment.error = error.message || 'Verification failed';
        failed++;
      }

      processed++;
    }

    this.isProcessing = false;
    await this.saveQueue();
    this.notifyStatusChange();

    return { processed, verified, failed };
  }

  /**
   * Get current queue status
   */
  async getStatus(): Promise<QueueStatus> {
    const networkState = await Network.getNetworkStateAsync();

    const pending = this.queue.filter(p => p.status === 'pending');
    const processing = this.queue.filter(p => p.status === 'processing');
    const failed = this.queue.filter(p => p.status === 'failed');

    return {
      isOnline: networkState.isConnected && networkState.isInternetReachable || false,
      pendingCount: pending.length,
      pendingAmount: pending.reduce((sum, p) => sum + p.amount, 0),
      processingCount: processing.length,
      failedCount: failed.length,
    };
  }

  /**
   * Get all queued payments
   */
  getQueue(): QueuedPayment[] {
    return [...this.queue];
  }

  /**
   * Get pending payments only
   */
  getPendingPayments(): QueuedPayment[] {
    return this.queue.filter(p => p.status === 'pending');
  }

  /**
   * Get failed payments
   */
  getFailedPayments(): QueuedPayment[] {
    return this.queue.filter(p => p.status === 'failed');
  }

  /**
   * Retry a failed payment
   */
  async retryPayment(paymentId: string): Promise<boolean> {
    const payment = this.queue.find(p => p.id === paymentId);
    if (!payment || payment.status !== 'failed') {
      return false;
    }

    payment.status = 'pending';
    payment.error = undefined;
    await this.saveQueue();
    this.notifyStatusChange();

    return true;
  }

  /**
   * Remove a payment from the queue
   */
  async removePayment(paymentId: string): Promise<boolean> {
    const index = this.queue.findIndex(p => p.id === paymentId);
    if (index === -1) {
      return false;
    }

    this.queue.splice(index, 1);
    await this.saveQueue();
    this.notifyStatusChange();

    return true;
  }

  /**
   * Clear all verified and failed payments (keep pending)
   */
  async clearProcessed(): Promise<void> {
    this.queue = this.queue.filter(p => p.status === 'pending');
    await this.saveQueue();
    this.notifyStatusChange();
  }

  /**
   * Clear entire queue (dangerous - use with caution)
   */
  async clearAll(): Promise<void> {
    this.queue = [];
    await this.saveQueue();
    this.notifyStatusChange();
  }

  /**
   * Check if queue can accept more payments
   */
  canAcceptPayment(amount: number): { canAccept: boolean; reason?: string } {
    const pending = this.queue.filter(p => p.status === 'pending');
    const pendingAmount = pending.reduce((sum, p) => sum + p.amount, 0);

    if (pending.length >= this.config.maxPendingCount) {
      return { canAccept: false, reason: 'Queue is full' };
    }

    if (amount > this.config.maxSinglePayment) {
      return { canAccept: false, reason: 'Amount exceeds offline limit' };
    }

    if (pendingAmount + amount > this.config.maxPendingAmount) {
      return { canAccept: false, reason: 'Would exceed total pending limit' };
    }

    return { canAccept: true };
  }

  // Private methods

  private async loadQueue(): Promise<void> {
    try {
      const stored = await SecureStore.getItemAsync(QUEUE_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        this.queue = parsed.map((p: any) => ({
          ...p,
          receivedAt: new Date(p.receivedAt),
          verifiedAt: p.verifiedAt ? new Date(p.verifiedAt) : undefined,
        }));
      }
    } catch (error) {
      console.error('Failed to load offline queue:', error);
      this.queue = [];
    }
  }

  private async saveQueue(): Promise<void> {
    try {
      await SecureStore.setItemAsync(
        QUEUE_STORAGE_KEY,
        JSON.stringify(this.queue)
      );
    } catch (error) {
      console.error('Failed to save offline queue:', error);
    }
  }

  private async loadProcessedHashes(): Promise<void> {
    try {
      const stored = await SecureStore.getItemAsync(PROCESSED_TOKENS_KEY);
      if (stored) {
        const hashes = JSON.parse(stored);
        this.processedHashes = new Set(hashes);
      }
    } catch (error) {
      console.error('Failed to load processed hashes:', error);
      this.processedHashes = new Set();
    }
  }

  private async saveProcessedHashes(): Promise<void> {
    try {
      // Keep only last 1000 hashes to prevent unbounded growth
      const hashArray = Array.from(this.processedHashes).slice(-1000);
      await SecureStore.setItemAsync(
        PROCESSED_TOKENS_KEY,
        JSON.stringify(hashArray)
      );
    } catch (error) {
      console.error('Failed to save processed hashes:', error);
    }
  }

  private startNetworkMonitoring(): void {
    // Poll network status periodically
    const checkNetwork = async () => {
      const networkState = await Network.getNetworkStateAsync();
      const isOnline = networkState.isConnected && networkState.isInternetReachable;

      if (isOnline && this.config.autoProcessOnReconnect) {
        const pendingCount = this.queue.filter(p => p.status === 'pending').length;
        if (pendingCount > 0 && !this.isProcessing) {
          // Auto-process queue when coming back online
          // Note: trustedMints would need to be passed in
          console.log('Network restored, pending payments can be processed');
          this.notifyStatusChange();
        }
      }
    };

    // Check every 30 seconds
    setInterval(checkNetwork, 30000);
  }

  private async notifyStatusChange(): Promise<void> {
    if (this.onStatusChange) {
      const status = await this.getStatus();
      this.onStatusChange(status);
    }
  }
}

// Export singleton instance
export const offlineQueueService = new OfflineQueueService();

// Export class for testing
export { OfflineQueueService };

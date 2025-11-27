/**
 * Payment Processor Service
 *
 * Orchestrates the complete payment flow including:
 * - Token validation
 * - Online/offline processing
 * - Change handling
 * - Receipt generation
 */

import * as Network from 'expo-network';
import {
  parseToken,
  validateToken,
  swapTokens,
  splitTokens,
  encodeToken,
  checkTokenState,
  getTokenAmount,
} from './cashu.service';
import { nfcService } from './nfc.service';
import { offlineQueueService } from './offline-queue.service';
import { receiptService, type ReceiptData } from './receipt.service';
import type { Payment, PaymentState, OverpaymentInfo } from '@/types/payment';
import type { Proof } from '@/types/mint';

export interface PaymentRequest {
  fiatAmount: number;
  fiatCurrency: string;
  satsAmount: number;
  exchangeRate: number;
  merchantName: string;
  terminalName: string;
  terminalId: string;
}

export interface PaymentResult {
  success: boolean;
  payment: Payment;
  receipt?: ReceiptData;
  changeToken?: string;
  error?: string;
}

export interface ProcessorConfig {
  trustedMints: string[];
  primaryMintUrl: string;
  offlineEnabled: boolean;
  offlineMaxAmount: number;
  autoAcceptTipThreshold: number;
  forceChangeThreshold: number;
  overpaymentHandling: 'prompt' | 'auto_tip' | 'auto_change';
}

type PaymentEventCallback = (event: PaymentEvent) => void;

export type PaymentEvent =
  | { type: 'waiting_for_payment' }
  | { type: 'token_received'; tokenString: string }
  | { type: 'validating' }
  | { type: 'processing' }
  | { type: 'overpayment_detected'; amount: number; handling: 'tip' | 'change' | 'prompt' }
  | { type: 'generating_change'; amount: number }
  | { type: 'completed'; payment: Payment }
  | { type: 'failed'; error: string }
  | { type: 'cancelled' };

class PaymentProcessorService {
  private config: ProcessorConfig | null = null;
  private currentPayment: Payment | null = null;
  private eventCallback: PaymentEventCallback | null = null;
  private isProcessing = false;

  /**
   * Configure the payment processor
   */
  configure(config: ProcessorConfig): void {
    this.config = config;

    // Configure offline queue
    offlineQueueService.configure({
      maxSinglePayment: config.offlineMaxAmount,
      autoProcessOnReconnect: true,
    });
  }

  /**
   * Set event callback for payment flow updates
   */
  setEventCallback(callback: PaymentEventCallback | null): void {
    this.eventCallback = callback;
  }

  /**
   * Start a new payment request
   */
  async startPayment(request: PaymentRequest): Promise<Payment> {
    if (this.isProcessing) {
      throw new Error('A payment is already in progress');
    }

    if (!this.config) {
      throw new Error('Payment processor not configured');
    }

    this.isProcessing = true;

    // Create payment record
    const payment: Payment = {
      id: `pay_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      state: 'pending',
      fiatAmount: request.fiatAmount,
      fiatCurrency: request.fiatCurrency,
      satsAmount: request.satsAmount,
      exchangeRate: request.exchangeRate,
      createdAt: new Date(),
    };

    this.currentPayment = payment;
    this.emit({ type: 'waiting_for_payment' });

    return payment;
  }

  /**
   * Process a received token for the current payment
   */
  async processToken(tokenString: string): Promise<PaymentResult> {
    if (!this.currentPayment) {
      throw new Error('No active payment');
    }

    if (!this.config) {
      throw new Error('Payment processor not configured');
    }

    this.emit({ type: 'token_received', tokenString });

    const payment = this.currentPayment;
    const { trustedMints, primaryMintUrl } = this.config;

    try {
      // Check network status
      const networkState = await Network.getNetworkStateAsync();
      const isOnline = networkState.isConnected && networkState.isInternetReachable;

      // Parse the token first
      const parsed = parseToken(tokenString);
      if (!parsed) {
        return this.failPayment('Invalid token format');
      }

      const tokenAmount = parsed.token.proofs.reduce((sum, p) => sum + p.amount, 0);

      // Check if token amount is sufficient
      if (tokenAmount < payment.satsAmount) {
        return this.failPayment(
          `Insufficient payment: received ${tokenAmount} sats, expected ${payment.satsAmount} sats`
        );
      }

      // Handle offline mode
      if (!isOnline) {
        return await this.processOffline(payment, tokenString, tokenAmount);
      }

      // Online processing
      this.emit({ type: 'validating' });

      // Validate the token
      const validation = await validateToken(tokenString, trustedMints);
      if (!validation.valid) {
        return this.failPayment(validation.error || 'Token validation failed');
      }

      this.emit({ type: 'processing' });

      // Check if tokens are already spent
      const states = await checkTokenState(
        parsed.token.mint,
        parsed.token.proofs as unknown as Proof[]
      );
      if (states.some(s => s === 'SPENT')) {
        return this.failPayment('Token has already been spent');
      }

      // Handle overpayment
      const overpaymentAmount = tokenAmount - payment.satsAmount;
      let overpaymentInfo: OverpaymentInfo | undefined;
      let changeToken: string | undefined;

      if (overpaymentAmount > 0) {
        const handling = this.determineOverpaymentHandling(overpaymentAmount);
        this.emit({ type: 'overpayment_detected', amount: overpaymentAmount, handling });

        if (handling === 'tip') {
          overpaymentInfo = {
            amount: overpaymentAmount,
            handling: 'tip',
          };
        } else if (handling === 'change') {
          this.emit({ type: 'generating_change', amount: overpaymentAmount });

          // Split tokens for change
          const splitResult = await splitTokens(
            parsed.token.mint,
            parsed.token.proofs as unknown as Proof[],
            payment.satsAmount
          );

          // Swap the merchant's portion
          const swapResult = await swapTokens(primaryMintUrl, splitResult.keep);

          // Encode change token for customer
          changeToken = encodeToken(parsed.token.mint, splitResult.send);

          overpaymentInfo = {
            amount: overpaymentAmount,
            handling: 'change',
            changeToken,
          };
        }
      } else {
        // Exact amount - just swap the tokens
        await swapTokens(primaryMintUrl, parsed.token.proofs as unknown as Proof[]);
      }

      // Complete the payment
      payment.state = 'completed';
      payment.completedAt = new Date();
      payment.transactionId = `tx_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      payment.overpayment = overpaymentInfo;
      payment.tokenMint = parsed.token.mint;

      // Generate receipt
      const receipt = receiptService.generateReceipt(payment, {
        merchantName: this.config.trustedMints.length > 0 ? 'Merchant' : 'Unknown',
        terminalName: 'Terminal 1',
        terminalId: 'term_1',
      });

      // Save receipt
      await receiptService.saveReceipt(receipt);

      this.emit({ type: 'completed', payment });
      this.isProcessing = false;

      return {
        success: true,
        payment,
        receipt,
        changeToken,
      };
    } catch (error: any) {
      return this.failPayment(error.message || 'Payment processing failed');
    }
  }

  /**
   * Process payment in offline mode
   */
  private async processOffline(
    payment: Payment,
    tokenString: string,
    tokenAmount: number
  ): Promise<PaymentResult> {
    if (!this.config?.offlineEnabled) {
      return this.failPayment('Offline mode is disabled');
    }

    if (tokenAmount > this.config.offlineMaxAmount) {
      return this.failPayment(
        `Amount ${tokenAmount} exceeds offline limit of ${this.config.offlineMaxAmount} sats`
      );
    }

    // Queue the payment for later verification
    const queueResult = await offlineQueueService.queuePayment(
      tokenString,
      this.config.trustedMints
    );

    if (!queueResult.success) {
      return this.failPayment(queueResult.error || 'Failed to queue offline payment');
    }

    // Mark payment as pending verification
    payment.state = 'pending_verification';
    payment.completedAt = new Date();
    payment.transactionId = queueResult.payment?.id;
    payment.offlineQueued = true;

    // Handle overpayment (no change in offline mode)
    const overpaymentAmount = tokenAmount - payment.satsAmount;
    if (overpaymentAmount > 0) {
      // In offline mode, we accept overpayment as tip
      payment.overpayment = {
        amount: overpaymentAmount,
        handling: 'tip',
      };
    }

    // Generate receipt (marked as pending)
    const receipt = receiptService.generateReceipt(payment, {
      merchantName: 'Merchant',
      terminalName: 'Terminal 1',
      terminalId: 'term_1',
    });

    this.emit({ type: 'completed', payment });
    this.isProcessing = false;

    return {
      success: true,
      payment,
      receipt,
    };
  }

  /**
   * Determine how to handle overpayment
   */
  private determineOverpaymentHandling(amount: number): 'tip' | 'change' | 'prompt' {
    if (!this.config) return 'prompt';

    const { autoAcceptTipThreshold, forceChangeThreshold, overpaymentHandling } = this.config;

    // Small overpayments are auto-accepted as tips
    if (amount <= autoAcceptTipThreshold) {
      return 'tip';
    }

    // Large overpayments force change
    if (amount >= forceChangeThreshold) {
      return 'change';
    }

    // Middle range based on config
    if (overpaymentHandling === 'auto_tip') {
      return 'tip';
    } else if (overpaymentHandling === 'auto_change') {
      return 'change';
    }

    return 'prompt';
  }

  /**
   * Manually set overpayment handling (for prompt mode)
   */
  async setOverpaymentHandling(handling: 'tip' | 'change'): Promise<void> {
    if (this.currentPayment) {
      // This would be called from UI when user selects handling
      // The actual processing continues after this
    }
  }

  /**
   * Cancel the current payment
   */
  async cancelPayment(): Promise<void> {
    if (this.currentPayment) {
      this.currentPayment.state = 'failed';
      this.currentPayment.error = 'Cancelled by user';
    }

    await nfcService.cancelReading();
    this.emit({ type: 'cancelled' });
    this.isProcessing = false;
    this.currentPayment = null;
  }

  /**
   * Get current payment
   */
  getCurrentPayment(): Payment | null {
    return this.currentPayment;
  }

  /**
   * Check if payment is in progress
   */
  isPaymentInProgress(): boolean {
    return this.isProcessing;
  }

  /**
   * Start NFC reading for payment
   */
  async startNfcReading(): Promise<void> {
    if (!this.currentPayment) {
      throw new Error('No active payment');
    }

    await nfcService.startReading(async (result) => {
      if (result.success && result.token) {
        await this.processToken(result.token);
      } else if (result.error) {
        this.emit({ type: 'failed', error: result.error });
      }
    });
  }

  /**
   * Process queued offline payments
   */
  async processOfflineQueue(): Promise<{
    processed: number;
    verified: number;
    failed: number;
  }> {
    if (!this.config) {
      return { processed: 0, verified: 0, failed: 0 };
    }

    return offlineQueueService.processQueue(this.config.trustedMints);
  }

  // Private helpers

  private failPayment(error: string): PaymentResult {
    if (this.currentPayment) {
      this.currentPayment.state = 'failed';
      this.currentPayment.error = error;
    }

    this.emit({ type: 'failed', error });
    this.isProcessing = false;

    return {
      success: false,
      payment: this.currentPayment!,
      error,
    };
  }

  private emit(event: PaymentEvent): void {
    this.eventCallback?.(event);
  }
}

// Export singleton instance
export const paymentProcessor = new PaymentProcessorService();

// Export class for testing
export { PaymentProcessorService };

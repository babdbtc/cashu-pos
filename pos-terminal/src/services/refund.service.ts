/**
 * Refund Service
 *
 * Handles refund operations including creating refund tokens,
 * generating QR codes, and tracking refund status.
 */

import { type Proof } from '@cashu/cashu-ts';
import * as Crypto from 'expo-crypto';
import {
  splitTokens,
  encodeToken,
  getWallet,
} from './cashu.service';
import { useWalletStore } from '../store/wallet.store';
import { useConfigStore } from '../store/config.store';
import type { Payment } from '../types/payment';

export type RefundStatus =
  | 'pending'
  | 'approved'
  | 'processing'
  | 'completed'
  | 'failed'
  | 'expired'
  | 'claimed';

export interface RefundRequest {
  transactionId: string;
  amount: number; // in sats
  reasonCode: string;
  notes?: string;
  staffId?: string;
  approverPin?: string;
}

export interface Refund {
  id: string;
  transactionId: string;
  originalPayment: Payment;

  // Amounts
  requestedAmount: number;
  refundedAmount: number;
  fiatAmount: number;
  fiatCurrency: string;
  exchangeRate: number;

  // Refund token for customer
  refundToken?: string;
  tokenHash?: string;
  claimCode?: string;

  // Status tracking
  status: RefundStatus;
  reasonCode: string;
  notes?: string;

  // Staff info
  initiatedBy?: string;
  approvedBy?: string;

  // Timestamps
  createdAt: Date;
  approvedAt?: Date;
  completedAt?: Date;
  expiresAt?: Date;
  claimedAt?: Date;

  // Error handling
  error?: string;
}

export interface RefundResult {
  success: boolean;
  refund: Refund;
  qrCodeData?: string;
  error?: string;
}

// Store refunds in memory (in production, this would be persisted)
const refundsMap = new Map<string, Refund>();

class RefundService {
  /**
   * Generate a unique refund ID
   */
  private async generateRefundId(): Promise<string> {
    const timestamp = Date.now().toString(36);
    const randomBytes = await Crypto.getRandomBytesAsync(8);
    const random = Array.from(randomBytes)
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
    return `ref_${timestamp}_${random.slice(0, 8)}`;
  }

  /**
   * Generate a claim code for the refund
   */
  private async generateClaimCode(): Promise<string> {
    const randomBytes = await Crypto.getRandomBytesAsync(4);
    return Array.from(randomBytes)
      .map(b => b.toString(16).padStart(2, '0'))
      .join('')
      .toUpperCase();
  }

  /**
   * Find proofs that can cover the requested amount
   */
  private selectProofsForAmount(
    availableProofs: Proof[],
    targetAmount: number
  ): { selected: Proof[]; total: number } | null {
    // Sort proofs by amount (smallest first) for optimal selection
    const sorted = [...availableProofs].sort((a, b) => a.amount - b.amount);

    const selected: Proof[] = [];
    let total = 0;

    // Greedy selection - pick proofs until we have enough
    for (const proof of sorted) {
      if (total >= targetAmount) break;
      selected.push(proof);
      total += proof.amount;
    }

    if (total < targetAmount) {
      return null; // Not enough balance
    }

    return { selected, total };
  }

  /**
   * Process a refund request
   */
  async processRefund(
    request: RefundRequest,
    originalPayment: Payment
  ): Promise<RefundResult> {
    const refundId = await this.generateRefundId();

    // Get configuration
    const config = useConfigStore.getState();
    const mintUrl = config.mints.primaryMintUrl;

    if (!mintUrl) {
      return {
        success: false,
        refund: this.createFailedRefund(refundId, request, originalPayment, 'No mint configured'),
        error: 'No mint configured. Please add a mint in settings.',
      };
    }

    // Get wallet proofs
    const walletState = useWalletStore.getState();
    const availableProofs = walletState.proofs;

    // Check if we have enough balance
    if (walletState.balance < request.amount) {
      return {
        success: false,
        refund: this.createFailedRefund(refundId, request, originalPayment, 'Insufficient balance'),
        error: `Insufficient balance. Available: ${walletState.balance} sats, Required: ${request.amount} sats`,
      };
    }

    // Select proofs for refund
    const selection = this.selectProofsForAmount(availableProofs, request.amount);

    if (!selection) {
      return {
        success: false,
        refund: this.createFailedRefund(refundId, request, originalPayment, 'Could not select proofs'),
        error: 'Could not select proofs for refund amount',
      };
    }

    try {
      // Split proofs to get exact refund amount
      let refundProofs: Proof[];
      let changeProofs: Proof[];

      if (selection.total === request.amount) {
        // Exact match - use all selected proofs
        refundProofs = selection.selected;
        changeProofs = [];
      } else {
        // Need to split - keep the change, send the refund
        const result = await splitTokens(
          mintUrl,
          selection.selected,
          selection.total - request.amount // keepAmount = change
        );
        refundProofs = result.send;
        changeProofs = result.keep;
      }

      // Encode refund token for customer
      const claimCode = await this.generateClaimCode();
      const refundToken = encodeToken(
        mintUrl,
        refundProofs,
        `Refund ${claimCode} - ${request.reasonCode}`
      );

      // Hash the token for tracking
      const tokenHash = await Crypto.digestStringAsync(
        Crypto.CryptoDigestAlgorithm.SHA256,
        refundToken
      );

      // Update wallet - remove used proofs, add change
      walletState.removeProofs(selection.selected);
      if (changeProofs.length > 0) {
        walletState.addProofs(changeProofs);
      }

      // Calculate fiat amount
      const fiatAmount = (request.amount / originalPayment.satsAmount) * originalPayment.fiatAmount;

      // Create refund record
      const refund: Refund = {
        id: refundId,
        transactionId: request.transactionId,
        originalPayment,
        requestedAmount: request.amount,
        refundedAmount: request.amount,
        fiatAmount,
        fiatCurrency: originalPayment.fiatCurrency,
        exchangeRate: originalPayment.exchangeRate,
        refundToken,
        tokenHash,
        claimCode,
        status: 'completed',
        reasonCode: request.reasonCode,
        notes: request.notes,
        initiatedBy: request.staffId,
        approvedBy: request.approverPin ? 'manager' : undefined,
        createdAt: new Date(),
        completedAt: new Date(),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
      };

      // Store the refund
      refundsMap.set(refundId, refund);

      // Generate QR code data (the token itself)
      const qrCodeData = refundToken;

      return {
        success: true,
        refund,
        qrCodeData,
      };

    } catch (error: any) {
      console.error('Refund processing failed:', error);

      return {
        success: false,
        refund: this.createFailedRefund(
          refundId,
          request,
          originalPayment,
          error.message || 'Token operation failed'
        ),
        error: error.message || 'Failed to process refund',
      };
    }
  }

  /**
   * Create a failed refund record
   */
  private createFailedRefund(
    id: string,
    request: RefundRequest,
    originalPayment: Payment,
    error: string
  ): Refund {
    const fiatAmount = (request.amount / originalPayment.satsAmount) * originalPayment.fiatAmount;

    return {
      id,
      transactionId: request.transactionId,
      originalPayment,
      requestedAmount: request.amount,
      refundedAmount: 0,
      fiatAmount,
      fiatCurrency: originalPayment.fiatCurrency,
      exchangeRate: originalPayment.exchangeRate,
      status: 'failed',
      reasonCode: request.reasonCode,
      notes: request.notes,
      initiatedBy: request.staffId,
      createdAt: new Date(),
      error,
    };
  }

  /**
   * Get a refund by ID
   */
  getRefund(refundId: string): Refund | null {
    return refundsMap.get(refundId) || null;
  }

  /**
   * Get refunds for a transaction
   */
  getRefundsForTransaction(transactionId: string): Refund[] {
    return Array.from(refundsMap.values())
      .filter(r => r.transactionId === transactionId);
  }

  /**
   * Get all refunds
   */
  getAllRefunds(): Refund[] {
    return Array.from(refundsMap.values())
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  /**
   * Mark a refund as claimed
   */
  markRefundClaimed(refundId: string): boolean {
    const refund = refundsMap.get(refundId);
    if (!refund) return false;

    refund.status = 'claimed';
    refund.claimedAt = new Date();
    refundsMap.set(refundId, refund);

    return true;
  }

  /**
   * Check if a refund has expired
   */
  isRefundExpired(refund: Refund): boolean {
    if (!refund.expiresAt) return false;
    return new Date() > refund.expiresAt;
  }

  /**
   * Get total refunded amount for a transaction
   */
  getTotalRefundedForTransaction(transactionId: string): number {
    return this.getRefundsForTransaction(transactionId)
      .filter(r => r.status === 'completed' || r.status === 'claimed')
      .reduce((sum, r) => sum + r.refundedAmount, 0);
  }

  /**
   * Check if full refund is possible for a transaction
   */
  canFullRefund(originalPayment: Payment): boolean {
    const alreadyRefunded = this.getTotalRefundedForTransaction(
      originalPayment.transactionId || originalPayment.id
    );
    return alreadyRefunded < originalPayment.satsAmount;
  }

  /**
   * Get maximum refundable amount for a transaction
   */
  getMaxRefundableAmount(originalPayment: Payment): number {
    const alreadyRefunded = this.getTotalRefundedForTransaction(
      originalPayment.transactionId || originalPayment.id
    );
    return Math.max(0, originalPayment.satsAmount - alreadyRefunded);
  }
}

// Export singleton instance
export const refundService = new RefundService();

// Export class for testing
export { RefundService };

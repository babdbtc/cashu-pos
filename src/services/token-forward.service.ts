/**
 * Token Forwarding Service
 *
 * Handles secure token forwarding from sub-terminals to main terminal.
 * Sub-terminals forward received tokens instead of storing them locally,
 * ensuring all funds are controlled by the main terminal (store owner).
 */

import { nostrService } from './nostr.service';
import { useConfigStore } from '@/store/config.store';
import { useWalletStore } from '@/store/wallet.store';
import { swapTokens, parseToken } from './cashu.service';
import { EventKinds, type TokenForwardEvent, type TokenReceivedEvent } from '@/types/nostr';
import type { Event } from 'nostr-tools';
import * as nip04 from 'nostr-tools/nip04';

class TokenForwardService {
  private subscriptionId: string | null = null;
  private initialized = false;
  private pendingForwards: Map<string, TokenForwardEvent> = new Map();

  /**
   * Initialize the service
   * - Sub-terminals: prepare to forward tokens
   * - Main terminals: subscribe to receive forwarded tokens
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    const { terminalType, merchantId, mainTerminalPubkey } = useConfigStore.getState();

    if (!merchantId) {
      console.log('[TokenForward] No merchant ID, skipping initialization');
      return;
    }

    await nostrService.initialize();

    if (terminalType === 'main') {
      // Main terminal: listen for incoming token forwards
      await this.subscribeToTokenForwards();
    }

    this.initialized = true;
    console.log('[TokenForward] Initialized as', terminalType);
  }

  /**
   * Forward a token to the main terminal (called by sub-terminals)
   */
  async forwardToken(params: {
    token: string;
    transactionId: string;
    amount: number;
    fiatAmount?: number;
    fiatCurrency?: string;
    paymentMethod: string;
    mintUrl: string;
  }): Promise<{ success: boolean; error?: string }> {
    const { terminalType, terminalId, terminalName, merchantId, mainTerminalPubkey } =
      useConfigStore.getState();

    if (terminalType !== 'sub') {
      return { success: false, error: 'Only sub-terminals should forward tokens' };
    }

    if (!mainTerminalPubkey) {
      return { success: false, error: 'Main terminal pubkey not configured' };
    }

    if (!merchantId || !terminalId) {
      return { success: false, error: 'Terminal not properly configured' };
    }

    try {
      await nostrService.initialize();

      const forwardId = `fwd_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

      const forwardEvent: TokenForwardEvent = {
        id: forwardId,
        transactionId: params.transactionId,
        terminalId,
        terminalName: terminalName || 'Sub Terminal',
        merchantId,
        token: params.token,
        amount: params.amount,
        fiatAmount: params.fiatAmount,
        fiatCurrency: params.fiatCurrency,
        paymentMethod: params.paymentMethod,
        mintUrl: params.mintUrl,
        createdAt: Date.now(),
      };

      // Encrypt the token data for the main terminal using NIP-04
      const privateKeyBytes = nostrService.getPrivateKeyBytes();
      if (!privateKeyBytes) {
        return { success: false, error: 'Nostr not initialized' };
      }

      const encryptedContent = await nip04.encrypt(
        privateKeyBytes,
        mainTerminalPubkey,
        JSON.stringify(forwardEvent)
      );

      // Publish the encrypted token forward event
      await nostrService.publishEvent({
        kind: EventKinds.TOKEN_FORWARD,
        content: encryptedContent,
        tags: [
          ['m', merchantId],
          ['t', terminalId],
          ['p', mainTerminalPubkey], // Tag the main terminal
          ['fwd', forwardId],
        ],
        created_at: Math.floor(Date.now() / 1000),
      });

      // Store as pending until we get acknowledgment
      this.pendingForwards.set(forwardId, forwardEvent);

      console.log('[TokenForward] Forwarded token:', forwardId, 'amount:', params.amount);
      return { success: true };
    } catch (error) {
      console.error('[TokenForward] Error forwarding token:', error);
      return { success: false, error: (error as Error).message };
    }
  }

  /**
   * Subscribe to token forward events (main terminal only)
   */
  private async subscribeToTokenForwards(): Promise<void> {
    const { merchantId } = useConfigStore.getState();
    if (!merchantId) return;

    const myPubkey = nostrService.getPublicKey();
    if (!myPubkey) return;

    const filter = {
      kinds: [EventKinds.TOKEN_FORWARD],
      '#m': [merchantId],
      '#p': [myPubkey], // Only events tagged to us
      since: Math.floor(Date.now() / 1000) - 86400, // Last 24 hours
    };

    this.subscriptionId = nostrService.subscribeToEvents(
      [filter],
      (event) => this.handleIncomingTokenForward(event)
    );

    console.log('[TokenForward] Subscribed to token forwards');
  }

  /**
   * Handle incoming token forward (main terminal)
   */
  private async handleIncomingTokenForward(event: Event): Promise<void> {
    try {
      const privateKeyBytes = nostrService.getPrivateKeyBytes();
      if (!privateKeyBytes) return;

      // Decrypt the content
      const decryptedContent = await nip04.decrypt(
        privateKeyBytes,
        event.pubkey,
        event.content
      );

      const forwardEvent: TokenForwardEvent = JSON.parse(decryptedContent);

      console.log('[TokenForward] Received token from', forwardEvent.terminalName, 'amount:', forwardEvent.amount);

      // Process the token - swap it to our wallet
      await this.processForwardedToken(forwardEvent, event.pubkey);
    } catch (error) {
      console.error('[TokenForward] Error handling incoming token:', error);
    }
  }

  /**
   * Process a forwarded token (main terminal)
   */
  private async processForwardedToken(
    forwardEvent: TokenForwardEvent,
    senderPubkey: string
  ): Promise<void> {
    const { terminalId, merchantId } = useConfigStore.getState();
    const { addProofs } = useWalletStore.getState();

    let success = false;
    let error: string | undefined;

    try {
      // Parse and swap the token
      const parsed = parseToken(forwardEvent.token);
      if (!parsed) {
        throw new Error('Invalid token format');
      }

      const mintUrl = parsed.token.mint || forwardEvent.mintUrl;
      const { proofs } = await swapTokens(mintUrl, parsed.token.proofs);

      // Add to our wallet
      addProofs(proofs, mintUrl);

      success = true;
      console.log('[TokenForward] Successfully processed token:', forwardEvent.id, 'sats:', forwardEvent.amount);
    } catch (err) {
      error = (err as Error).message;
      console.error('[TokenForward] Failed to process token:', error);
    }

    // Send acknowledgment back to sub-terminal
    try {
      const ackEvent: TokenReceivedEvent = {
        forwardId: forwardEvent.id,
        transactionId: forwardEvent.transactionId,
        terminalId: forwardEvent.terminalId,
        receivedAt: Date.now(),
        success,
        error,
      };

      await nostrService.publishEvent({
        kind: EventKinds.TOKEN_RECEIVED,
        content: JSON.stringify(ackEvent),
        tags: [
          ['m', merchantId!],
          ['t', terminalId!],
          ['p', senderPubkey], // Tag the sub-terminal
          ['fwd', forwardEvent.id],
        ],
        created_at: Math.floor(Date.now() / 1000),
      });

      console.log('[TokenForward] Sent acknowledgment for:', forwardEvent.id);
    } catch (err) {
      console.error('[TokenForward] Failed to send acknowledgment:', err);
    }
  }

  /**
   * Check if this terminal should forward tokens (is a sub-terminal in a sync group)
   */
  shouldForwardTokens(): boolean {
    const { terminalType, syncEnabled, mainTerminalPubkey } = useConfigStore.getState();
    return terminalType === 'sub' && syncEnabled && !!mainTerminalPubkey;
  }

  /**
   * Get pending forwards that haven't been acknowledged
   */
  getPendingForwards(): TokenForwardEvent[] {
    return Array.from(this.pendingForwards.values());
  }

  /**
   * Cleanup
   */
  cleanup(): void {
    if (this.subscriptionId) {
      nostrService.unsubscribe(this.subscriptionId);
      this.subscriptionId = null;
    }
    this.initialized = false;
  }
}

// Singleton instance
export const tokenForwardService = new TokenForwardService();

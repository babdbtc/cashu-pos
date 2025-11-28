/**
 * Device Approval Service
 *
 * Manages terminal join requests and approvals for secure multi-terminal sync.
 * Main terminals must approve sub-terminals before they can sync data.
 */

import { nostrService } from './nostr.service';
import { databaseService } from './database.service';
import { EventKinds, type JoinRequest, type JoinApproval, type ApprovedDevice } from '@/types/nostr';
import type { Event } from 'nostr-tools';
import * as SecureStore from 'expo-secure-store';

const APPROVED_DEVICES_KEY = 'approved-devices';
const APPROVAL_STATUS_KEY = 'approval-status';

export type ApprovalStatus = 'pending' | 'approved' | 'denied' | 'none';

class DeviceApprovalService {
  private approvedDevices: ApprovedDevice[] = [];
  private pendingRequests: JoinRequest[] = [];
  private myApprovalStatus: ApprovalStatus = 'none';
  private subscriptionId: string | null = null;
  private initialized = false;
  private initializing = false;

  /**
   * Initialize the service and load stored approvals
   */
  async initialize(): Promise<void> {
    // Prevent re-initialization
    if (this.initialized) {
      console.log('[DeviceApproval] Already initialized, skipping');
      return;
    }

    // Prevent concurrent initialization
    if (this.initializing) {
      console.log('[DeviceApproval] Initialization in progress, waiting...');
      while (this.initializing) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      return;
    }

    this.initializing = true;

    try {
      // Load approved devices from storage
      const stored = await SecureStore.getItemAsync(APPROVED_DEVICES_KEY);
      if (stored) {
        const devices = JSON.parse(stored) as ApprovedDevice[];
        // Deduplicate by terminalId (keep first occurrence)
        const seen = new Set<string>();
        this.approvedDevices = devices.filter(d => {
          if (seen.has(d.terminalId)) return false;
          seen.add(d.terminalId);
          return true;
        });
        // Save deduplicated list if there were duplicates
        if (this.approvedDevices.length !== devices.length) {
          console.log('[DeviceApproval] Removed', devices.length - this.approvedDevices.length, 'duplicate devices');
          await this.saveApprovedDevices();
        }
      }

      // Load my approval status (for sub-terminals)
      const status = await SecureStore.getItemAsync(APPROVAL_STATUS_KEY);
      if (status) {
        this.myApprovalStatus = status as ApprovalStatus;
      }

      this.initialized = true;
      console.log('[DeviceApproval] Initialized with', this.approvedDevices.length, 'approved devices');
    } catch (error) {
      console.error('[DeviceApproval] Initialization error:', error);
    } finally {
      this.initializing = false;
    }
  }

  /**
   * Subscribe to join requests and approvals for a merchant
   */
  subscribeToDeviceEvents(merchantId: string, onUpdate?: () => void): void {
    const filter = {
      kinds: [EventKinds.JOIN_REQUEST, EventKinds.JOIN_APPROVAL, EventKinds.DEVICE_REVOKE],
      '#m': [merchantId],
      since: Math.floor(Date.now() / 1000) - 86400 * 7, // Last 7 days
    };

    this.subscriptionId = nostrService.subscribeToEvents(
      [filter],
      async (event) => {
        await this.handleDeviceEvent(event);
        onUpdate?.();
      }
    );
  }

  /**
   * Fetch existing join requests from relays (for main terminal)
   */
  async fetchPendingRequests(merchantId: string): Promise<void> {
    try {
      await nostrService.initialize();

      const filter = {
        kinds: [EventKinds.JOIN_REQUEST],
        '#m': [merchantId],
        since: Math.floor(Date.now() / 1000) - 86400 * 7, // Last 7 days
      };

      const events = await nostrService.queryEvents([filter]);
      console.log('[DeviceApproval] Fetched', events.length, 'join request events');

      for (const event of events) {
        await this.handleDeviceEvent(event);
      }
    } catch (error) {
      console.error('[DeviceApproval] Error fetching pending requests:', error);
    }
  }

  /**
   * Fetch my approval status from relays (for sub-terminal)
   */
  async fetchMyApprovalStatus(merchantId: string): Promise<void> {
    try {
      await nostrService.initialize();
      const myPubkey = nostrService.getPublicKey();
      if (!myPubkey) return;

      const filter = {
        kinds: [EventKinds.JOIN_APPROVAL],
        '#m': [merchantId],
        '#p': [myPubkey], // Filter for approvals targeting my pubkey
        since: Math.floor(Date.now() / 1000) - 86400 * 7, // Last 7 days
      };

      const events = await nostrService.queryEvents([filter]);
      console.log('[DeviceApproval] Fetched', events.length, 'approval events for me');

      for (const event of events) {
        await this.handleDeviceEvent(event);
      }
    } catch (error) {
      console.error('[DeviceApproval] Error fetching approval status:', error);
    }
  }

  /**
   * Handle incoming device management events
   */
  private async handleDeviceEvent(event: Event): Promise<void> {
    try {
      const data = JSON.parse(event.content);

      switch (event.kind) {
        case EventKinds.JOIN_REQUEST:
          await this.handleJoinRequest(data as JoinRequest, event);
          break;

        case EventKinds.JOIN_APPROVAL:
          await this.handleJoinApproval(data as JoinApproval, event);
          break;

        case EventKinds.DEVICE_REVOKE:
          await this.handleDeviceRevoke(data);
          break;
      }
    } catch (error) {
      console.error('[DeviceApproval] Error handling event:', error);
    }
  }

  /**
   * Handle incoming join request (main terminal only)
   */
  private async handleJoinRequest(request: JoinRequest, event: Event): Promise<void> {
    // Check if already approved
    const isApproved = this.approvedDevices.some(d => d.terminalId === request.terminalId);
    if (isApproved) {
      console.log('[DeviceApproval] Device already approved:', request.terminalId);
      return;
    }

    // Check if already pending
    const isPending = this.pendingRequests.some(r => r.terminalId === request.terminalId);
    if (!isPending) {
      this.pendingRequests.push(request);
      console.log('[DeviceApproval] New join request from:', request.terminalName);
    }
  }

  /**
   * Handle join approval (affects sub-terminals)
   */
  private async handleJoinApproval(approval: JoinApproval, event: Event): Promise<void> {
    const myPubkey = nostrService.getPublicKey();

    // Check if this approval is for me
    if (approval.terminalPubkey === myPubkey) {
      this.myApprovalStatus = approval.approved ? 'approved' : 'denied';
      await SecureStore.setItemAsync(APPROVAL_STATUS_KEY, this.myApprovalStatus);
      console.log('[DeviceApproval] My approval status:', this.myApprovalStatus);
      return;
    }

    // For main terminal: add to approved devices list
    if (approval.approved) {
      const existingIndex = this.approvedDevices.findIndex(d => d.terminalId === approval.terminalId);

      if (existingIndex === -1) {
        // Find the original request to get terminal name
        const request = this.pendingRequests.find(r => r.terminalId === approval.terminalId);

        const device: ApprovedDevice = {
          terminalId: approval.terminalId,
          terminalName: request?.terminalName || 'Unknown Terminal',
          terminalPubkey: approval.terminalPubkey,
          terminalType: 'sub',
          approvedAt: approval.approvedAt,
        };

        this.approvedDevices.push(device);
        await this.saveApprovedDevices();
      }

      // Remove from pending
      this.pendingRequests = this.pendingRequests.filter(r => r.terminalId !== approval.terminalId);
    }
  }

  /**
   * Handle device revocation
   */
  private async handleDeviceRevoke(data: { terminalId: string }): Promise<void> {
    const myTerminalId = await SecureStore.getItemAsync('terminal-id');

    if (data.terminalId === myTerminalId) {
      // I've been revoked!
      this.myApprovalStatus = 'denied';
      await SecureStore.setItemAsync(APPROVAL_STATUS_KEY, 'denied');
      console.log('[DeviceApproval] My access has been revoked');
      return;
    }

    // Remove from approved devices
    this.approvedDevices = this.approvedDevices.filter(d => d.terminalId !== data.terminalId);
    await this.saveApprovedDevices();
    console.log('[DeviceApproval] Device revoked:', data.terminalId);
  }

  /**
   * Send a join request (sub-terminal)
   */
  async sendJoinRequest(
    terminalId: string,
    terminalName: string,
    merchantId: string
  ): Promise<void> {
    // Ensure Nostr is initialized
    await nostrService.initialize();

    const pubkey = nostrService.getPublicKey();
    if (!pubkey) throw new Error('Nostr not initialized');

    const request: JoinRequest = {
      terminalId,
      terminalName,
      terminalPubkey: pubkey,
      merchantId,
      requestedAt: Date.now(),
    };

    await nostrService.publishEvent({
      kind: EventKinds.JOIN_REQUEST,
      content: JSON.stringify(request),
      tags: [
        ['m', merchantId],
        ['t', terminalId],
      ],
      created_at: Math.floor(Date.now() / 1000),
    });

    this.myApprovalStatus = 'pending';
    await SecureStore.setItemAsync(APPROVAL_STATUS_KEY, 'pending');

    console.log('[DeviceApproval] Join request sent');
  }

  /**
   * Approve a join request (main terminal)
   */
  async approveDevice(
    request: JoinRequest,
    myTerminalId: string
  ): Promise<void> {
    // Ensure Nostr is initialized
    await nostrService.initialize();

    const approval: JoinApproval = {
      terminalId: request.terminalId,
      terminalPubkey: request.terminalPubkey,
      merchantId: request.merchantId,
      approved: true,
      approvedBy: myTerminalId,
      approvedAt: Date.now(),
    };

    await nostrService.publishEvent({
      kind: EventKinds.JOIN_APPROVAL,
      content: JSON.stringify(approval),
      tags: [
        ['m', request.merchantId],
        ['t', request.terminalId],
        ['p', request.terminalPubkey], // Tag the requesting device's pubkey
      ],
      created_at: Math.floor(Date.now() / 1000),
    });

    // Add to local approved devices (check for duplicates first)
    const exists = this.approvedDevices.some(d => d.terminalId === request.terminalId);
    if (!exists) {
      const device: ApprovedDevice = {
        terminalId: request.terminalId,
        terminalName: request.terminalName,
        terminalPubkey: request.terminalPubkey,
        terminalType: 'sub',
        approvedAt: Date.now(),
      };
      this.approvedDevices.push(device);
      await this.saveApprovedDevices();
    }

    // Remove from pending
    this.pendingRequests = this.pendingRequests.filter(r => r.terminalId !== request.terminalId);

    console.log('[DeviceApproval] Device approved:', request.terminalName);
  }

  /**
   * Deny a join request (main terminal)
   */
  async denyDevice(request: JoinRequest, myTerminalId: string): Promise<void> {
    // Ensure Nostr is initialized
    await nostrService.initialize();

    const approval: JoinApproval = {
      terminalId: request.terminalId,
      terminalPubkey: request.terminalPubkey,
      merchantId: request.merchantId,
      approved: false,
      approvedBy: myTerminalId,
      approvedAt: Date.now(),
    };

    await nostrService.publishEvent({
      kind: EventKinds.JOIN_APPROVAL,
      content: JSON.stringify(approval),
      tags: [
        ['m', request.merchantId],
        ['t', request.terminalId],
        ['p', request.terminalPubkey],
      ],
      created_at: Math.floor(Date.now() / 1000),
    });

    // Remove from pending
    this.pendingRequests = this.pendingRequests.filter(r => r.terminalId !== request.terminalId);

    console.log('[DeviceApproval] Device denied:', request.terminalName);
  }

  /**
   * Revoke an approved device (main terminal)
   */
  async revokeDevice(terminalId: string, merchantId: string): Promise<void> {
    // Ensure Nostr is initialized
    await nostrService.initialize();

    await nostrService.publishEvent({
      kind: EventKinds.DEVICE_REVOKE,
      content: JSON.stringify({ terminalId }),
      tags: [
        ['m', merchantId],
        ['t', terminalId],
      ],
      created_at: Math.floor(Date.now() / 1000),
    });

    // Remove from local approved devices
    this.approvedDevices = this.approvedDevices.filter(d => d.terminalId !== terminalId);
    await this.saveApprovedDevices();

    console.log('[DeviceApproval] Device revoked:', terminalId);
  }

  /**
   * Register this device as the main terminal (auto-approved)
   */
  async registerAsMain(
    terminalId: string,
    terminalName: string,
    merchantId: string
  ): Promise<void> {
    // Ensure Nostr is initialized
    await nostrService.initialize();

    const pubkey = nostrService.getPublicKey();
    if (!pubkey) throw new Error('Nostr not initialized');

    // Check if already registered (prevent duplicates)
    const exists = this.approvedDevices.some(d => d.terminalId === terminalId);
    if (!exists) {
      const device: ApprovedDevice = {
        terminalId,
        terminalName,
        terminalPubkey: pubkey,
        terminalType: 'main',
        approvedAt: Date.now(),
      };
      this.approvedDevices.push(device);
      await this.saveApprovedDevices();
    }

    this.myApprovalStatus = 'approved';
    await SecureStore.setItemAsync(APPROVAL_STATUS_KEY, 'approved');

    console.log('[DeviceApproval] Registered as main terminal');
  }

  /**
   * Check if a terminal is approved to sync
   */
  isTerminalApproved(terminalId: string): boolean {
    return this.approvedDevices.some(d => d.terminalId === terminalId);
  }

  /**
   * Check if this device can sync (approved or is main)
   */
  canSync(): boolean {
    return this.myApprovalStatus === 'approved';
  }

  /**
   * Get my approval status
   */
  getMyApprovalStatus(): ApprovalStatus {
    return this.myApprovalStatus;
  }

  /**
   * Get pending join requests
   */
  getPendingRequests(): JoinRequest[] {
    return [...this.pendingRequests];
  }

  /**
   * Get approved devices
   */
  getApprovedDevices(): ApprovedDevice[] {
    return [...this.approvedDevices];
  }

  /**
   * Save approved devices to storage
   */
  private async saveApprovedDevices(): Promise<void> {
    await SecureStore.setItemAsync(APPROVED_DEVICES_KEY, JSON.stringify(this.approvedDevices));
  }

  /**
   * Reset approval status (for testing/debugging)
   */
  async resetApprovalStatus(): Promise<void> {
    this.myApprovalStatus = 'none';
    await SecureStore.deleteItemAsync(APPROVAL_STATUS_KEY);
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
export const deviceApprovalService = new DeviceApprovalService();

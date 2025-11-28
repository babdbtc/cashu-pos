/**
 * Auto-Enable Sync Hook
 *
 * Automatically enables sync when device is part of an approved sync group.
 * Runs on app startup to ensure sync is always active for synced devices.
 */

import { useEffect, useRef } from 'react';
import { useConfigStore } from '@/store/config.store';
import { deviceApprovalService } from '@/services/device-approval.service';
import { syncService } from '@/services/sync.service';
import { nostrService } from '@/services/nostr.service';

export function useSyncAutoEnable() {
  const { merchantId, terminalId, terminalType, syncEnabled, setSyncEnabled } = useConfigStore();
  const hasChecked = useRef(false);

  useEffect(() => {
    // Only run once on mount
    if (hasChecked.current) return;

    const checkAndEnableSync = async () => {
      try {
        // Skip if no merchant/terminal configured
        if (!merchantId || !terminalId) {
          console.log('[SyncAutoEnable] No merchant/terminal configured, skipping');
          return;
        }

        // Initialize device approval service
        await deviceApprovalService.initialize();

        // Check approval status
        const approvalStatus = deviceApprovalService.getMyApprovalStatus();
        const isMainTerminal = terminalType === 'main';
        const canSync = approvalStatus === 'approved' || isMainTerminal;

        console.log('[SyncAutoEnable] Status:', {
          approvalStatus,
          isMainTerminal,
          canSync,
          currentSyncEnabled: syncEnabled,
        });

        // Auto-enable sync if device can sync but it's not enabled
        if (canSync && !syncEnabled) {
          console.log('[SyncAutoEnable] Auto-enabling sync for approved device');
          setSyncEnabled(true);
        }

        // If sync is enabled, make sure it's running
        if (canSync || syncEnabled) {
          try {
            // Initialize Nostr
            await nostrService.initialize();

            // Initialize sync service
            await syncService.initialize(merchantId, terminalId);

            // Start sync if not already running
            if (!syncService.isRunning()) {
              await syncService.startSync();
              console.log('[SyncAutoEnable] Sync started automatically');
            }

            // Refresh from relays to get latest data
            await syncService.refreshFromRelays();
          } catch (err) {
            console.error('[SyncAutoEnable] Error starting sync:', err);
          }
        }
      } catch (error) {
        console.error('[SyncAutoEnable] Error checking approval status:', error);
      }
    };

    hasChecked.current = true;
    checkAndEnableSync();
  }, [merchantId, terminalId, terminalType, syncEnabled, setSyncEnabled]);
}

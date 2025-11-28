/**
 * Hook to initialize token forwarding service at app startup
 *
 * - Main terminals: Subscribe to receive forwarded tokens from sub-terminals
 * - Sub-terminals: Prepare to forward tokens (actual forwarding happens during payment)
 */

import { useEffect, useRef } from 'react';
import { tokenForwardService } from '@/services/token-forward.service';
import { useConfigStore } from '@/store/config.store';

export function useTokenForwardInit() {
  const initialized = useRef(false);
  const { terminalType, merchantId, syncEnabled } = useConfigStore();

  useEffect(() => {
    // Only initialize once per app session
    if (initialized.current) return;

    // Only initialize if we're in a sync group
    if (!merchantId || !syncEnabled) {
      console.log('[TokenForwardInit] Not in sync group, skipping initialization');
      return;
    }

    const initService = async () => {
      try {
        await tokenForwardService.initialize();
        initialized.current = true;
        console.log('[TokenForwardInit] Token forwarding service initialized as', terminalType);
      } catch (error) {
        console.error('[TokenForwardInit] Failed to initialize:', error);
      }
    };

    initService();

    // Cleanup on unmount
    return () => {
      if (initialized.current) {
        tokenForwardService.cleanup();
        initialized.current = false;
      }
    };
  }, [merchantId, syncEnabled, terminalType]);
}

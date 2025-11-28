/**
 * Payment Error Types
 *
 * Comprehensive error categorization for payment failures with recovery paths.
 */

export type PaymentErrorCode =
  // NFC Hardware Errors
  | 'nfc_disabled'
  | 'nfc_not_supported'
  | 'nfc_read_error'
  // Token Validation Errors
  | 'invalid_token_format'
  | 'wrong_mint'
  | 'insufficient_amount'
  | 'token_already_spent'
  // Network Errors
  | 'network_timeout'
  | 'mint_unavailable'
  | 'swap_failed'
  // Business Logic Errors
  | 'exchange_rate_changed'
  | 'forwarding_failed'
  // Generic
  | 'unknown_error';

export type PaymentErrorSeverity = 'error' | 'warning' | 'info';

export type PaymentErrorRecovery =
  | 'retry'
  | 'fallback_qr'
  | 'force_qr'
  | 'retry_or_qr'
  | 'restart'
  | 'confirm_new_rate'
  | 'accept_partial'
  | 'contact_support';

export interface PaymentErrorDetails {
  code: PaymentErrorCode;
  title: string;
  message: string;
  severity: PaymentErrorSeverity;
  icon: string;
  recovery: PaymentErrorRecovery[];
  technical?: string;
  metadata?: Record<string, any>;
  timestamp: number;
}

// Error configuration map
export const PAYMENT_ERROR_CONFIG: Record<
  PaymentErrorCode,
  Omit<PaymentErrorDetails, 'code' | 'timestamp' | 'technical' | 'metadata'>
> = {
  // NFC Hardware Errors
  nfc_disabled: {
    title: 'NFC is Disabled',
    message: 'Please enable NFC in your device settings to accept tap payments.',
    icon: 'nfc-off',
    severity: 'error',
    recovery: ['fallback_qr', 'restart'],
  },
  nfc_not_supported: {
    title: 'NFC Not Available',
    message: "This device doesn't support NFC. Use QR code scanning instead.",
    icon: 'device',
    severity: 'error',
    recovery: ['force_qr'],
  },
  nfc_read_error: {
    title: "Couldn't Read Tag",
    message: 'Please hold the device steady and try again.',
    icon: 'nfc-error',
    severity: 'error',
    recovery: ['retry', 'fallback_qr'],
  },

  // Token Validation Errors
  invalid_token_format: {
    title: 'Invalid Payment Token',
    message: 'The scanned token is not a valid Cashu token. Please check and try again.',
    icon: 'alert',
    severity: 'error',
    recovery: ['retry'],
  },
  wrong_mint: {
    title: 'Incompatible Token',
    message: 'This token is from a different mint than expected.',
    icon: 'link-off',
    severity: 'error',
    recovery: ['retry'],
  },
  insufficient_amount: {
    title: 'Insufficient Amount',
    message: 'Token amount is less than required.',
    icon: 'currency',
    severity: 'error',
    recovery: ['restart'],
  },
  token_already_spent: {
    title: 'Token Already Used',
    message: 'This token has already been spent. Each token can only be used once.',
    icon: 'check-circle',
    severity: 'error',
    recovery: ['retry'],
  },

  // Network Errors
  network_timeout: {
    title: 'Connection Timeout',
    message: "Couldn't reach the mint server. Check your internet connection.",
    icon: 'wifi-off',
    severity: 'error',
    recovery: ['retry'],
  },
  mint_unavailable: {
    title: 'Mint Server Unavailable',
    message: 'The mint server is temporarily unavailable. Please try again in a moment.',
    icon: 'server',
    severity: 'error',
    recovery: ['retry'],
  },
  swap_failed: {
    title: 'Token Swap Failed',
    message: "Couldn't exchange tokens with the mint. Your payment was not processed.",
    icon: 'refresh',
    severity: 'error',
    recovery: ['retry', 'contact_support'],
  },

  // Business Logic Errors
  exchange_rate_changed: {
    title: 'Price Changed',
    message: 'Exchange rate updated during payment.',
    icon: 'trending',
    severity: 'warning',
    recovery: ['confirm_new_rate', 'restart'],
  },
  forwarding_failed: {
    title: 'Payment Received (Sync Pending)',
    message: 'Payment accepted but couldn\'t sync to main terminal. Will retry automatically.',
    icon: 'sync',
    severity: 'warning',
    recovery: ['accept_partial'],
  },

  // Generic
  unknown_error: {
    title: 'Payment Failed',
    message: 'An unexpected error occurred. Please try again.',
    icon: 'alert',
    severity: 'error',
    recovery: ['retry', 'contact_support'],
  },
};

/**
 * Create a payment error with full details
 */
export function createPaymentError(
  code: PaymentErrorCode,
  technical?: string,
  metadata?: Record<string, any>
): PaymentErrorDetails {
  const config = PAYMENT_ERROR_CONFIG[code] || PAYMENT_ERROR_CONFIG.unknown_error;

  return {
    ...config,
    code,
    technical,
    metadata,
    timestamp: Date.now(),
  };
}

/**
 * Format error message with metadata
 */
export function formatErrorMessage(error: PaymentErrorDetails): string {
  let message = error.message;

  // Add metadata to message if available
  if (error.metadata) {
    if (error.code === 'insufficient_amount') {
      message = `Token amount (${error.metadata.receivedSats} sats) is less than required (${error.metadata.requiredSats} sats).`;
    } else if (error.code === 'wrong_mint') {
      message = `This token is from a different mint. We accept tokens from: ${error.metadata.expectedMint || 'our configured mint'}`;
    } else if (error.code === 'exchange_rate_changed') {
      message = `Exchange rate updated during payment. New amount: ${error.metadata.newAmount} sats (was ${error.metadata.oldAmount} sats).`;
    }
  }

  return message;
}

/**
 * Get primary recovery action for an error
 */
export function getPrimaryRecovery(error: PaymentErrorDetails): PaymentErrorRecovery {
  return error.recovery[0] || 'retry';
}

/**
 * Get user-friendly action label for recovery type
 */
export function getRecoveryActionLabel(recovery: PaymentErrorRecovery): string {
  switch (recovery) {
    case 'retry':
      return 'Try Again';
    case 'fallback_qr':
      return 'Use QR Code Instead';
    case 'force_qr':
      return 'Use QR Code';
    case 'retry_or_qr':
      return 'Try Again';
    case 'restart':
      return 'Start Over';
    case 'confirm_new_rate':
      return 'Accept New Price';
    case 'accept_partial':
      return 'Continue';
    case 'contact_support':
      return 'Contact Support';
    default:
      return 'Cancel';
  }
}

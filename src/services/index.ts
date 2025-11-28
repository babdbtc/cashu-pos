/**
 * Services Index
 *
 * Export all services for easy importing.
 */

// Cashu operations
export * from './cashu.service';

// Exchange rates and currency
export * from './exchange-rate.service';

// NFC handling
export { nfcService, type NfcReadResult, type NfcStatus } from './nfc.service';

// Offline payment queue
export {
  offlineQueueService,
  type QueuedPayment,
  type QueueStatus,
  type QueueConfig,
} from './offline-queue.service';

// Receipt generation
export {
  receiptService,
  type ReceiptData,
  type ReceiptOptions,
} from './receipt.service';

// Payment processing
export {
  paymentProcessor,
  type PaymentRequest,
  type PaymentResult,
  type ProcessorConfig,
  type PaymentEvent,
} from './payment-processor.service';

// Feedback (haptics and sounds)
export {
  feedbackService,
  triggerFeedback,
  haptic,
  type FeedbackType,
} from './feedback.service';

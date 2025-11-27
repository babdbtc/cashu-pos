/**
 * Crypto Polyfill
 *
 * Ensures crypto.getRandomValues is available for @noble/hashes and @cashu/cashu-ts
 * This must be imported before any crypto-dependent libraries.
 */

// This polyfill must be imported first - it sets up globalThis.crypto.getRandomValues
import 'react-native-get-random-values';

// For web environment, ensure crypto is properly assigned from window
if (typeof window !== 'undefined' && window.crypto) {
  if (typeof globalThis.crypto === 'undefined') {
    (globalThis as any).crypto = window.crypto;
  } else if (typeof globalThis.crypto.getRandomValues === 'undefined') {
    globalThis.crypto.getRandomValues = window.crypto.getRandomValues.bind(window.crypto);
  }
  if (typeof globalThis.crypto.subtle === 'undefined' && window.crypto.subtle) {
    (globalThis.crypto as any).subtle = window.crypto.subtle;
  }
}

export {};

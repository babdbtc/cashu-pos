/**
 * Cashu Service
 *
 * Handles all Cashu token operations including parsing, validation,
 * swapping, and mint interactions.
 */

// CRITICAL: Import crypto polyfill before any crypto-dependent code
import '@/lib/crypto-polyfill';

import {
  Mint,
  Wallet,
  getEncodedTokenV4,
  getDecodedToken,
  type Proof,
  type Token as CashuToken,
} from '@cashu/cashu-ts';
import * as Crypto from 'expo-crypto';
import type {
  Token,
  TokenValidationResult,
  MintInfo,
  MintKeyset,
  TokenState,
} from '@/types/mint';
import { normalizeMintUrl } from '@/store/wallet.store';

// Cache for mint connections
const mintCache = new Map<string, Mint>();
const walletCache = new Map<string, Wallet>();

/**
 * Get or create a Mint instance for a given URL
 */
export async function getMint(mintUrl: string): Promise<Mint> {
  const normalizedUrl = normalizeMintUrl(mintUrl);
  if (mintCache.has(normalizedUrl)) {
    return mintCache.get(normalizedUrl)!;
  }

  const mint = new Mint(normalizedUrl);
  mintCache.set(normalizedUrl, mint);
  return mint;
}

/**
 * Get or create a Wallet instance for a given mint
 */
export async function getWallet(mintUrl: string): Promise<Wallet> {
  const normalizedUrl = normalizeMintUrl(mintUrl);
  if (walletCache.has(normalizedUrl)) {
    return walletCache.get(normalizedUrl)!;
  }

  const mint = await getMint(normalizedUrl);
  const wallet = new Wallet(mint, { unit: 'sat' });
  await wallet.loadMint();
  walletCache.set(normalizedUrl, wallet);
  return wallet;
}

/**
 * Parse a Cashu token string into structured data
 */
export function parseToken(tokenString: string): {
  token: Token;
  encoded: string;
} | null {
  try {
    // Handle both cashuA and cashuB prefixed tokens
    const decoded: CashuToken = getDecodedToken(tokenString);

    if (!decoded.proofs || decoded.proofs.length === 0) {
      return null;
    }

    return {
      token: {
        mint: decoded.mint,
        proofs: decoded.proofs as unknown as Token['proofs'],
        unit: decoded.unit,
        memo: decoded.memo,
      },
      encoded: tokenString,
    };
  } catch (error) {
    console.error('Failed to parse token:', error);
    return null;
  }
}

/**
 * Validate a Cashu token
 */
export async function validateToken(
  tokenString: string,
  trustedMints: string[]
): Promise<TokenValidationResult> {
  // Parse the token
  const parsed = parseToken(tokenString);

  if (!parsed) {
    return {
      valid: false,
      error: 'Invalid token format',
    };
  }

  const { token } = parsed;

  // Check if mint is trusted
  if (!trustedMints.includes(token.mint)) {
    return {
      valid: false,
      error: 'Token from untrusted mint',
      mint: token.mint,
    };
  }

  // Check proofs exist
  if (!token.proofs || token.proofs.length === 0) {
    return {
      valid: false,
      error: 'Token has no proofs',
    };
  }

  // Calculate total amount
  const amount = token.proofs.reduce((sum, p) => sum + p.amount, 0);

  // Get keyset ID (should be same for all proofs in a valid token)
  const keysetId = token.proofs[0].id;

  // Verify all proofs use the same keyset
  const allSameKeyset = token.proofs.every((p) => p.id === keysetId);
  if (!allSameKeyset) {
    return {
      valid: false,
      error: 'Token proofs use different keysets',
    };
  }

  return {
    valid: true,
    mint: token.mint,
    amount,
    unit: token.unit || 'sat',
    proofCount: token.proofs.length,
    keysetId,
  };
}

/**
 * Get the total amount of sats in a token
 */
export function getTokenAmount(tokenString: string): number {
  const parsed = parseToken(tokenString);
  if (!parsed) return 0;

  return parsed.token.proofs.reduce((sum, p) => sum + p.amount, 0);
}

/**
 * Check if tokens are already spent
 */
export async function checkTokenState(
  mintUrl: string,
  proofs: Proof[]
): Promise<TokenState[]> {
  try {
    const wallet = await getWallet(mintUrl);
    const states = await wallet.checkProofsStates(proofs);
    return states.map((s: { state: string }) => s.state as TokenState);
  } catch (error) {
    console.error('Failed to check token state:', error);
    throw error;
  }
}

/**
 * Swap tokens for new ones (redeem and re-issue)
 * This is the core operation for receiving payments
 */
export async function swapTokens(
  mintUrl: string,
  proofs: Proof[],
  _amounts?: number[]
): Promise<{ proofs: Proof[]; totalAmount: number }> {
  try {
    const wallet = await getWallet(mintUrl);

    // Create a token for the receive operation
    const token = encodeToken(mintUrl, proofs);

    // Use the new ops builder API for swap/receive
    const newProofs = await wallet.ops.receive(token).run();

    return {
      proofs: newProofs,
      totalAmount: newProofs.reduce((sum: number, p: Proof) => sum + p.amount, 0),
    };
  } catch (error) {
    console.error('Failed to swap tokens:', error);
    throw error;
  }
}

/**
 * Split tokens into specific amounts (for change)
 */
export async function splitTokens(
  mintUrl: string,
  proofs: Proof[],
  keepAmount: number
): Promise<{
  keep: Proof[];
  send: Proof[];
}> {
  try {
    const wallet = await getWallet(mintUrl);

    const inputAmount = proofs.reduce((sum: number, p: Proof) => sum + p.amount, 0);
    const sendAmount = inputAmount - keepAmount;

    if (sendAmount < 0) {
      throw new Error('Keep amount exceeds input amount');
    }

    // Use wallet ops to send/split
    const { keep, send } = await wallet.ops.send(sendAmount, proofs).run();

    return { keep, send };
  } catch (error) {
    console.error('Failed to split tokens:', error);
    throw error;
  }
}

/**
 * Encode proofs back into a token string
 */
export function encodeToken(
  mintUrl: string,
  proofs: Proof[],
  memo?: string
): string {
  return getEncodedTokenV4({
    mint: normalizeMintUrl(mintUrl),
    proofs,
    memo,
  });
}

/**
 * Get mint information
 */
export async function getMintInfo(mintUrl: string): Promise<MintInfo | null> {
  try {
    const mint = await getMint(mintUrl);
    const info = await mint.getInfo();
    return info as unknown as MintInfo;
  } catch (error) {
    console.error('Failed to get mint info:', error);
    return null;
  }
}

/**
 * Get mint keysets
 */
export async function getMintKeysets(mintUrl: string): Promise<MintKeyset[]> {
  try {
    const mint = await getMint(mintUrl);
    const keysets = await mint.getKeySets();
    return keysets.keysets as MintKeyset[];
  } catch (error) {
    console.error('Failed to get mint keysets:', error);
    return [];
  }
}

/**
 * Hash a token for tracking (to prevent replay)
 */
export async function hashToken(tokenString: string): Promise<string> {
  const digest = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    tokenString
  );
  return digest;
}

/**
 * Check if a mint is reachable
 */
export async function isMintOnline(mintUrl: string): Promise<boolean> {
  try {
    const mint = await getMint(mintUrl);
    await mint.getInfo();
    return true;
  } catch {
    return false;
  }
}

/**
 * Clear cached mint/wallet instances
 */
export function clearCache(): void {
  mintCache.clear();
  walletCache.clear();
}

/**
 * Create a mint quote (to receive Lightning payment)
 * Returns a Lightning invoice that when paid, allows minting tokens
 */
export async function createMintQuote(
  mintUrl: string,
  amount: number
): Promise<{
  quote: string;
  request: string; // Lightning invoice (bolt11)
  expiry: number;
}> {
  try {
    const wallet = await getWallet(mintUrl);
    const quote = await wallet.createMintQuote(amount);

    return {
      quote: quote.quote,
      request: quote.request, // This is the Lightning invoice
      expiry: quote.expiry,
    };
  } catch (error) {
    console.error('Failed to create mint quote:', error);
    throw error;
  }
}

/**
 * Check mint quote status (poll to see if Lightning invoice was paid)
 */
export async function checkMintQuote(
  mintUrl: string,
  quoteId: string
): Promise<{
  paid: boolean;
  expiry: number;
}> {
  try {
    const wallet = await getWallet(mintUrl);
    const quote = await wallet.checkMintQuote(quoteId);

    return {
      paid: quote.state === 'PAID',
      expiry: quote.expiry,
    };
  } catch (error) {
    console.error('Failed to check mint quote:', error);
    throw error;
  }
}

/**
 * Mint tokens after Lightning invoice is paid
 */
export async function mintTokens(
  mintUrl: string,
  amount: number,
  quoteId: string
): Promise<Proof[]> {
  try {
    const wallet = await getWallet(mintUrl);
    const proofs = await wallet.mintProofs(amount, quoteId);
    return proofs;
  } catch (error) {
    console.error('Failed to mint tokens:', error);
    throw error;
  }
}

/**
 * Create a melt quote (to pay a Lightning invoice)
 */
export async function createMeltQuote(
  mintUrl: string,
  invoice: string
): Promise<{
  quote: string;
  amount: number;
  fee: number;
}> {
  try {
    const wallet = await getWallet(mintUrl);
    const quote = await wallet.createMeltQuote(invoice);

    return {
      quote: quote.quote,
      amount: quote.amount,
      fee: quote.fee_reserve,
    };
  } catch (error) {
    console.error('Failed to create melt quote:', error);
    throw error;
  }
}

/**
 * Execute a melt (pay Lightning invoice with tokens)
 */
export async function meltTokens(
  mintUrl: string,
  quote: string,
  proofs: Proof[]
): Promise<{
  paid: boolean;
  preimage?: string;
  change?: Proof[];
}> {
  try {
    const wallet = await getWallet(mintUrl);
    const meltQuote = {
      quote,
      amount: 0,
      fee_reserve: 0,
      state: 'UNPAID' as const,
      expiry: 0,
      payment_preimage: null,
      request: '',
      unit: 'sat',
    };
    const result = await wallet.meltProofs(meltQuote, proofs);

    return {
      paid: result.quote.state === 'PAID',
      preimage: result.quote.payment_preimage ?? undefined,
      change: result.change,
    };
  } catch (error) {
    console.error('Failed to melt tokens:', error);
    throw error;
  }
}

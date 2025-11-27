/**
 * Cashu mint-related types
 */

export interface MintInfo {
  name: string;
  pubkey: string;
  version: string;
  description?: string;
  contact?: MintContact[];
  nuts: Record<string, NutSupport>;
}

export interface MintContact {
  method: string;
  info: string;
}

export interface NutSupport {
  supported: boolean;
  methods?: unknown[];
  disabled?: boolean;
}

export interface MintKeyset {
  id: string;
  unit: string;
  active: boolean;
  keys: Record<string, string>; // amount -> pubkey
}

export interface Proof {
  amount: number;
  secret: string;
  C: string;
  id: string; // keyset id
  witness?: any;
}


export interface Token {
  mint: string;
  proofs: Proof[];
  unit?: string;
  memo?: string;
}

export interface EncodedToken {
  token: Token[];
  unit?: string;
  memo?: string;
}

export interface TokenValidationResult {
  valid: boolean;
  error?: string;

  // If valid
  mint?: string;
  amount?: number;
  unit?: string;
  proofCount?: number;
  keysetId?: string;
}

export interface SwapRequest {
  inputs: Proof[];
  outputs: BlindedMessage[];
}

export interface SwapResponse {
  signatures: BlindSignature[];
}

export interface BlindedMessage {
  amount: number;
  id: string;
  B_: string;
}

export interface BlindSignature {
  amount: number;
  id: string;
  C_: string;
}

export interface MeltQuote {
  quote: string;
  amount: number;
  fee_reserve: number;
  state: 'UNPAID' | 'PENDING' | 'PAID';
  expiry: number;
  payment_preimage?: string;
}

export interface MintQuote {
  quote: string;
  request: string; // Lightning invoice
  state: 'UNPAID' | 'PAID' | 'ISSUED';
  expiry: number;
}

export type TokenState = 'UNSPENT' | 'SPENT' | 'PENDING';

export interface TokenStateCheck {
  Y: string;
  state: TokenState;
  witness?: string;
}

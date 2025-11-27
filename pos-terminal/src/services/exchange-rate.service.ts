/**
 * Exchange Rate Service
 *
 * Handles fetching and caching exchange rates for fiat currency display.
 */

import type { ExchangeRate } from '@/types/payment';
import type { CurrencyConfig } from '@/types/config';
import { useConfigStore } from '@/store/config.store';

// Cache for exchange rates
const rateCache = new Map<string, ExchangeRate>();

// Default config values
const DEFAULT_REFRESH_INTERVAL = 60; // seconds
const DEFAULT_MAX_CACHE_AGE = 3600; // seconds

/**
 * Fetch exchange rate from CoinGecko
 */
async function fetchFromCoinGecko(currency: string): Promise<ExchangeRate> {
  const response = await fetch(
    `https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=${currency.toLowerCase()}`
  );

  if (!response.ok) {
    throw new Error(`CoinGecko API error: ${response.status}`);
  }

  const data = await response.json();
  const ratePerBtc = data.bitcoin[currency.toLowerCase()];

  if (!ratePerBtc) {
    throw new Error(`Currency ${currency} not supported`);
  }

  return {
    currency: currency.toUpperCase(),
    ratePerBtc,
    satsPerUnit: Math.round(100_000_000 / ratePerBtc),
    timestamp: new Date(),
    source: 'coingecko',
  };
}

/**
 * Fetch exchange rate from Kraken
 */
async function fetchFromKraken(currency: string): Promise<ExchangeRate> {
  const pair = `XBT${currency.toUpperCase()}`;
  const response = await fetch(
    `https://api.kraken.com/0/public/Ticker?pair=${pair}`
  );

  if (!response.ok) {
    throw new Error(`Kraken API error: ${response.status}`);
  }

  const data = await response.json();

  if (data.error && data.error.length > 0) {
    throw new Error(`Kraken API error: ${data.error.join(', ')}`);
  }

  // Get the first result (pair name might vary)
  const pairData = Object.values(data.result)[0] as { c: string[] };
  const ratePerBtc = parseFloat(pairData.c[0]);

  return {
    currency: currency.toUpperCase(),
    ratePerBtc,
    satsPerUnit: Math.round(100_000_000 / ratePerBtc),
    timestamp: new Date(),
    source: 'kraken',
  };
}

/**
 * Fetch exchange rate from configured source
 */
async function fetchRate(
  currency: string,
  source: CurrencyConfig['exchangeRateSource'],
  customUrl?: string
): Promise<ExchangeRate> {
  switch (source) {
    case 'coingecko':
      return fetchFromCoinGecko(currency);

    case 'kraken':
      return fetchFromKraken(currency);

    case 'binance':
      // Binance implementation would go here
      throw new Error('Binance source not yet implemented');

    case 'custom':
      if (!customUrl) {
        throw new Error('Custom exchange rate URL not configured');
      }
      // Custom endpoint implementation
      const response = await fetch(customUrl);
      const data = await response.json();
      return {
        currency: currency.toUpperCase(),
        ratePerBtc: data.ratePerBtc,
        satsPerUnit: Math.round(100_000_000 / data.ratePerBtc),
        timestamp: new Date(),
        source: 'custom',
      };

    default:
      return fetchFromCoinGecko(currency);
  }
}

/**
 * Get exchange rate (with caching)
 */
export async function getExchangeRate(
  currency: string,
  config?: Partial<CurrencyConfig>
): Promise<ExchangeRate> {
  const cacheKey = currency.toUpperCase();
  const cached = rateCache.get(cacheKey);

  const maxAge = config?.maxCachedRateAge ?? DEFAULT_MAX_CACHE_AGE;

  // Return cached if still valid
  if (cached) {
    const age = (Date.now() - cached.timestamp.getTime()) / 1000;
    if (age < maxAge) {
      return cached;
    }
  }

  // Fetch fresh rate
  try {
    const rate = await fetchRate(
      currency,
      config?.exchangeRateSource ?? 'coingecko',
      config?.customExchangeRateUrl
    );
    rateCache.set(cacheKey, rate);

    // Update store with new rate
    useConfigStore.getState().setExchangeRate(rate.ratePerBtc);

    return rate;
  } catch (error) {
    // If fetch fails and we have a cached rate, return it with a warning
    if (cached) {
      console.warn('Using stale exchange rate due to fetch failure:', error);
      return cached;
    }
    throw error;
  }
}

/**
 * Get cached exchange rate (no fetch)
 */
export function getCachedRate(currency: string): ExchangeRate | null {
  return rateCache.get(currency.toUpperCase()) ?? null;
}

/**
 * Check if rate is stale
 */
export function isRateStale(
  currency: string,
  maxAge: number = DEFAULT_MAX_CACHE_AGE
): boolean {
  const cached = rateCache.get(currency.toUpperCase());
  if (!cached) return true;

  const age = (Date.now() - cached.timestamp.getTime()) / 1000;
  return age > maxAge;
}

/**
 * Get rate age in seconds
 */
export function getRateAge(currency: string): number | null {
  const cached = rateCache.get(currency.toUpperCase());
  if (!cached) return null;

  return (Date.now() - cached.timestamp.getTime()) / 1000;
}

/**
 * Convert sats to fiat
 */
export async function satsToFiat(
  sats: number,
  currency: string,
  config?: Partial<CurrencyConfig>
): Promise<number> {
  const rate = await getExchangeRate(currency, config);
  return (sats / 100_000_000) * rate.ratePerBtc;
}

/**
 * Convert sats to fiat (sync, uses cache only)
 */
export function satsToFiatSync(sats: number, currency: string): number | null {
  const rate = getCachedRate(currency);
  if (!rate) return null;
  return (sats / 100_000_000) * rate.ratePerBtc;
}

/**
 * Convert fiat to sats
 */
export async function fiatToSats(
  fiatAmount: number,
  currency: string,
  config?: Partial<CurrencyConfig>
): Promise<number> {
  const rate = await getExchangeRate(currency, config);
  return Math.round((fiatAmount / rate.ratePerBtc) * 100_000_000);
}

/**
 * Convert fiat to sats (sync, uses cache only)
 */
export function fiatToSatsSync(fiatAmount: number, currency: string): number | null {
  const rate = getCachedRate(currency);
  if (!rate) return null;
  return Math.round((fiatAmount / rate.ratePerBtc) * 100_000_000);
}

/**
 * Clear rate cache
 */
export function clearRateCache(): void {
  rateCache.clear();
}

/**
 * Start auto-refresh of exchange rates
 */
export function startRateRefresh(
  currency: string,
  intervalSeconds: number = DEFAULT_REFRESH_INTERVAL,
  config?: Partial<CurrencyConfig>
): () => void {
  // Fetch immediately
  getExchangeRate(currency, config).catch(console.error);

  // Set up interval
  const intervalId = setInterval(() => {
    getExchangeRate(currency, config).catch(console.error);
  }, intervalSeconds * 1000);

  // Return cleanup function
  return () => clearInterval(intervalId);
}

/**
 * Format currency for display
 */
export function formatFiat(
  amount: number,
  currency: string,
  decimals: number = 2
): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(amount);
}

/**
 * Format sats for display
 */
export function formatSats(sats: number, format: 'sats' | 'btc' = 'sats'): string {
  if (format === 'btc') {
    return `${(sats / 100_000_000).toFixed(8)} BTC`;
  }
  return `${sats.toLocaleString()} sats`;
}

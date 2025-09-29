export const BASE_URL = 'https://api.normalfinance.io';
export const DEFAULT_TIMEOUT = 30000;
export const HEALTH_CHECK_TIMEOUT = 5000;

export const API_ENDPOINTS = {
  transaction: '/transaction',
  health: '/health',
  status: '/status',
  checkWallet: '/api/check-wallet',
} as const;

export const HTTP_ERRORS = {
  TIMEOUT: 'Transaction submission timed out. Please try again.',
  NETWORK: 'Network error. Please check your connection and try again.',
  UNKNOWN: 'An unknown error occurred while submitting transaction.',
} as const;

export const RETRY_CONFIG = {
  MAX_RETRIES: 3,
  BASE_DELAY: 1000,
  MAX_DELAY: 5000,
  NON_RETRYABLE_ERRORS: [
    'Rate limit exceeded',
    'Invalid signature',
    '400',
    '403',
  ],
} as const;
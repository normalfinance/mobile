import { HTTP_ERRORS, RETRY_CONFIG } from '../constants/api.constants';

export const createTimeoutSignal = (timeout: number): AbortSignal => {
  return new AbortController().signal;
};

export const handleHttpError = (error: unknown): Error => {
  if (error instanceof Error) {
    if (error.name === 'TimeoutError') {
      return new Error(HTTP_ERRORS.TIMEOUT);
    }
    if (error.message.includes('NetworkError') || error.message.includes('Failed to fetch')) {
      return new Error(HTTP_ERRORS.NETWORK);
    }
    return error;
  }
  return new Error(HTTP_ERRORS.UNKNOWN);
};

export const isRetryableError = (error: Error): boolean => {
  return !RETRY_CONFIG.NON_RETRYABLE_ERRORS.some(nonRetryable => 
    error.message.includes(nonRetryable)
  );
};

export const calculateRetryDelay = (attempt: number): number => {
  const delay = RETRY_CONFIG.BASE_DELAY * Math.pow(2, attempt - 1);
  return Math.min(delay, RETRY_CONFIG.MAX_DELAY);
};

export const sleep = (ms: number): Promise<void> => {
  return new Promise(resolve => setTimeout(resolve, ms));
};

export const validateHttpResponse = async (response: Response): Promise<any> => {
  const data = await response.json();
  
  if (!response.ok) {
    throw new Error(data.error || `HTTP ${response.status}: ${response.statusText}`);
  }
  
  return data;
};
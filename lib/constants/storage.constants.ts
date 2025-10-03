export const STORAGE_KEYS = {
  WALLET: "stellar_wallet",
  PRIVATE_KEY: "stellar_private_key",
  USER_ID: "user_id",
  ORACLE_CACHE_KEYS: "oracle_cache_keys"
} as const;

export const STORAGE_ERRORS = {
  FAILED_TO_STORE: "Failed to store wallet",
  FAILED_TO_GET: "Failed to get wallet",
  FAILED_TO_DELETE: "Failed to delete wallet",
  FAILED_TO_GET_PRIVATE_KEY: "Failed to get private key",
  FAILED_TO_STORE_USER_ID: "Failed to store user ID",
  FAILED_TO_GET_USER_ID: "Failed to get user ID",
  FAILED_TO_MANAGE_CACHE: "Failed to manage cache keys",
  FAILED_TO_CLEAR_CACHE: "Failed to clear cache"
} as const;

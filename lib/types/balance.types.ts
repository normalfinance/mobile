export interface AssetBalance {
  asset_type: 'native' | 'credit_alphanum4' | 'credit_alphanum12';
  asset_code?: string;
  asset_issuer?: string;
  balance: string;
  limit?: string;
  buying_liabilities?: string;
  selling_liabilities?: string;
}

export interface WalletBalance {
  publicKey: string;
  balances: AssetBalance[];
  sequence: string;
  subentry_count: number;
  last_modified_ledger: number;
  last_modified_time: string;
  thresholds: {
    low_threshold: number;
    med_threshold: number;
    high_threshold: number;
  };
  flags: {
    auth_required: boolean;
    auth_revocable: boolean;
    auth_immutable: boolean;
  };
  signers: Array<{
    weight: number;
    key: string;
    type: string;
  }>;
  data: Record<string, string>;
}

export interface DisplayAsset {
  asset_code: string;
  asset_issuer?: string;
  balance: string;
  asset_type: AssetBalance['asset_type'];
  display_name: string;
  logo_url?: string;
}

export interface BalanceError {
  code: string;
  message: string;
  details?: any;
}
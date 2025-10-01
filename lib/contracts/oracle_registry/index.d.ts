/// <reference types="node" />
/// <reference types="node" />
import type { i128, Option, u128, u32, u64 } from '@stellar/stellar-sdk/contract';
import { AssembledTransaction, Client as ContractClient, ClientOptions as ContractClientOptions, MethodOptions } from '@stellar/stellar-sdk/contract';
import { Buffer } from 'buffer';
export * from '@stellar/stellar-sdk';
export * as contract from '@stellar/stellar-sdk/contract';
export * as rpc from '@stellar/stellar-sdk/rpc';
export declare const OracleRegistryError: {
    /**
     * OracleRegistryError
     */
    15: {
        message: string;
    };
    17: {
        message: string;
    };
    18: {
        message: string;
    };
    19: {
        message: string;
    };
    20: {
        message: string;
    };
    21: {
        message: string;
    };
    22: {
        message: string;
    };
    23: {
        message: string;
    };
    24: {
        message: string;
    };
    25: {
        message: string;
    };
    26: {
        message: string;
    };
};
export declare const AccessControlError: {
    /**
     * AccessControlError
     */
    101: {
        message: string;
    };
    102: {
        message: string;
    };
    103: {
        message: string;
    };
    104: {
        message: string;
    };
    2906: {
        message: string;
    };
    2907: {
        message: string;
    };
    2908: {
        message: string;
    };
};
/**
 * Price data for an asset at a specific timestamp
 */
export interface PriceData {
    price: i128;
    timestamp: u64;
}
/**
 * Asset type
 */
export type Asset = {
    tag: 'Stellar';
    values: readonly [string];
} | {
    tag: 'Other';
    values: readonly [string];
};
export declare const UpgradeError: {
    /**
     * UpgradeError
     */
    2906: {
        message: string;
    };
    2907: {
        message: string;
    };
    2908: {
        message: string;
    };
};
export declare const MathError: {
    /**
     * MathError: NumberOverflow
     */
    510: {
        message: string;
    };
    511: {
        message: string;
    };
};
export declare const OracleError: {
    /**
     * OracleError: OracleNonPositive
     */
    601: {
        message: string;
    };
    602: {
        message: string;
    };
    603: {
        message: string;
    };
};
export declare const StorageError: {
    /**
     * StorageError
     */
    501: {
        message: string;
    };
    502: {
        message: string;
    };
};
export declare const ValidationError: {
    /**
     * ValidationError
     */
    801: {
        message: string;
    };
    802: {
        message: string;
    };
    803: {
        message: string;
    };
    804: {
        message: string;
    };
};
export interface PrivilegedAddresses {
    emergency_admin: string;
    emergency_pause_admins: Array<string>;
    operations_admin: string;
    pause_admin: string;
    rewards_admin: string;
}
export interface OraclePriceData {
    delay: Delay;
    price: u128;
}
export interface OracleInfo {
    address: string;
    decimals: u32;
    frozen: boolean;
    last_updated: u64;
    sanitize_clamp_denominator: u64;
}
export interface MutableOracleInfo {
    address: Option<string>;
    decimals: Option<u32>;
    frozen: Option<boolean>;
    sanitize_clamp_denominator: Option<u64>;
}
export type NormalAction = {
    tag: 'PoolInit';
    values: void;
} | {
    tag: 'AddLiquidity';
    values: void;
} | {
    tag: 'RemoveLiquidity';
    values: void;
} | {
    tag: 'Swap';
    values: void;
} | {
    tag: 'UpdateTwap';
    values: void;
} | {
    tag: 'Rebalance';
    values: void;
} | {
    tag: 'ClaimInsurance';
    values: void;
};
export interface PriceDivergenceGuardRails {
    oracle_twap_percent_divergence: u64;
}
export interface ValidityGuardRails {
    seconds_before_stale_for_pool: u64;
    too_volatile_ratio: u64;
}
export interface OracleGuardRails {
    price_divergence: PriceDivergenceGuardRails;
    validity: ValidityGuardRails;
}
export type OracleValidity = {
    tag: 'NonPositive';
    values: void;
} | {
    tag: 'TooVolatile';
    values: void;
} | {
    tag: 'StaleForPool';
    values: void;
} | {
    tag: 'Frozen';
    values: void;
} | {
    tag: 'Valid';
    values: void;
};
export interface HistoricalOracleData {
    last_oracle_price: u128;
    last_oracle_price_twap: u128;
    last_oracle_price_twap_ts: u64;
}
export interface Pool {
    base_asset: string;
    fee_fraction: u32;
    insurance_claim: InsuranceClaim;
    liquidity_max_imbalance: u128;
    quote_asset: string;
    status: PoolStatus;
    tier: PoolTier;
    token_b: string;
}
export type PoolStatus = {
    tag: 'Initialized';
    values: void;
} | {
    tag: 'Active';
    values: void;
} | {
    tag: 'Frozen';
    values: void;
} | {
    tag: 'ReduceOnly';
    values: void;
} | {
    tag: 'Settlement';
    values: void;
} | {
    tag: 'Delisted';
    values: void;
};
export type PoolTier = {
    tag: 'A';
    values: void;
} | {
    tag: 'B';
    values: void;
} | {
    tag: 'C';
    values: void;
} | {
    tag: 'Speculative';
    values: void;
} | {
    tag: 'HighlySpeculative';
    values: void;
} | {
    tag: 'Isolated';
    values: void;
};
export interface InsuranceClaim {
    last_revenue_withdraw_ts: u64;
    quote_max_insurance: u128;
    quote_settled_insurance: u128;
    rev_withdraw_since_last_settle: i128;
}
export interface PoolResponse {
    pool: Pool;
    token_a: AddressAndAmount;
    token_b: AddressAndAmount;
    token_share: AddressAndAmount;
}
export interface PoolInfo {
    pool_address: string;
    pool_response: PoolResponse;
}
export interface RewardConfig {
    reward_token: string;
}
export interface InitializeParams {
    admin: string;
    assets: readonly [string, string];
    fee_fraction: u32;
    lp_token_info: TokenInitInfo;
    oracle_registry: string;
    privileged_addrs: PrivilegedAddresses;
    quote_max_insurance: u128;
    router: string;
    synthetic_sac_address: string;
    tier: PoolTier;
    token_b: string;
}
export interface InitializeAllParams {
    base: InitializeParams;
    plane: string;
    reward_config: RewardConfig;
}
export type SwapDirection = {
    tag: 'Buy';
    values: void;
} | {
    tag: 'Sell';
    values: void;
};
export interface TokenInitInfo {
    name: string;
    symbol: string;
    token_wasm_hash: Buffer;
}
export interface AddressAndAmount {
    address: string;
    amount: u128;
}
export type Delay = readonly [u64];
export interface Client {
    /**
     * Construct and simulate a initialize transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
     */
    initialize: ({ admin, emergency_admin }: {
        admin: string;
        emergency_admin: string;
    }, options?: {
        /**
         * The fee to pay for the transaction. Default: BASE_FEE
         */
        fee?: number;
        /**
         * The maximum amount of time to wait for the transaction to complete. Default: DEFAULT_TIMEOUT
         */
        timeoutInSeconds?: number;
        /**
         * Whether to automatically simulate the transaction when constructing the AssembledTransaction. Default: true
         */
        simulate?: boolean;
    }) => Promise<AssembledTransaction<null>>;
    /**
     * Construct and simulate a get_price transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
     */
    get_price: ({ asset }: {
        asset: string;
    }, options?: {
        /**
         * The fee to pay for the transaction. Default: BASE_FEE
         */
        fee?: number;
        /**
         * The maximum amount of time to wait for the transaction to complete. Default: DEFAULT_TIMEOUT
         */
        timeoutInSeconds?: number;
        /**
         * Whether to automatically simulate the transaction when constructing the AssembledTransaction. Default: true
         */
        simulate?: boolean;
    }) => Promise<AssembledTransaction<readonly [HistoricalOracleData, OracleValidity]>>;
    /**
     * Construct and simulate a get_last_price transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
     */
    get_last_price: ({ asset }: {
        asset: string;
    }, options?: {
        /**
         * The fee to pay for the transaction. Default: BASE_FEE
         */
        fee?: number;
        /**
         * The maximum amount of time to wait for the transaction to complete. Default: DEFAULT_TIMEOUT
         */
        timeoutInSeconds?: number;
        /**
         * Whether to automatically simulate the transaction when constructing the AssembledTransaction. Default: true
         */
        simulate?: boolean;
    }) => Promise<AssembledTransaction<HistoricalOracleData>>;
    /**
     * Construct and simulate a get_oracle transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
     */
    get_oracle: ({ asset }: {
        asset: string;
    }, options?: {
        /**
         * The fee to pay for the transaction. Default: BASE_FEE
         */
        fee?: number;
        /**
         * The maximum amount of time to wait for the transaction to complete. Default: DEFAULT_TIMEOUT
         */
        timeoutInSeconds?: number;
        /**
         * Whether to automatically simulate the transaction when constructing the AssembledTransaction. Default: true
         */
        simulate?: boolean;
    }) => Promise<AssembledTransaction<OracleInfo>>;
    /**
     * Construct and simulate a get_oracle_guard_rails transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
     */
    get_oracle_guard_rails: (options?: {
        /**
         * The fee to pay for the transaction. Default: BASE_FEE
         */
        fee?: number;
        /**
         * The maximum amount of time to wait for the transaction to complete. Default: DEFAULT_TIMEOUT
         */
        timeoutInSeconds?: number;
        /**
         * Whether to automatically simulate the transaction when constructing the AssembledTransaction. Default: true
         */
        simulate?: boolean;
    }) => Promise<AssembledTransaction<OracleGuardRails>>;
    /**
     * Construct and simulate a version transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
     */
    version: (options?: {
        /**
         * The fee to pay for the transaction. Default: BASE_FEE
         */
        fee?: number;
        /**
         * The maximum amount of time to wait for the transaction to complete. Default: DEFAULT_TIMEOUT
         */
        timeoutInSeconds?: number;
        /**
         * Whether to automatically simulate the transaction when constructing the AssembledTransaction. Default: true
         */
        simulate?: boolean;
    }) => Promise<AssembledTransaction<u32>>;
    /**
     * Construct and simulate a commit_upgrade transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
     */
    commit_upgrade: ({ admin, new_wasm_hash }: {
        admin: string;
        new_wasm_hash: Buffer;
    }, options?: {
        /**
         * The fee to pay for the transaction. Default: BASE_FEE
         */
        fee?: number;
        /**
         * The maximum amount of time to wait for the transaction to complete. Default: DEFAULT_TIMEOUT
         */
        timeoutInSeconds?: number;
        /**
         * Whether to automatically simulate the transaction when constructing the AssembledTransaction. Default: true
         */
        simulate?: boolean;
    }) => Promise<AssembledTransaction<null>>;
    /**
     * Construct and simulate a apply_upgrade transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
     */
    apply_upgrade: ({ admin }: {
        admin: string;
    }, options?: {
        /**
         * The fee to pay for the transaction. Default: BASE_FEE
         */
        fee?: number;
        /**
         * The maximum amount of time to wait for the transaction to complete. Default: DEFAULT_TIMEOUT
         */
        timeoutInSeconds?: number;
        /**
         * Whether to automatically simulate the transaction when constructing the AssembledTransaction. Default: true
         */
        simulate?: boolean;
    }) => Promise<AssembledTransaction<Buffer>>;
    /**
     * Construct and simulate a revert_upgrade transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
     */
    revert_upgrade: ({ admin }: {
        admin: string;
    }, options?: {
        /**
         * The fee to pay for the transaction. Default: BASE_FEE
         */
        fee?: number;
        /**
         * The maximum amount of time to wait for the transaction to complete. Default: DEFAULT_TIMEOUT
         */
        timeoutInSeconds?: number;
        /**
         * Whether to automatically simulate the transaction when constructing the AssembledTransaction. Default: true
         */
        simulate?: boolean;
    }) => Promise<AssembledTransaction<null>>;
    /**
     * Construct and simulate a set_emergency_mode transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
     */
    set_emergency_mode: ({ emergency_admin, value }: {
        emergency_admin: string;
        value: boolean;
    }, options?: {
        /**
         * The fee to pay for the transaction. Default: BASE_FEE
         */
        fee?: number;
        /**
         * The maximum amount of time to wait for the transaction to complete. Default: DEFAULT_TIMEOUT
         */
        timeoutInSeconds?: number;
        /**
         * Whether to automatically simulate the transaction when constructing the AssembledTransaction. Default: true
         */
        simulate?: boolean;
    }) => Promise<AssembledTransaction<null>>;
    /**
     * Construct and simulate a get_emergency_mode transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
     */
    get_emergency_mode: (options?: {
        /**
         * The fee to pay for the transaction. Default: BASE_FEE
         */
        fee?: number;
        /**
         * The maximum amount of time to wait for the transaction to complete. Default: DEFAULT_TIMEOUT
         */
        timeoutInSeconds?: number;
        /**
         * Whether to automatically simulate the transaction when constructing the AssembledTransaction. Default: true
         */
        simulate?: boolean;
    }) => Promise<AssembledTransaction<boolean>>;
    /**
     * Construct and simulate a register_oracle transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
     */
    register_oracle: ({ admin, asset, oracle_addr, decimals, sanitize_clamp_denominator, }: {
        admin: string;
        asset: string;
        oracle_addr: string;
        decimals: u32;
        sanitize_clamp_denominator: u64;
    }, options?: {
        /**
         * The fee to pay for the transaction. Default: BASE_FEE
         */
        fee?: number;
        /**
         * The maximum amount of time to wait for the transaction to complete. Default: DEFAULT_TIMEOUT
         */
        timeoutInSeconds?: number;
        /**
         * Whether to automatically simulate the transaction when constructing the AssembledTransaction. Default: true
         */
        simulate?: boolean;
    }) => Promise<AssembledTransaction<OracleInfo>>;
    /**
     * Construct and simulate a update_oracle transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
     */
    update_oracle: ({ admin, asset, params }: {
        admin: string;
        asset: string;
        params: MutableOracleInfo;
    }, options?: {
        /**
         * The fee to pay for the transaction. Default: BASE_FEE
         */
        fee?: number;
        /**
         * The maximum amount of time to wait for the transaction to complete. Default: DEFAULT_TIMEOUT
         */
        timeoutInSeconds?: number;
        /**
         * Whether to automatically simulate the transaction when constructing the AssembledTransaction. Default: true
         */
        simulate?: boolean;
    }) => Promise<AssembledTransaction<OracleInfo>>;
    /**
     * Construct and simulate a delete_oracle transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
     */
    delete_oracle: ({ admin, asset }: {
        admin: string;
        asset: string;
    }, options?: {
        /**
         * The fee to pay for the transaction. Default: BASE_FEE
         */
        fee?: number;
        /**
         * The maximum amount of time to wait for the transaction to complete. Default: DEFAULT_TIMEOUT
         */
        timeoutInSeconds?: number;
        /**
         * Whether to automatically simulate the transaction when constructing the AssembledTransaction. Default: true
         */
        simulate?: boolean;
    }) => Promise<AssembledTransaction<null>>;
    /**
     * Construct and simulate a set_oracle_price transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
     */
    set_oracle_price: ({ admin, asset, price }: {
        admin: string;
        asset: string;
        price: u128;
    }, options?: {
        /**
         * The fee to pay for the transaction. Default: BASE_FEE
         */
        fee?: number;
        /**
         * The maximum amount of time to wait for the transaction to complete. Default: DEFAULT_TIMEOUT
         */
        timeoutInSeconds?: number;
        /**
         * Whether to automatically simulate the transaction when constructing the AssembledTransaction. Default: true
         */
        simulate?: boolean;
    }) => Promise<AssembledTransaction<null>>;
    /**
     * Construct and simulate a set_oracle_guard_rails transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
     */
    set_oracle_guard_rails: ({ admin, oracle_guard_rails }: {
        admin: string;
        oracle_guard_rails: OracleGuardRails;
    }, options?: {
        /**
         * The fee to pay for the transaction. Default: BASE_FEE
         */
        fee?: number;
        /**
         * The maximum amount of time to wait for the transaction to complete. Default: DEFAULT_TIMEOUT
         */
        timeoutInSeconds?: number;
        /**
         * Whether to automatically simulate the transaction when constructing the AssembledTransaction. Default: true
         */
        simulate?: boolean;
    }) => Promise<AssembledTransaction<null>>;
    /**
     * Construct and simulate a commit_transfer_ownership transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
     */
    commit_transfer_ownership: ({ admin, role_name, new_address }: {
        admin: string;
        role_name: string;
        new_address: string;
    }, options?: {
        /**
         * The fee to pay for the transaction. Default: BASE_FEE
         */
        fee?: number;
        /**
         * The maximum amount of time to wait for the transaction to complete. Default: DEFAULT_TIMEOUT
         */
        timeoutInSeconds?: number;
        /**
         * Whether to automatically simulate the transaction when constructing the AssembledTransaction. Default: true
         */
        simulate?: boolean;
    }) => Promise<AssembledTransaction<null>>;
    /**
     * Construct and simulate a apply_transfer_ownership transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
     */
    apply_transfer_ownership: ({ admin, role_name }: {
        admin: string;
        role_name: string;
    }, options?: {
        /**
         * The fee to pay for the transaction. Default: BASE_FEE
         */
        fee?: number;
        /**
         * The maximum amount of time to wait for the transaction to complete. Default: DEFAULT_TIMEOUT
         */
        timeoutInSeconds?: number;
        /**
         * Whether to automatically simulate the transaction when constructing the AssembledTransaction. Default: true
         */
        simulate?: boolean;
    }) => Promise<AssembledTransaction<null>>;
    /**
     * Construct and simulate a revert_transfer_ownership transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
     */
    revert_transfer_ownership: ({ admin, role_name }: {
        admin: string;
        role_name: string;
    }, options?: {
        /**
         * The fee to pay for the transaction. Default: BASE_FEE
         */
        fee?: number;
        /**
         * The maximum amount of time to wait for the transaction to complete. Default: DEFAULT_TIMEOUT
         */
        timeoutInSeconds?: number;
        /**
         * Whether to automatically simulate the transaction when constructing the AssembledTransaction. Default: true
         */
        simulate?: boolean;
    }) => Promise<AssembledTransaction<null>>;
    /**
     * Construct and simulate a get_future_address transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
     */
    get_future_address: ({ role_name }: {
        role_name: string;
    }, options?: {
        /**
         * The fee to pay for the transaction. Default: BASE_FEE
         */
        fee?: number;
        /**
         * The maximum amount of time to wait for the transaction to complete. Default: DEFAULT_TIMEOUT
         */
        timeoutInSeconds?: number;
        /**
         * Whether to automatically simulate the transaction when constructing the AssembledTransaction. Default: true
         */
        simulate?: boolean;
    }) => Promise<AssembledTransaction<string>>;
}
export declare class Client extends ContractClient {
    readonly options: ContractClientOptions;
    static deploy<T = Client>(
    /** Options for initializing a Client as well as for calling a method, with extras specific to deploying. */
    options: MethodOptions & Omit<ContractClientOptions, 'contractId'> & {
        /** The hash of the Wasm blob, which must already be installed on-chain. */
        wasmHash: Buffer | string;
        /** Salt used to generate the contract's ID. Passed through to {@link Operation.createCustomContract}. Default: random. */
        salt?: Buffer | Uint8Array;
        /** The format used to decode `wasmHash`, if it's provided as a string. */
        format?: 'hex' | 'base64';
    }): Promise<AssembledTransaction<T>>;
    constructor(options: ContractClientOptions);
    readonly fromJSON: {
        initialize: (json: string) => AssembledTransaction<null>;
        get_price: (json: string) => AssembledTransaction<readonly [HistoricalOracleData, OracleValidity]>;
        get_last_price: (json: string) => AssembledTransaction<HistoricalOracleData>;
        get_oracle: (json: string) => AssembledTransaction<OracleInfo>;
        get_oracle_guard_rails: (json: string) => AssembledTransaction<OracleGuardRails>;
        version: (json: string) => AssembledTransaction<number>;
        commit_upgrade: (json: string) => AssembledTransaction<null>;
        apply_upgrade: (json: string) => AssembledTransaction<Buffer>;
        revert_upgrade: (json: string) => AssembledTransaction<null>;
        set_emergency_mode: (json: string) => AssembledTransaction<null>;
        get_emergency_mode: (json: string) => AssembledTransaction<boolean>;
        register_oracle: (json: string) => AssembledTransaction<OracleInfo>;
        update_oracle: (json: string) => AssembledTransaction<OracleInfo>;
        delete_oracle: (json: string) => AssembledTransaction<null>;
        set_oracle_price: (json: string) => AssembledTransaction<null>;
        set_oracle_guard_rails: (json: string) => AssembledTransaction<null>;
        commit_transfer_ownership: (json: string) => AssembledTransaction<null>;
        apply_transfer_ownership: (json: string) => AssembledTransaction<null>;
        revert_transfer_ownership: (json: string) => AssembledTransaction<null>;
        get_future_address: (json: string) => AssembledTransaction<string>;
    };
}

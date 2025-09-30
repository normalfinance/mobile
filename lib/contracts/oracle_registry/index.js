"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Client = exports.ValidationError = exports.StorageError = exports.OracleError = exports.MathError = exports.UpgradeError = exports.AccessControlError = exports.OracleRegistryError = exports.rpc = exports.contract = void 0;
const contract_1 = require("@stellar/stellar-sdk/contract");
const buffer_1 = require("buffer");
__exportStar(require("@stellar/stellar-sdk"), exports);
exports.contract = __importStar(require("@stellar/stellar-sdk/contract"));
exports.rpc = __importStar(require("@stellar/stellar-sdk/rpc"));
if (typeof window !== 'undefined') {
    //@ts-ignore Buffer exists
    window.Buffer = window.Buffer || buffer_1.Buffer;
}
exports.OracleRegistryError = {
    /**
     * OracleRegistryError
     */
    15: { message: 'AlreadyInitialized' },
    17: { message: 'InvalidDecimals' },
    18: { message: 'InvalidPrice' },
    19: { message: 'OracleNotRegistered' },
    20: { message: 'PriceOverrideLimitExceeded' },
    21: { message: 'OracleNotFound' },
    22: { message: 'OracleFrozen' },
    23: { message: 'OracleInvalid' },
    24: { message: 'PriceOverrideTooSoon' },
    25: { message: 'OracleAlreadyRegistered' },
    26: { message: 'InvalidClampDenominator' },
};
exports.AccessControlError = {
    /**
     * AccessControlError
     */
    101: { message: 'RoleNotFound' },
    102: { message: 'Unauthorized' },
    103: { message: 'AdminAlreadySet' },
    104: { message: 'BadRoleUsage' },
    2906: { message: 'AnotherActionActive' },
    2907: { message: 'NoActionActive' },
    2908: { message: 'ActionNotReadyYet' },
};
exports.UpgradeError = {
    /**
     * UpgradeError
     */
    2906: { message: 'AnotherActionActive' },
    2907: { message: 'NoActionActive' },
    2908: { message: 'ActionNotReadyYet' },
};
exports.MathError = {
    /**
     * MathError: NumberOverflow
     */
    510: { message: 'NumberOverflow' },
    511: { message: 'MathError' },
};
exports.OracleError = {
    /**
     * OracleError: OracleNonPositive
     */
    601: { message: 'OracleNonPositive' },
    602: { message: 'OracleTooVolatile' },
    603: { message: 'OracleStaleForPool' },
};
exports.StorageError = {
    /**
     * StorageError
     */
    501: { message: 'ValueNotInitialized' },
    502: { message: 'ValueMissing' },
};
exports.ValidationError = {
    /**
     * ValidationError
     */
    801: { message: 'InvalidToken' },
    802: { message: 'InvalidPercentage' },
    803: { message: 'Reentrancy' },
    804: { message: 'ZeroAmount' },
};
class Client extends contract_1.Client {
    options;
    static async deploy(
    /** Options for initializing a Client as well as for calling a method, with extras specific to deploying. */
    options) {
        return contract_1.Client.deploy(null, options);
    }
    constructor(options) {
        super(new contract_1.Spec([
            'AAAAAAAAAAAAAAAKaW5pdGlhbGl6ZQAAAAAAAgAAAAAAAAAFYWRtaW4AAAAAAAATAAAAAAAAAA9lbWVyZ2VuY3lfYWRtaW4AAAAAEwAAAAA=',
            'AAAAAAAAAAAAAAAJZ2V0X3ByaWNlAAAAAAAAAQAAAAAAAAAFYXNzZXQAAAAAAAARAAAAAQAAA+0AAAACAAAH0AAAABRIaXN0b3JpY2FsT3JhY2xlRGF0YQAAB9AAAAAOT3JhY2xlVmFsaWRpdHkAAA==',
            'AAAAAAAAAAAAAAAOZ2V0X2xhc3RfcHJpY2UAAAAAAAEAAAAAAAAABWFzc2V0AAAAAAAAEQAAAAEAAAfQAAAAFEhpc3RvcmljYWxPcmFjbGVEYXRh',
            'AAAAAAAAAAAAAAAKZ2V0X29yYWNsZQAAAAAAAQAAAAAAAAAFYXNzZXQAAAAAAAARAAAAAQAAB9AAAAAKT3JhY2xlSW5mbwAA',
            'AAAAAAAAAAAAAAAWZ2V0X29yYWNsZV9ndWFyZF9yYWlscwAAAAAAAAAAAAEAAAfQAAAAEE9yYWNsZUd1YXJkUmFpbHM=',
            'AAAAAAAAAAAAAAAHdmVyc2lvbgAAAAAAAAAAAQAAAAQ=',
            'AAAAAAAAAAAAAAAOY29tbWl0X3VwZ3JhZGUAAAAAAAIAAAAAAAAABWFkbWluAAAAAAAAEwAAAAAAAAANbmV3X3dhc21faGFzaAAAAAAAA+4AAAAgAAAAAA==',
            'AAAAAAAAAAAAAAANYXBwbHlfdXBncmFkZQAAAAAAAAEAAAAAAAAABWFkbWluAAAAAAAAEwAAAAEAAAPuAAAAIA==',
            'AAAAAAAAAAAAAAAOcmV2ZXJ0X3VwZ3JhZGUAAAAAAAEAAAAAAAAABWFkbWluAAAAAAAAEwAAAAA=',
            'AAAAAAAAAAAAAAASc2V0X2VtZXJnZW5jeV9tb2RlAAAAAAACAAAAAAAAAA9lbWVyZ2VuY3lfYWRtaW4AAAAAEwAAAAAAAAAFdmFsdWUAAAAAAAABAAAAAA==',
            'AAAAAAAAAAAAAAASZ2V0X2VtZXJnZW5jeV9tb2RlAAAAAAAAAAAAAQAAAAE=',
            'AAAAAAAAAAAAAAAPcmVnaXN0ZXJfb3JhY2xlAAAAAAUAAAAAAAAABWFkbWluAAAAAAAAEwAAAAAAAAAFYXNzZXQAAAAAAAARAAAAAAAAAAtvcmFjbGVfYWRkcgAAAAATAAAAAAAAAAhkZWNpbWFscwAAAAQAAAAAAAAAGnNhbml0aXplX2NsYW1wX2Rlbm9taW5hdG9yAAAAAAAGAAAAAQAAB9AAAAAKT3JhY2xlSW5mbwAA',
            'AAAAAAAAAAAAAAANdXBkYXRlX29yYWNsZQAAAAAAAAMAAAAAAAAABWFkbWluAAAAAAAAEwAAAAAAAAAFYXNzZXQAAAAAAAARAAAAAAAAAAZwYXJhbXMAAAAAB9AAAAARTXV0YWJsZU9yYWNsZUluZm8AAAAAAAABAAAH0AAAAApPcmFjbGVJbmZvAAA=',
            'AAAAAAAAAAAAAAANZGVsZXRlX29yYWNsZQAAAAAAAAIAAAAAAAAABWFkbWluAAAAAAAAEwAAAAAAAAAFYXNzZXQAAAAAAAARAAAAAA==',
            'AAAAAAAAAAAAAAAQc2V0X29yYWNsZV9wcmljZQAAAAMAAAAAAAAABWFkbWluAAAAAAAAEwAAAAAAAAAFYXNzZXQAAAAAAAARAAAAAAAAAAVwcmljZQAAAAAAAAoAAAAA',
            'AAAAAAAAAAAAAAAWc2V0X29yYWNsZV9ndWFyZF9yYWlscwAAAAAAAgAAAAAAAAAFYWRtaW4AAAAAAAATAAAAAAAAABJvcmFjbGVfZ3VhcmRfcmFpbHMAAAAAB9AAAAAQT3JhY2xlR3VhcmRSYWlscwAAAAA=',
            'AAAAAAAAAAAAAAAZY29tbWl0X3RyYW5zZmVyX293bmVyc2hpcAAAAAAAAAMAAAAAAAAABWFkbWluAAAAAAAAEwAAAAAAAAAJcm9sZV9uYW1lAAAAAAAAEQAAAAAAAAALbmV3X2FkZHJlc3MAAAAAEwAAAAA=',
            'AAAAAAAAAAAAAAAYYXBwbHlfdHJhbnNmZXJfb3duZXJzaGlwAAAAAgAAAAAAAAAFYWRtaW4AAAAAAAATAAAAAAAAAAlyb2xlX25hbWUAAAAAAAARAAAAAA==',
            'AAAAAAAAAAAAAAAZcmV2ZXJ0X3RyYW5zZmVyX293bmVyc2hpcAAAAAAAAAIAAAAAAAAABWFkbWluAAAAAAAAEwAAAAAAAAAJcm9sZV9uYW1lAAAAAAAAEQAAAAA=',
            'AAAAAAAAAAAAAAASZ2V0X2Z1dHVyZV9hZGRyZXNzAAAAAAABAAAAAAAAAAlyb2xlX25hbWUAAAAAAAARAAAAAQAAABM=',
            'AAAABAAAAAAAAAAAAAAAE09yYWNsZVJlZ2lzdHJ5RXJyb3IAAAAACwAAABNPcmFjbGVSZWdpc3RyeUVycm9yAAAAABJBbHJlYWR5SW5pdGlhbGl6ZWQAAAAAAA8AAAAAAAAAD0ludmFsaWREZWNpbWFscwAAAAARAAAAAAAAAAxJbnZhbGlkUHJpY2UAAAASAAAAAAAAABNPcmFjbGVOb3RSZWdpc3RlcmVkAAAAABMAAAAAAAAAGlByaWNlT3ZlcnJpZGVMaW1pdEV4Y2VlZGVkAAAAAAAUAAAAAAAAAA5PcmFjbGVOb3RGb3VuZAAAAAAAFQAAAAAAAAAMT3JhY2xlRnJvemVuAAAAFgAAAAAAAAANT3JhY2xlSW52YWxpZAAAAAAAABcAAAAAAAAAFFByaWNlT3ZlcnJpZGVUb29Tb29uAAAAGAAAAAAAAAAXT3JhY2xlQWxyZWFkeVJlZ2lzdGVyZWQAAAAAGQAAAAAAAAAXSW52YWxpZENsYW1wRGVub21pbmF0b3IAAAAAGg==',
            'AAAABAAAAAAAAAAAAAAAEkFjY2Vzc0NvbnRyb2xFcnJvcgAAAAAABwAAABJBY2Nlc3NDb250cm9sRXJyb3IAAAAAAAxSb2xlTm90Rm91bmQAAABlAAAAAAAAAAxVbmF1dGhvcml6ZWQAAABmAAAAAAAAAA9BZG1pbkFscmVhZHlTZXQAAAAAZwAAAAAAAAAMQmFkUm9sZVVzYWdlAAAAaAAAAAAAAAATQW5vdGhlckFjdGlvbkFjdGl2ZQAAAAtaAAAAAAAAAA5Ob0FjdGlvbkFjdGl2ZQAAAAALWwAAAAAAAAARQWN0aW9uTm90UmVhZHlZZXQAAAAAAAtc',
            'AAAAAQAAAC9QcmljZSBkYXRhIGZvciBhbiBhc3NldCBhdCBhIHNwZWNpZmljIHRpbWVzdGFtcAAAAAAAAAAACVByaWNlRGF0YQAAAAAAAAIAAAAAAAAABXByaWNlAAAAAAAACwAAAAAAAAAJdGltZXN0YW1wAAAAAAAABg==',
            'AAAAAgAAAApBc3NldCB0eXBlAAAAAAAAAAAABUFzc2V0AAAAAAAAAgAAAAEAAAAAAAAAB1N0ZWxsYXIAAAAAAQAAABMAAAABAAAAAAAAAAVPdGhlcgAAAAAAAAEAAAAR',
            'AAAABAAAAAAAAAAAAAAADFVwZ3JhZGVFcnJvcgAAAAMAAAAMVXBncmFkZUVycm9yAAAAE0Fub3RoZXJBY3Rpb25BY3RpdmUAAAALWgAAAAAAAAAOTm9BY3Rpb25BY3RpdmUAAAAAC1sAAAAAAAAAEUFjdGlvbk5vdFJlYWR5WWV0AAAAAAALXA==',
            'AAAABAAAAAAAAAAAAAAACU1hdGhFcnJvcgAAAAAAAAIAAAAZTWF0aEVycm9yOiBOdW1iZXJPdmVyZmxvdwAAAAAAAA5OdW1iZXJPdmVyZmxvdwAAAAAB/gAAAAAAAAAJTWF0aEVycm9yAAAAAAAB/w==',
            'AAAABAAAAAAAAAAAAAAAC09yYWNsZUVycm9yAAAAAAMAAAAeT3JhY2xlRXJyb3I6IE9yYWNsZU5vblBvc2l0aXZlAAAAAAART3JhY2xlTm9uUG9zaXRpdmUAAAAAAAJZAAAAAAAAABFPcmFjbGVUb29Wb2xhdGlsZQAAAAAAAloAAAAAAAAAEk9yYWNsZVN0YWxlRm9yUG9vbAAAAAACWw==',
            'AAAABAAAAAAAAAAAAAAADFN0b3JhZ2VFcnJvcgAAAAIAAAAMU3RvcmFnZUVycm9yAAAAE1ZhbHVlTm90SW5pdGlhbGl6ZWQAAAAB9QAAAAAAAAAMVmFsdWVNaXNzaW5nAAAB9g==',
            'AAAABAAAAAAAAAAAAAAAD1ZhbGlkYXRpb25FcnJvcgAAAAAEAAAAD1ZhbGlkYXRpb25FcnJvcgAAAAAMSW52YWxpZFRva2VuAAADIQAAAAAAAAARSW52YWxpZFBlcmNlbnRhZ2UAAAAAAAMiAAAAAAAAAApSZWVudHJhbmN5AAAAAAMjAAAAAAAAAApaZXJvQW1vdW50AAAAAAMk',
            'AAAAAQAAAAAAAAAAAAAAE1ByaXZpbGVnZWRBZGRyZXNzZXMAAAAABQAAAAAAAAAPZW1lcmdlbmN5X2FkbWluAAAAABMAAAAAAAAAFmVtZXJnZW5jeV9wYXVzZV9hZG1pbnMAAAAAA+oAAAATAAAAAAAAABBvcGVyYXRpb25zX2FkbWluAAAAEwAAAAAAAAALcGF1c2VfYWRtaW4AAAAAEwAAAAAAAAANcmV3YXJkc19hZG1pbgAAAAAAABM=',
            'AAAAAQAAAAAAAAAAAAAAD09yYWNsZVByaWNlRGF0YQAAAAACAAAAAAAAAAVkZWxheQAAAAAAB9AAAAAFRGVsYXkAAAAAAAAAAAAABXByaWNlAAAAAAAACg==',
            'AAAAAQAAAAAAAAAAAAAACk9yYWNsZUluZm8AAAAAAAUAAAAAAAAAB2FkZHJlc3MAAAAAEwAAAAAAAAAIZGVjaW1hbHMAAAAEAAAAAAAAAAZmcm96ZW4AAAAAAAEAAAAAAAAADGxhc3RfdXBkYXRlZAAAAAYAAAAAAAAAGnNhbml0aXplX2NsYW1wX2Rlbm9taW5hdG9yAAAAAAAG',
            'AAAAAQAAAAAAAAAAAAAAEU11dGFibGVPcmFjbGVJbmZvAAAAAAAABAAAAAAAAAAHYWRkcmVzcwAAAAPoAAAAEwAAAAAAAAAIZGVjaW1hbHMAAAPoAAAABAAAAAAAAAAGZnJvemVuAAAAAAPoAAAAAQAAAAAAAAAac2FuaXRpemVfY2xhbXBfZGVub21pbmF0b3IAAAAAA+gAAAAG',
            'AAAAAgAAAAAAAAAAAAAADE5vcm1hbEFjdGlvbgAAAAcAAAAAAAAAAAAAAAhQb29sSW5pdAAAAAAAAAAAAAAADEFkZExpcXVpZGl0eQAAAAAAAAAAAAAAD1JlbW92ZUxpcXVpZGl0eQAAAAAAAAAAAAAAAARTd2FwAAAAAAAAAAAAAAAKVXBkYXRlVHdhcAAAAAAAAAAAAAAAAAAJUmViYWxhbmNlAAAAAAAAAAAAAAAAAAAOQ2xhaW1JbnN1cmFuY2UAAA==',
            'AAAAAQAAAAAAAAAAAAAAGVByaWNlRGl2ZXJnZW5jZUd1YXJkUmFpbHMAAAAAAAABAAAAAAAAAB5vcmFjbGVfdHdhcF9wZXJjZW50X2RpdmVyZ2VuY2UAAAAAAAY=',
            'AAAAAQAAAAAAAAAAAAAAElZhbGlkaXR5R3VhcmRSYWlscwAAAAAAAgAAAAAAAAAdc2Vjb25kc19iZWZvcmVfc3RhbGVfZm9yX3Bvb2wAAAAAAAAGAAAAAAAAABJ0b29fdm9sYXRpbGVfcmF0aW8AAAAAAAY=',
            'AAAAAQAAAAAAAAAAAAAAEE9yYWNsZUd1YXJkUmFpbHMAAAACAAAAAAAAABBwcmljZV9kaXZlcmdlbmNlAAAH0AAAABlQcmljZURpdmVyZ2VuY2VHdWFyZFJhaWxzAAAAAAAAAAAAAAh2YWxpZGl0eQAAB9AAAAASVmFsaWRpdHlHdWFyZFJhaWxzAAA=',
            'AAAAAgAAAAAAAAAAAAAADk9yYWNsZVZhbGlkaXR5AAAAAAAFAAAAAAAAAAAAAAALTm9uUG9zaXRpdmUAAAAAAAAAAAAAAAALVG9vVm9sYXRpbGUAAAAAAAAAAAAAAAAMU3RhbGVGb3JQb29sAAAAAAAAAAAAAAAGRnJvemVuAAAAAAAAAAAAAAAAAAVWYWxpZAAAAA==',
            'AAAAAQAAAAAAAAAAAAAAFEhpc3RvcmljYWxPcmFjbGVEYXRhAAAAAwAAAAAAAAARbGFzdF9vcmFjbGVfcHJpY2UAAAAAAAAKAAAAAAAAABZsYXN0X29yYWNsZV9wcmljZV90d2FwAAAAAAAKAAAAAAAAABlsYXN0X29yYWNsZV9wcmljZV90d2FwX3RzAAAAAAAABg==',
            'AAAAAQAAAAAAAAAAAAAABFBvb2wAAAAIAAAAAAAAAApiYXNlX2Fzc2V0AAAAAAARAAAAAAAAAAxmZWVfZnJhY3Rpb24AAAAEAAAAAAAAAA9pbnN1cmFuY2VfY2xhaW0AAAAH0AAAAA5JbnN1cmFuY2VDbGFpbQAAAAAAAAAAABdsaXF1aWRpdHlfbWF4X2ltYmFsYW5jZQAAAAAKAAAAAAAAAAtxdW90ZV9hc3NldAAAAAARAAAAAAAAAAZzdGF0dXMAAAAAB9AAAAAKUG9vbFN0YXR1cwAAAAAAAAAAAAR0aWVyAAAH0AAAAAhQb29sVGllcgAAAAAAAAAHdG9rZW5fYgAAAAAT',
            'AAAAAgAAAAAAAAAAAAAAClBvb2xTdGF0dXMAAAAAAAYAAAAAAAAAAAAAAAtJbml0aWFsaXplZAAAAAAAAAAAAAAAAAZBY3RpdmUAAAAAAAAAAAAAAAAABkZyb3plbgAAAAAAAAAAAAAAAAAKUmVkdWNlT25seQAAAAAAAAAAAAAAAAAKU2V0dGxlbWVudAAAAAAAAAAAAAAAAAAIRGVsaXN0ZWQ=',
            'AAAAAgAAAAAAAAAAAAAACFBvb2xUaWVyAAAABgAAAAAAAAAAAAAAAUEAAAAAAAAAAAAAAAAAAAFCAAAAAAAAAAAAAAAAAAABQwAAAAAAAAAAAAAAAAAAC1NwZWN1bGF0aXZlAAAAAAAAAAAAAAAAEUhpZ2hseVNwZWN1bGF0aXZlAAAAAAAAAAAAAAAAAAAISXNvbGF0ZWQ=',
            'AAAAAQAAAAAAAAAAAAAADkluc3VyYW5jZUNsYWltAAAAAAAEAAAAAAAAABhsYXN0X3JldmVudWVfd2l0aGRyYXdfdHMAAAAGAAAAAAAAABNxdW90ZV9tYXhfaW5zdXJhbmNlAAAAAAoAAAAAAAAAF3F1b3RlX3NldHRsZWRfaW5zdXJhbmNlAAAAAAoAAAAAAAAAHnJldl93aXRoZHJhd19zaW5jZV9sYXN0X3NldHRsZQAAAAAACw==',
            'AAAAAQAAAAAAAAAAAAAADFBvb2xSZXNwb25zZQAAAAQAAAAAAAAABHBvb2wAAAfQAAAABFBvb2wAAAAAAAAAB3Rva2VuX2EAAAAH0AAAABBBZGRyZXNzQW5kQW1vdW50AAAAAAAAAAd0b2tlbl9iAAAAB9AAAAAQQWRkcmVzc0FuZEFtb3VudAAAAAAAAAALdG9rZW5fc2hhcmUAAAAH0AAAABBBZGRyZXNzQW5kQW1vdW50',
            'AAAAAQAAAAAAAAAAAAAACFBvb2xJbmZvAAAAAgAAAAAAAAAMcG9vbF9hZGRyZXNzAAAAEwAAAAAAAAANcG9vbF9yZXNwb25zZQAAAAAAB9AAAAAMUG9vbFJlc3BvbnNl',
            'AAAAAQAAAAAAAAAAAAAADFJld2FyZENvbmZpZwAAAAEAAAAAAAAADHJld2FyZF90b2tlbgAAABM=',
            'AAAAAQAAAAAAAAAAAAAAEEluaXRpYWxpemVQYXJhbXMAAAALAAAAAAAAAAVhZG1pbgAAAAAAABMAAAAAAAAABmFzc2V0cwAAAAAD7QAAAAIAAAARAAAAEQAAAAAAAAAMZmVlX2ZyYWN0aW9uAAAABAAAAAAAAAANbHBfdG9rZW5faW5mbwAAAAAAB9AAAAANVG9rZW5Jbml0SW5mbwAAAAAAAAAAAAAPb3JhY2xlX3JlZ2lzdHJ5AAAAABMAAAAAAAAAEHByaXZpbGVnZWRfYWRkcnMAAAfQAAAAE1ByaXZpbGVnZWRBZGRyZXNzZXMAAAAAAAAAABNxdW90ZV9tYXhfaW5zdXJhbmNlAAAAAAoAAAAAAAAABnJvdXRlcgAAAAAAEwAAAAAAAAAVc3ludGhldGljX3NhY19hZGRyZXNzAAAAAAAAEwAAAAAAAAAEdGllcgAAB9AAAAAIUG9vbFRpZXIAAAAAAAAAB3Rva2VuX2IAAAAAEw==',
            'AAAAAQAAAAAAAAAAAAAAE0luaXRpYWxpemVBbGxQYXJhbXMAAAAAAwAAAAAAAAAEYmFzZQAAB9AAAAAQSW5pdGlhbGl6ZVBhcmFtcwAAAAAAAAAFcGxhbmUAAAAAAAATAAAAAAAAAA1yZXdhcmRfY29uZmlnAAAAAAAH0AAAAAxSZXdhcmRDb25maWc=',
            'AAAAAgAAAAAAAAAAAAAADVN3YXBEaXJlY3Rpb24AAAAAAAACAAAAAAAAAAAAAAADQnV5AAAAAAAAAAAAAAAABFNlbGw=',
            'AAAAAQAAAAAAAAAAAAAADVRva2VuSW5pdEluZm8AAAAAAAADAAAAAAAAAARuYW1lAAAAEAAAAAAAAAAGc3ltYm9sAAAAAAAQAAAAAAAAAA90b2tlbl93YXNtX2hhc2gAAAAD7gAAACA=',
            'AAAAAQAAAAAAAAAAAAAAEEFkZHJlc3NBbmRBbW91bnQAAAACAAAAAAAAAAdhZGRyZXNzAAAAABMAAAAAAAAABmFtb3VudAAAAAAACg==',
            'AAAAAQAAAAAAAAAAAAAABURlbGF5AAAAAAAAAQAAAAAAAAABMAAAAAAAAAY=',
        ]), options);
        this.options = options;
    }
    fromJSON = {
        initialize: (this.txFromJSON),
        get_price: (this.txFromJSON),
        get_last_price: (this.txFromJSON),
        get_oracle: (this.txFromJSON),
        get_oracle_guard_rails: (this.txFromJSON),
        version: (this.txFromJSON),
        commit_upgrade: (this.txFromJSON),
        apply_upgrade: (this.txFromJSON),
        revert_upgrade: (this.txFromJSON),
        set_emergency_mode: (this.txFromJSON),
        get_emergency_mode: (this.txFromJSON),
        register_oracle: (this.txFromJSON),
        update_oracle: (this.txFromJSON),
        delete_oracle: (this.txFromJSON),
        set_oracle_price: (this.txFromJSON),
        set_oracle_guard_rails: (this.txFromJSON),
        commit_transfer_ownership: (this.txFromJSON),
        apply_transfer_ownership: (this.txFromJSON),
        revert_transfer_ownership: (this.txFromJSON),
        get_future_address: (this.txFromJSON),
    };
}
exports.Client = Client;

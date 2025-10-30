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
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.Client = exports.ValidationError = exports.StorageError = exports.OracleError = exports.MathError = exports.Errors = exports.RewardsError = exports.AccessControlError = exports.PoolError = exports.LiquidityPoolType = exports.PoolRouterError = exports.rpc = exports.contract = void 0;
const buffer_1 = require("buffer");
const contract_1 = require("@stellar/stellar-sdk/contract");
__exportStar(require("@stellar/stellar-sdk"), exports);
exports.contract = __importStar(require("@stellar/stellar-sdk/contract"));
exports.rpc = __importStar(require("@stellar/stellar-sdk/rpc"));
if (typeof window !== 'undefined') {
    //@ts-ignore Buffer exists
    window.Buffer = window.Buffer || buffer_1.Buffer;
}
exports.PoolRouterError = {
    301: { message: "PoolNotFound" },
    302: { message: "BadFee" },
    303: { message: "ElasticHashMissing" },
    305: { message: "PoolsOverMax" },
    306: { message: "ElasticPoolsOverMax" },
    307: { message: "PathIsEmpty" },
    308: { message: "TokensAreNotForReward" },
    309: { message: "LiquidityNotFilled" },
    310: { message: "LiquidityAlreadyFilled" },
    311: { message: "VotingShareExceedsMax" },
    312: { message: "LiquidityCalculationError" },
    313: { message: "RewardsNotConfigured" },
    314: { message: "RewardsAlreadyConfigured" },
    315: { message: "DuplicatesNotAllowed" },
    316: { message: "InvalidPoolType" },
    317: { message: "RewardDurationTooShort" },
    318: { message: "RewardAmountTooLow" },
    319: { message: "GaugeRewardsDisabledForPool" },
    320: { message: "UnsupportedTokensNum" },
    321: { message: "PathMustEndWithRewardToken" },
    2002: { message: "TokensNotSorted" },
    2020: { message: "InMaxNotSatisfied" }
};
var LiquidityPoolType;
(function (LiquidityPoolType) {
    LiquidityPoolType[LiquidityPoolType["MissingPool"] = 0] = "MissingPool";
    LiquidityPoolType[LiquidityPoolType["ConstantProduct"] = 1] = "ConstantProduct";
    LiquidityPoolType[LiquidityPoolType["ElasticSupply"] = 2] = "ElasticSupply";
    LiquidityPoolType[LiquidityPoolType["Custom"] = 3] = "Custom";
})(LiquidityPoolType || (exports.LiquidityPoolType = LiquidityPoolType = {}));
exports.PoolError = {
    401: { message: "PoolAlreadyExists" },
    404: { message: "PoolNotFound" }
};
exports.AccessControlError = {
    101: { message: "RoleNotFound" },
    102: { message: "Unauthorized" },
    103: { message: "AdminAlreadySet" },
    104: { message: "BadRoleUsage" },
    2906: { message: "AnotherActionActive" },
    2907: { message: "NoActionActive" },
    2908: { message: "ActionNotReadyYet" }
};
exports.RewardsError = {
    701: { message: "PastTimeNotAllowed" },
    702: { message: "SameRewardsConfig" }
};
exports.Errors = {
    2906: { message: "AnotherActionActive" },
    2907: { message: "NoActionActive" },
    2908: { message: "ActionNotReadyYet" }
};
exports.MathError = {
    /**
     * MathError: NumberOverflow
     */
    510: { message: "NumberOverflow" },
    /**
     * MathError: Generic math error
     */
    511: { message: "MathError" },
    /**
     * MathError: Addition operation caused overflow
     */
    512: { message: "AdditionOverflow" },
    /**
     * MathError: Subtraction operation caused underflow
     */
    513: { message: "SubtractionUnderflow" },
    /**
     * MathError: Multiplication operation caused overflow
     */
    514: { message: "MultiplicationOverflow" },
    /**
     * MathError: Division by zero
     */
    515: { message: "DivisionByZero" },
    /**
     * MathError: Type conversion overflow
     */
    516: { message: "ConversionOverflow" },
    /**
     * MathError: Attempted to convert negative value to unsigned type
     */
    517: { message: "NegativeToUnsigned" },
    /**
     * MathError: Fixed-point arithmetic overflow
     */
    518: { message: "FixedPointOverflow" }
};
exports.OracleError = {
    /**
     * OracleError: OracleNonPositive
     */
    601: { message: "OracleNonPositive" },
    602: { message: "OracleTooVolatile" },
    603: { message: "OracleStaleForPool" }
};
exports.StorageError = {
    /**
     * StorageError
     */
    201: { message: "AlreadyInitialized" },
    501: { message: "ValueNotInitialized" },
    502: { message: "ValueMissing" },
    503: { message: "ValueConversionError" }
};
exports.ValidationError = {
    /**
     * ValidationError
     */
    801: { message: "InvalidToken" },
    802: { message: "InvalidPercentage" },
    803: { message: "Reentrancy" },
    804: { message: "ZeroAmount" }
};
class Client extends contract_1.Client {
    static async deploy(
    /** Options for initializing a Client as well as for calling a method, with extras specific to deploying. */
    options) {
        return contract_1.Client.deploy(null, options);
    }
    constructor(options) {
        super(new contract_1.Spec(["AAAAAAAAAAAAAAAJcG9vbF90eXBlAAAAAAAAAgAAAAAAAAAGdG9rZW5zAAAAAAPqAAAAEwAAAAAAAAAKcG9vbF9pbmRleAAAAAAD7gAAACAAAAABAAAAEQ==",
            "AAAAAAAAAAAAAAAIZ2V0X2luZm8AAAACAAAAAAAAAAZ0b2tlbnMAAAAAA+oAAAATAAAAAAAAAApwb29sX2luZGV4AAAAAAPuAAAAIAAAAAEAAAPsAAAAEQAAAAA=",
            "AAAAAAAAAAAAAAAIZ2V0X3Bvb2wAAAACAAAAAAAAAAZ0b2tlbnMAAAAAA+oAAAATAAAAAAAAAApwb29sX2luZGV4AAAAAAPuAAAAIAAAAAEAAAAT",
            "AAAAAAAAAAAAAAAIc2hhcmVfaWQAAAACAAAAAAAAAAZ0b2tlbnMAAAAAA+oAAAATAAAAAAAAAApwb29sX2luZGV4AAAAAAPuAAAAIAAAAAEAAAAT",
            "AAAAAAAAAAAAAAAQZ2V0X3RvdGFsX3NoYXJlcwAAAAIAAAAAAAAABnRva2VucwAAAAAD6gAAABMAAAAAAAAACnBvb2xfaW5kZXgAAAAAA+4AAAAgAAAAAQAAAAo=",
            "AAAAAAAAAAAAAAAMZ2V0X3Jlc2VydmVzAAAAAgAAAAAAAAAGdG9rZW5zAAAAAAPqAAAAEwAAAAAAAAAKcG9vbF9pbmRleAAAAAAD7gAAACAAAAABAAAD6gAAAAo=",
            "AAAAAAAAAAAAAAAGcmViYXNlAAAAAAADAAAAAAAAAAR1c2VyAAAAEwAAAAAAAAAGdG9rZW5zAAAAAAPqAAAAEwAAAAAAAAAKcG9vbF9pbmRleAAAAAAD7gAAACAAAAABAAAD7QAAAAIAAAALAAAACw==",
            "AAAAAAAAAAAAAAAHZGVwb3NpdAAAAAAFAAAAAAAAAAR1c2VyAAAAEwAAAAAAAAAGdG9rZW5zAAAAAAPqAAAAEwAAAAAAAAAKcG9vbF9pbmRleAAAAAAD7gAAACAAAAAAAAAAD2Rlc2lyZWRfYW1vdW50cwAAAAPqAAAACgAAAAAAAAAKbWluX3NoYXJlcwAAAAAACgAAAAEAAAPtAAAAAgAAA+oAAAAKAAAACg==",
            "AAAAAAAAAAAAAAAEc3dhcAAAAAcAAAAAAAAABHVzZXIAAAATAAAAAAAAAAZ0b2tlbnMAAAAAA+oAAAATAAAAAAAAAAh0b2tlbl9pbgAAABMAAAAAAAAACXRva2VuX291dAAAAAAAABMAAAAAAAAACnBvb2xfaW5kZXgAAAAAA+4AAAAgAAAAAAAAAAlpbl9hbW91bnQAAAAAAAAKAAAAAAAAAAdvdXRfbWluAAAAAAoAAAABAAAACg==",
            "AAAAAAAAAAAAAAANZXN0aW1hdGVfc3dhcAAAAAAAAAYAAAAAAAAABnRva2VucwAAAAAD6gAAABMAAAAAAAAACHRva2VuX2luAAAAEwAAAAAAAAAJdG9rZW5fb3V0AAAAAAAAEwAAAAAAAAAKcG9vbF9pbmRleAAAAAAD7gAAACAAAAAAAAAACWluX2Ftb3VudAAAAAAAAAoAAAAAAAAADXJpc2tfcmVkdWNpbmcAAAAAAAABAAAAAQAAAAo=",
            "AAAAAAAAAAAAAAAId2l0aGRyYXcAAAAFAAAAAAAAAAR1c2VyAAAAEwAAAAAAAAAGdG9rZW5zAAAAAAPqAAAAEwAAAAAAAAAKcG9vbF9pbmRleAAAAAAD7gAAACAAAAAAAAAADHNoYXJlX2Ftb3VudAAAAAoAAAAAAAAAC21pbl9hbW91bnRzAAAAA+oAAAAKAAAAAQAAA+oAAAAK",
            "AAAAAAAAAAAAAAANZ2V0X2xpcXVpZGl0eQAAAAAAAAIAAAAAAAAABnRva2VucwAAAAAD6gAAABMAAAAAAAAACnBvb2xfaW5kZXgAAAAAA+4AAAAgAAAAAQAAAAw=",
            "AAAAAAAAAAAAAAAYZ2V0X2xpcXVpZGl0eV9jYWxjdWxhdG9yAAAAAAAAAAEAAAAT",
            "AAAAAAAAAAAAAAAYc2V0X2xpcXVpZGl0eV9jYWxjdWxhdG9yAAAAAgAAAAAAAAAFYWRtaW4AAAAAAAATAAAAAAAAAApjYWxjdWxhdG9yAAAAAAATAAAAAA==",
            "AAAAAAAAAAAAAAAHdmVyc2lvbgAAAAAAAAAAAQAAAAQ=",
            "AAAAAAAAAAAAAAANY29udHJhY3RfbmFtZQAAAAAAAAAAAAABAAAAEQ==",
            "AAAAAAAAAAAAAAAOY29tbWl0X3VwZ3JhZGUAAAAAAAIAAAAAAAAABWFkbWluAAAAAAAAEwAAAAAAAAANbmV3X3dhc21faGFzaAAAAAAAA+4AAAAgAAAAAA==",
            "AAAAAAAAAAAAAAANYXBwbHlfdXBncmFkZQAAAAAAAAEAAAAAAAAABWFkbWluAAAAAAAAEwAAAAEAAAPuAAAAIA==",
            "AAAAAAAAAAAAAAAOcmV2ZXJ0X3VwZ3JhZGUAAAAAAAEAAAAAAAAABWFkbWluAAAAAAAAEwAAAAA=",
            "AAAAAAAAAAAAAAASc2V0X2VtZXJnZW5jeV9tb2RlAAAAAAACAAAAAAAAAA9lbWVyZ2VuY3lfYWRtaW4AAAAAEwAAAAAAAAAFdmFsdWUAAAAAAAABAAAAAA==",
            "AAAAAAAAAAAAAAASZ2V0X2VtZXJnZW5jeV9tb2RlAAAAAAAAAAAAAQAAAAE=",
            "AAAAAAAAAAAAAAAKaW5pdF9hZG1pbgAAAAAAAQAAAAAAAAAHYWNjb3VudAAAAAATAAAAAA==",
            "AAAAAAAAAAAAAAAUc2V0X3ByaXZpbGVnZWRfYWRkcnMAAAAGAAAAAAAAAAVhZG1pbgAAAAAAABMAAAAAAAAADXJld2FyZHNfYWRtaW4AAAAAAAATAAAAAAAAABBvcGVyYXRpb25zX2FkbWluAAAAEwAAAAAAAAALcGF1c2VfYWRtaW4AAAAAEwAAAAAAAAAWZW1lcmdlbmN5X3BhdXNlX2FkbWlucwAAAAAD6gAAABMAAAAAAAAAEHN5c3RlbV9mZWVfYWRtaW4AAAATAAAAAA==",
            "AAAAAAAAAAAAAAAUZ2V0X3ByaXZpbGVnZWRfYWRkcnMAAAAAAAAAAQAAA+wAAAARAAAD6gAAABM=",
            "AAAAAAAAAAAAAAAOc2V0X3Rva2VuX2hhc2gAAAAAAAIAAAAAAAAABWFkbWluAAAAAAAAEwAAAAAAAAAIbmV3X2hhc2gAAAPuAAAAIAAAAAA=",
            "AAAAAAAAAAAAAAANc2V0X3Bvb2xfaGFzaAAAAAAAAAIAAAAAAAAABWFkbWluAAAAAAAAEwAAAAAAAAAIbmV3X2hhc2gAAAPuAAAAIAAAAAA=",
            "AAAAAAAAAAAAAAAVc2V0X2VsYXN0aWNfcG9vbF9oYXNoAAAAAAAAAgAAAAAAAAAFYWRtaW4AAAAAAAATAAAAAAAAAAhuZXdfaGFzaAAAA+4AAAAgAAAAAA==",
            "AAAAAAAAAAAAAAAWc2V0X3Jld2FyZHNfZ2F1Z2VfaGFzaAAAAAAAAgAAAAAAAAAFYWRtaW4AAAAAAAATAAAAAAAAAAhuZXdfaGFzaAAAA+4AAAAgAAAAAA==",
            "AAAAAAAAAAAAAAAQc2V0X3Jld2FyZF90b2tlbgAAAAIAAAAAAAAABWFkbWluAAAAAAAAEwAAAAAAAAAMcmV3YXJkX3Rva2VuAAAAEwAAAAA=",
            "AAAAAAAAAAAAAAAZc2V0X3Byb3RvY29sX2ZlZV9mcmFjdGlvbgAAAAAAAAIAAAAAAAAABWFkbWluAAAAAAAAEwAAAAAAAAAMbmV3X2ZyYWN0aW9uAAAABAAAAAA=",
            "AAAAAAAAAAAAAAASZ2V0X3Jld2FyZHNfY29uZmlnAAAAAAAAAAAAAQAAA+wAAAARAAAACw==",
            "AAAAAAAAAAAAAAAVZ2V0X3Rva2Vuc19mb3JfcmV3YXJkAAAAAAAAAAAAAAEAAAPsAAAD6gAAABMAAAPtAAAAAwAAAAQAAAABAAAADA==",
            "AAAAAAAAAAAAAAATZ2V0X3RvdGFsX2xpcXVpZGl0eQAAAAABAAAAAAAAAAZ0b2tlbnMAAAAAA+oAAAATAAAAAQAAAAw=",
            "AAAAAAAAAAAAAAAVY29uZmlnX2dsb2JhbF9yZXdhcmRzAAAAAAAABAAAAAAAAAAEdXNlcgAAABMAAAAAAAAACnJld2FyZF90cHMAAAAAAAoAAAAAAAAACmV4cGlyZWRfYXQAAAAAAAYAAAAAAAAADHRva2Vuc192b3RlcwAAA+oAAAPtAAAAAgAAA+oAAAATAAAABAAAAAA=",
            "AAAAAAAAAAAAAAAOZmlsbF9saXF1aWRpdHkAAAAAAAIAAAAAAAAABWFkbWluAAAAAAAAEwAAAAAAAAAGdG9rZW5zAAAAAAPqAAAAEwAAAAA=",
            "AAAAAAAAAAAAAAATY29uZmlnX3Bvb2xfcmV3YXJkcwAAAAADAAAAAAAAAAVhZG1pbgAAAAAAABMAAAAAAAAABnRva2VucwAAAAAD6gAAABMAAAAAAAAACnBvb2xfaW5kZXgAAAAAA+4AAAAgAAAAAQAAAAo=",
            "AAAAAAAAAAAAAAAQZ2V0X3Jld2FyZHNfaW5mbwAAAAMAAAAAAAAABHVzZXIAAAATAAAAAAAAAAZ0b2tlbnMAAAAAA+oAAAATAAAAAAAAAApwb29sX2luZGV4AAAAAAPuAAAAIAAAAAEAAAPsAAAAEQAAAAs=",
            "AAAAAAAAAAAAAAAPZ2V0X3VzZXJfcmV3YXJkAAAAAAMAAAAAAAAABHVzZXIAAAATAAAAAAAAAAZ0b2tlbnMAAAAAA+oAAAATAAAAAAAAAApwb29sX2luZGV4AAAAAAPuAAAAIAAAAAEAAAAK",
            "AAAAAAAAAAAAAAAcZ2V0X3RvdGFsX2FjY3VtdWxhdGVkX3Jld2FyZAAAAAIAAAAAAAAABnRva2VucwAAAAAD6gAAABMAAAAAAAAACnBvb2xfaW5kZXgAAAAAA+4AAAAgAAAAAQAAAAo=",
            "AAAAAAAAAAAAAAAbZ2V0X3RvdGFsX2NvbmZpZ3VyZWRfcmV3YXJkAAAAAAIAAAAAAAAABnRva2VucwAAAAAD6gAAABMAAAAAAAAACnBvb2xfaW5kZXgAAAAAA+4AAAAgAAAAAQAAAAo=",
            "AAAAAAAAAAAAAAAYZ2V0X3RvdGFsX2NsYWltZWRfcmV3YXJkAAAAAgAAAAAAAAAGdG9rZW5zAAAAAAPqAAAAEwAAAAAAAAAKcG9vbF9pbmRleAAAAAAD7gAAACAAAAABAAAACg==",
            "AAAAAAAAAAAAAAAcZ2V0X3RvdGFsX291dHN0YW5kaW5nX3Jld2FyZAAAAAIAAAAAAAAABnRva2VucwAAAAAD6gAAABMAAAAAAAAACnBvb2xfaW5kZXgAAAAAA+4AAAAgAAAAAQAAAAo=",
            "AAAAAAAAAAAAAAAdZGlzdHJpYnV0ZV9vdXRzdGFuZGluZ19yZXdhcmQAAAAAAAAEAAAAAAAAAAR1c2VyAAAAEwAAAAAAAAAEZnJvbQAAABMAAAAAAAAABnRva2VucwAAAAAD6gAAABMAAAAAAAAACnBvb2xfaW5kZXgAAAAAA+4AAAAgAAAAAQAAAAo=",
            "AAAAAAAAAAAAAAAFY2xhaW0AAAAAAAADAAAAAAAAAAR1c2VyAAAAEwAAAAAAAAAGdG9rZW5zAAAAAAPqAAAAEwAAAAAAAAAKcG9vbF9pbmRleAAAAAAD7gAAACAAAAABAAAACg==",
            "AAAAAAAAAAAAAAASaW5pdF9zdGFuZGFyZF9wb29sAAAAAAADAAAAAAAAAAR1c2VyAAAAEwAAAAAAAAAGdG9rZW5zAAAAAAPqAAAAEwAAAAAAAAAMZmVlX2ZyYWN0aW9uAAAABAAAAAEAAAPtAAAAAgAAA+4AAAAgAAAAEw==",
            "AAAAAAAAAAAAAAARaW5pdF9lbGFzdGljX3Bvb2wAAAAAAAAEAAAAAAAAAAR1c2VyAAAAEwAAAAAAAAAGdG9rZW5zAAAAAAPqAAAAEwAAAAAAAAAMZmVlX2ZyYWN0aW9uAAAABAAAAAAAAAAGb3JhY2xlAAAAAAATAAAAAQAAA+0AAAACAAAD7gAAACAAAAAT",
            "AAAAAAAAAAAAAAAJZ2V0X3Bvb2xzAAAAAAAAAQAAAAAAAAAGdG9rZW5zAAAAAAPqAAAAEwAAAAEAAAPsAAAD7gAAACAAAAAT",
            "AAAAAAAAAAAAAAALcmVtb3ZlX3Bvb2wAAAAAAwAAAAAAAAAEdXNlcgAAABMAAAAAAAAABnRva2VucwAAAAAD6gAAABMAAAAAAAAACXBvb2xfaGFzaAAAAAAAA+4AAAAgAAAAAA==",
            "AAAAAAAAAAAAAAAVZ2V0X3Rva2Vuc19zZXRzX2NvdW50AAAAAAAAAAAAAAEAAAAK",
            "AAAAAAAAAAAAAAAKZ2V0X3Rva2VucwAAAAAAAQAAAAAAAAAFaW5kZXgAAAAAAAAKAAAAAQAAA+oAAAAT",
            "AAAAAAAAAAAAAAAaZ2V0X3Bvb2xzX2Zvcl90b2tlbnNfcmFuZ2UAAAAAAAIAAAAAAAAABXN0YXJ0AAAAAAAACgAAAAAAAAADZW5kAAAAAAoAAAABAAAD6gAAA+0AAAACAAAD6gAAABMAAAPsAAAD7gAAACAAAAAT",
            "AAAAAAAAAAAAAAAZZ2V0X3Byb3RvY29sX2ZlZV9mcmFjdGlvbgAAAAAAAAAAAAABAAAABA==",
            "AAAAAAAAAAAAAAAgcG9vbF9nYXVnZV9zZXRfcmV3YXJkX3RocmVzaG9sZHMAAAADAAAAAAAAAAVhZG1pbgAAAAAAABMAAAAAAAAAGW1pbl9yZXdhcmRfZXF1aXZhbGVudF9kYXkAAAAAAAAKAAAAAAAAABRtaW5fZHVyYXRpb25fc2Vjb25kcwAAAAYAAAAA",
            "AAAAAAAAAAAAAAAfcG9vbF9nYXVnZV9nZXRfbWluX2RhaWx5X2Ftb3VudAAAAAAAAAAAAQAAAAo=",
            "AAAAAAAAAAAAAAAbcG9vbF9nYXVnZV9nZXRfbWluX2R1cmF0aW9uAAAAAAAAAAABAAAABg==",
            "AAAAAAAAAAAAAAAXcG9vbF9nYXVnZV9zd2l0Y2hfdG9rZW4AAAAAAwAAAAAAAAAFYWRtaW4AAAAAAAATAAAAAAAAAAV0b2tlbgAAAAAAABMAAAAAAAAAB2VuYWJsZWQAAAAAAQAAAAA=",
            "AAAAAAAAAAAAAAAYcG9vbF9nYXVnZV90b2tlbl9lbmFibGVkAAAAAQAAAAAAAAAFdG9rZW4AAAAAAAATAAAAAQAAAAE=",
            "AAAAAAAAAAAAAAAacG9vbF9nYXVnZV9zY2hlZHVsZV9yZXdhcmQAAAAAAAgAAAAAAAAAC2Rpc3RyaWJ1dG9yAAAAABMAAAAAAAAAC3Bvb2xfdG9rZW5zAAAAA+oAAAATAAAAAAAAAAlwb29sX2hhc2gAAAAAAAPuAAAAIAAAAAAAAAAQZGlzdHJpYnV0ZV90b2tlbgAAABMAAAAAAAAAA3RwcwAAAAAKAAAAAAAAAAhzdGFydF9hdAAAA+gAAAAGAAAAAAAAAAhkdXJhdGlvbgAAAAYAAAAAAAAAEXN3YXBzX2NoYWluX3Byb29mAAAAAAAD6gAAA+0AAAADAAAD6gAAABMAAAPuAAAAIAAAABMAAAABAAAAEw==",
            "AAAAAAAAAAAAAAAPc2V0X3Bvb2xzX3BsYW5lAAAAAAIAAAAAAAAABWFkbWluAAAAAAAAEwAAAAAAAAAFcGxhbmUAAAAAAAATAAAAAA==",
            "AAAAAAAAAAAAAAAJZ2V0X3BsYW5lAAAAAAAAAAAAAAEAAAAT",
            "AAAAAAAAAAAAAAAZY29tbWl0X3RyYW5zZmVyX293bmVyc2hpcAAAAAAAAAMAAAAAAAAABWFkbWluAAAAAAAAEwAAAAAAAAAJcm9sZV9uYW1lAAAAAAAAEQAAAAAAAAALbmV3X2FkZHJlc3MAAAAAEwAAAAA=",
            "AAAAAAAAAAAAAAAYYXBwbHlfdHJhbnNmZXJfb3duZXJzaGlwAAAAAgAAAAAAAAAFYWRtaW4AAAAAAAATAAAAAAAAAAlyb2xlX25hbWUAAAAAAAARAAAAAA==",
            "AAAAAAAAAAAAAAAZcmV2ZXJ0X3RyYW5zZmVyX293bmVyc2hpcAAAAAAAAAIAAAAAAAAABWFkbWluAAAAAAAAEwAAAAAAAAAJcm9sZV9uYW1lAAAAAAAAEQAAAAA=",
            "AAAAAAAAAAAAAAASZ2V0X2Z1dHVyZV9hZGRyZXNzAAAAAAABAAAAAAAAAAlyb2xlX25hbWUAAAAAAAARAAAAAQAAABM=",
            "AAAAAAAAAAAAAAATaW5pdF9jb25maWdfc3RvcmFnZQAAAAACAAAAAAAAAAVhZG1pbgAAAAAAABMAAAAAAAAADmNvbmZpZ19zdG9yYWdlAAAAAAATAAAAAA==",
            "AAAABAAAAAAAAAAAAAAAD1Bvb2xSb3V0ZXJFcnJvcgAAAAAWAAAAAAAAAAxQb29sTm90Rm91bmQAAAEtAAAAAAAAAAZCYWRGZWUAAAAAAS4AAAAAAAAAEkVsYXN0aWNIYXNoTWlzc2luZwAAAAABLwAAAAAAAAAMUG9vbHNPdmVyTWF4AAABMQAAAAAAAAATRWxhc3RpY1Bvb2xzT3Zlck1heAAAAAEyAAAAAAAAAAtQYXRoSXNFbXB0eQAAAAEzAAAAAAAAABVUb2tlbnNBcmVOb3RGb3JSZXdhcmQAAAAAAAE0AAAAAAAAABJMaXF1aWRpdHlOb3RGaWxsZWQAAAAAATUAAAAAAAAAFkxpcXVpZGl0eUFscmVhZHlGaWxsZWQAAAAAATYAAAAAAAAAFVZvdGluZ1NoYXJlRXhjZWVkc01heAAAAAAAATcAAAAAAAAAGUxpcXVpZGl0eUNhbGN1bGF0aW9uRXJyb3IAAAAAAAE4AAAAAAAAABRSZXdhcmRzTm90Q29uZmlndXJlZAAAATkAAAAAAAAAGFJld2FyZHNBbHJlYWR5Q29uZmlndXJlZAAAAToAAAAAAAAAFER1cGxpY2F0ZXNOb3RBbGxvd2VkAAABOwAAAAAAAAAPSW52YWxpZFBvb2xUeXBlAAAAATwAAAAAAAAAFlJld2FyZER1cmF0aW9uVG9vU2hvcnQAAAAAAT0AAAAAAAAAElJld2FyZEFtb3VudFRvb0xvdwAAAAABPgAAAAAAAAAbR2F1Z2VSZXdhcmRzRGlzYWJsZWRGb3JQb29sAAAAAT8AAAAAAAAAFFVuc3VwcG9ydGVkVG9rZW5zTnVtAAABQAAAAAAAAAAaUGF0aE11c3RFbmRXaXRoUmV3YXJkVG9rZW4AAAAAAUEAAAAAAAAAD1Rva2Vuc05vdFNvcnRlZAAAAAfSAAAAAAAAABFJbk1heE5vdFNhdGlzZmllZAAAAAAAB+Q=",
            "AAAAAwAAAAAAAAAAAAAAEUxpcXVpZGl0eVBvb2xUeXBlAAAAAAAABAAAAAAAAAALTWlzc2luZ1Bvb2wAAAAAAAAAAAAAAAAPQ29uc3RhbnRQcm9kdWN0AAAAAAEAAAAAAAAADUVsYXN0aWNTdXBwbHkAAAAAAAACAAAAAAAAAAZDdXN0b20AAAAAAAM=",
            "AAAAAQAAAAAAAAAAAAAAEUxpcXVpZGl0eVBvb2xEYXRhAAAAAAAAAgAAAAAAAAAHYWRkcmVzcwAAAAATAAAAAAAAAAlwb29sX3R5cGUAAAAAAAfQAAAAEUxpcXVpZGl0eVBvb2xUeXBlAAAA",
            "AAAAAQAAAAAAAAAAAAAAE0dsb2JhbFJld2FyZHNDb25maWcAAAAAAgAAAAAAAAAKZXhwaXJlZF9hdAAAAAAABgAAAAAAAAADdHBzAAAAAAo=",
            "AAAAAQAAAAAAAAAAAAAAF0xpcXVpZGl0eVBvb2xSZXdhcmRJbmZvAAAAAAMAAAAAAAAACXByb2Nlc3NlZAAAAAAAAAEAAAAAAAAAD3RvdGFsX2xpcXVpZGl0eQAAAAAMAAAAAAAAAAx2b3Rpbmdfc2hhcmUAAAAE",
            "AAAABAAAAAAAAAAAAAAACVBvb2xFcnJvcgAAAAAAAAIAAAAAAAAAEVBvb2xBbHJlYWR5RXhpc3RzAAAAAAABkQAAAAAAAAAMUG9vbE5vdEZvdW5kAAABlA==",
            "AAAABAAAAAAAAAAAAAAAEkFjY2Vzc0NvbnRyb2xFcnJvcgAAAAAABwAAAAAAAAAMUm9sZU5vdEZvdW5kAAAAZQAAAAAAAAAMVW5hdXRob3JpemVkAAAAZgAAAAAAAAAPQWRtaW5BbHJlYWR5U2V0AAAAAGcAAAAAAAAADEJhZFJvbGVVc2FnZQAAAGgAAAAAAAAAE0Fub3RoZXJBY3Rpb25BY3RpdmUAAAALWgAAAAAAAAAOTm9BY3Rpb25BY3RpdmUAAAAAC1sAAAAAAAAAEUFjdGlvbk5vdFJlYWR5WWV0AAAAAAALXA==",
            "AAAAAgAAAAAAAAAAAAAAC1dBU01EYXRhS2V5AAAAAAYAAAAAAAAAAAAAAAlUb2tlbkhhc2gAAAAAAAAAAAAAAAAAAA9Ub2tlbkZ1dHVyZVdBU00AAAAAAAAAAAAAAAAJR2F1Z2VXQVNNAAAAAAAAAAAAAAAAAAAPRnV0dXJlR2F1Z2VXQVNNAAAAAAAAAAAAAAAAEENvbnN0YW50UG9vbEhhc2gAAAAAAAAAAAAAAA9FbGFzdGljUG9vbEhhc2gA",
            "AAAABAAAAAAAAAAAAAAADFJld2FyZHNFcnJvcgAAAAIAAAAAAAAAElBhc3RUaW1lTm90QWxsb3dlZAAAAAACvQAAAAAAAAARU2FtZVJld2FyZHNDb25maWcAAAAAAAK+",
            "AAAAAQAAAAAAAAAAAAAAEFBvb2xSZXdhcmRDb25maWcAAAACAAAAAAAAAApleHBpcmVkX2F0AAAAAAAGAAAAAAAAAAN0cHMAAAAACg==",
            "AAAAAQAAAAAAAAAAAAAADlBvb2xSZXdhcmREYXRhAAAAAAAEAAAAAAAAAAthY2N1bXVsYXRlZAAAAAAKAAAAAAAAAAVibG9jawAAAAAAAAYAAAAAAAAAB2NsYWltZWQAAAAACgAAAAAAAAAJbGFzdF90aW1lAAAAAAAABg==",
            "AAAAAQAAAAAAAAAAAAAADlVzZXJSZXdhcmREYXRhAAAAAAADAAAAAAAAAApsYXN0X2Jsb2NrAAAAAAAGAAAAAAAAABBwb29sX2FjY3VtdWxhdGVkAAAACgAAAAAAAAAIdG9fY2xhaW0AAAAK",
            "AAAABAAAAAAAAAAAAAAABUVycm9yAAAAAAAAAwAAAAAAAAATQW5vdGhlckFjdGlvbkFjdGl2ZQAAAAtaAAAAAAAAAA5Ob0FjdGlvbkFjdGl2ZQAAAAALWwAAAAAAAAARQWN0aW9uTm90UmVhZHlZZXQAAAAAAAtc",
            "AAAABAAAAAAAAAAAAAAACU1hdGhFcnJvcgAAAAAAAAkAAAAZTWF0aEVycm9yOiBOdW1iZXJPdmVyZmxvdwAAAAAAAA5OdW1iZXJPdmVyZmxvdwAAAAAB/gAAAB1NYXRoRXJyb3I6IEdlbmVyaWMgbWF0aCBlcnJvcgAAAAAAAAlNYXRoRXJyb3IAAAAAAAH/AAAALU1hdGhFcnJvcjogQWRkaXRpb24gb3BlcmF0aW9uIGNhdXNlZCBvdmVyZmxvdwAAAAAAABBBZGRpdGlvbk92ZXJmbG93AAACAAAAADFNYXRoRXJyb3I6IFN1YnRyYWN0aW9uIG9wZXJhdGlvbiBjYXVzZWQgdW5kZXJmbG93AAAAAAAAFFN1YnRyYWN0aW9uVW5kZXJmbG93AAACAQAAADNNYXRoRXJyb3I6IE11bHRpcGxpY2F0aW9uIG9wZXJhdGlvbiBjYXVzZWQgb3ZlcmZsb3cAAAAAFk11bHRpcGxpY2F0aW9uT3ZlcmZsb3cAAAAAAgIAAAAbTWF0aEVycm9yOiBEaXZpc2lvbiBieSB6ZXJvAAAAAA5EaXZpc2lvbkJ5WmVybwAAAAACAwAAACNNYXRoRXJyb3I6IFR5cGUgY29udmVyc2lvbiBvdmVyZmxvdwAAAAASQ29udmVyc2lvbk92ZXJmbG93AAAAAAIEAAAAP01hdGhFcnJvcjogQXR0ZW1wdGVkIHRvIGNvbnZlcnQgbmVnYXRpdmUgdmFsdWUgdG8gdW5zaWduZWQgdHlwZQAAAAASTmVnYXRpdmVUb1Vuc2lnbmVkAAAAAAIFAAAAKk1hdGhFcnJvcjogRml4ZWQtcG9pbnQgYXJpdGhtZXRpYyBvdmVyZmxvdwAAAAAAEkZpeGVkUG9pbnRPdmVyZmxvdwAAAAACBg==",
            "AAAABAAAAAAAAAAAAAAAC09yYWNsZUVycm9yAAAAAAMAAAAeT3JhY2xlRXJyb3I6IE9yYWNsZU5vblBvc2l0aXZlAAAAAAART3JhY2xlTm9uUG9zaXRpdmUAAAAAAAJZAAAAAAAAABFPcmFjbGVUb29Wb2xhdGlsZQAAAAAAAloAAAAAAAAAEk9yYWNsZVN0YWxlRm9yUG9vbAAAAAACWw==",
            "AAAABAAAAAAAAAAAAAAADFN0b3JhZ2VFcnJvcgAAAAQAAAAMU3RvcmFnZUVycm9yAAAAEkFscmVhZHlJbml0aWFsaXplZAAAAAAAyQAAAAAAAAATVmFsdWVOb3RJbml0aWFsaXplZAAAAAH1AAAAAAAAAAxWYWx1ZU1pc3NpbmcAAAH2AAAAAAAAABRWYWx1ZUNvbnZlcnNpb25FcnJvcgAAAfc=",
            "AAAABAAAAAAAAAAAAAAAD1ZhbGlkYXRpb25FcnJvcgAAAAAEAAAAD1ZhbGlkYXRpb25FcnJvcgAAAAAMSW52YWxpZFRva2VuAAADIQAAAAAAAAARSW52YWxpZFBlcmNlbnRhZ2UAAAAAAAMiAAAAAAAAAApSZWVudHJhbmN5AAAAAAMjAAAAAAAAAApaZXJvQW1vdW50AAAAAAMk",
            "AAAAAQAAAAAAAAAAAAAAE1ByaXZpbGVnZWRBZGRyZXNzZXMAAAAABQAAAAAAAAAPZW1lcmdlbmN5X2FkbWluAAAAABMAAAAAAAAAFmVtZXJnZW5jeV9wYXVzZV9hZG1pbnMAAAAAA+oAAAATAAAAAAAAABBvcGVyYXRpb25zX2FkbWluAAAAEwAAAAAAAAALcGF1c2VfYWRtaW4AAAAAEwAAAAAAAAANcmV3YXJkc19hZG1pbgAAAAAAABM=",
            "AAAAAQAAAAAAAAAAAAAAD09yYWNsZVByaWNlRGF0YQAAAAACAAAAAAAAAAVkZWxheQAAAAAAB9AAAAAFRGVsYXkAAAAAAAAAAAAABXByaWNlAAAAAAAACg==",
            "AAAAAQAAAAAAAAAAAAAAGVByaWNlRGl2ZXJnZW5jZUd1YXJkUmFpbHMAAAAAAAABAAAAAAAAAB5vcmFjbGVfdHdhcF9wZXJjZW50X2RpdmVyZ2VuY2UAAAAAAAY=",
            "AAAAAQAAAAAAAAAAAAAAElZhbGlkaXR5R3VhcmRSYWlscwAAAAAAAgAAAAAAAAAdc2Vjb25kc19iZWZvcmVfc3RhbGVfZm9yX3Bvb2wAAAAAAAAGAAAAAAAAABJ0b29fdm9sYXRpbGVfcmF0aW8AAAAAAAY=",
            "AAAAAQAAAAAAAAAAAAAAEE9yYWNsZUd1YXJkUmFpbHMAAAACAAAAAAAAABBwcmljZV9kaXZlcmdlbmNlAAAH0AAAABlQcmljZURpdmVyZ2VuY2VHdWFyZFJhaWxzAAAAAAAAAAAAAAh2YWxpZGl0eQAAB9AAAAASVmFsaWRpdHlHdWFyZFJhaWxzAAA=",
            "AAAAAgAAAAAAAAAAAAAADk9yYWNsZVZhbGlkaXR5AAAAAAAFAAAAAAAAAAAAAAALTm9uUG9zaXRpdmUAAAAAAAAAAAAAAAALVG9vVm9sYXRpbGUAAAAAAAAAAAAAAAAMU3RhbGVGb3JQb29sAAAAAAAAAAAAAAAGRnJvemVuAAAAAAAAAAAAAAAAAAVWYWxpZAAAAA==",
            "AAAAAQAAAAAAAAAAAAAAFEhpc3RvcmljYWxPcmFjbGVEYXRhAAAAAwAAAAAAAAAKbGFzdF9wcmljZQAAAAAACgAAAAAAAAAPbGFzdF9wcmljZV90d2FwAAAAAAoAAAAAAAAADmxhc3RfdXBkYXRlX3RzAAAAAAAG",
            "AAAAAQAAAAAAAAAAAAAABFBvb2wAAAAIAAAAAAAAAApiYXNlX2Fzc2V0AAAAAAARAAAAAAAAAAxmZWVfZnJhY3Rpb24AAAAEAAAAAAAAAA9pbnN1cmFuY2VfY2xhaW0AAAAH0AAAAA5JbnN1cmFuY2VDbGFpbQAAAAAAAAAAABdsaXF1aWRpdHlfbWF4X2ltYmFsYW5jZQAAAAAKAAAAAAAAAAtxdW90ZV9hc3NldAAAAAARAAAAAAAAAAZzdGF0dXMAAAAAB9AAAAAKUG9vbFN0YXR1cwAAAAAAAAAAAAR0aWVyAAAH0AAAAAhQb29sVGllcgAAAAAAAAAHdG9rZW5fYgAAAAAT",
            "AAAAAgAAAAAAAAAAAAAAClBvb2xTdGF0dXMAAAAAAAYAAAAAAAAAAAAAAAtJbml0aWFsaXplZAAAAAAAAAAAAAAAAAZBY3RpdmUAAAAAAAAAAAAAAAAABkZyb3plbgAAAAAAAAAAAAAAAAAKUmVkdWNlT25seQAAAAAAAAAAAAAAAAAKU2V0dGxlbWVudAAAAAAAAAAAAAAAAAAIRGVsaXN0ZWQ=",
            "AAAAAgAAAAAAAAAAAAAACFBvb2xUaWVyAAAABgAAAAAAAAAAAAAAAUEAAAAAAAAAAAAAAAAAAAFCAAAAAAAAAAAAAAAAAAABQwAAAAAAAAAAAAAAAAAAC1NwZWN1bGF0aXZlAAAAAAAAAAAAAAAAEUhpZ2hseVNwZWN1bGF0aXZlAAAAAAAAAAAAAAAAAAAISXNvbGF0ZWQ=",
            "AAAAAQAAAAAAAAAAAAAADkluc3VyYW5jZUNsYWltAAAAAAAEAAAAAAAAABhsYXN0X3JldmVudWVfd2l0aGRyYXdfdHMAAAAGAAAAAAAAABNxdW90ZV9tYXhfaW5zdXJhbmNlAAAAAAoAAAAAAAAAF3F1b3RlX3NldHRsZWRfaW5zdXJhbmNlAAAAAAoAAAAAAAAAHnJldl93aXRoZHJhd19zaW5jZV9sYXN0X3NldHRsZQAAAAAACw==",
            "AAAAAQAAAAAAAAAAAAAADFBvb2xSZXNwb25zZQAAAAQAAAAAAAAABHBvb2wAAAfQAAAABFBvb2wAAAAAAAAAB3Rva2VuX2EAAAAH0AAAABBBZGRyZXNzQW5kQW1vdW50AAAAAAAAAAd0b2tlbl9iAAAAB9AAAAAQQWRkcmVzc0FuZEFtb3VudAAAAAAAAAALdG9rZW5fc2hhcmUAAAAH0AAAABBBZGRyZXNzQW5kQW1vdW50",
            "AAAAAQAAAAAAAAAAAAAACFBvb2xJbmZvAAAAAgAAAAAAAAAMcG9vbF9hZGRyZXNzAAAAEwAAAAAAAAANcG9vbF9yZXNwb25zZQAAAAAAB9AAAAAMUG9vbFJlc3BvbnNl",
            "AAAAAQAAAAAAAAAAAAAAEEluaXRpYWxpemVQYXJhbXMAAAALAAAAAAAAAAVhZG1pbgAAAAAAABMAAAAAAAAABmFzc2V0cwAAAAAD7QAAAAIAAAARAAAAEQAAAAAAAAAMZmVlX2ZyYWN0aW9uAAAABAAAAAAAAAANbHBfdG9rZW5faW5mbwAAAAAAB9AAAAANVG9rZW5Jbml0SW5mbwAAAAAAAAAAAAAPb3JhY2xlX3JlZ2lzdHJ5AAAAABMAAAAAAAAAEHByaXZpbGVnZWRfYWRkcnMAAAfQAAAAE1ByaXZpbGVnZWRBZGRyZXNzZXMAAAAAAAAAABNxdW90ZV9tYXhfaW5zdXJhbmNlAAAAAAoAAAAAAAAABnJvdXRlcgAAAAAAEwAAAAAAAAAVc3ludGhldGljX3NhY19hZGRyZXNzAAAAAAAAEwAAAAAAAAAEdGllcgAAB9AAAAAIUG9vbFRpZXIAAAAAAAAAB3Rva2VuX2IAAAAAEw==",
            "AAAAAQAAAAAAAAAAAAAAE0luaXRpYWxpemVBbGxQYXJhbXMAAAAAAgAAAAAAAAAEYmFzZQAAB9AAAAAQSW5pdGlhbGl6ZVBhcmFtcwAAAAAAAAAFcGxhbmUAAAAAAAAT",
            "AAAAAgAAAAAAAAAAAAAADVN3YXBEaXJlY3Rpb24AAAAAAAACAAAAAAAAAAAAAAADQnV5AAAAAAAAAAAAAAAABFNlbGw=",
            "AAAAAQAAAAAAAAAAAAAADVRva2VuSW5pdEluZm8AAAAAAAADAAAAAAAAAARuYW1lAAAAEAAAAAAAAAAGc3ltYm9sAAAAAAAQAAAAAAAAAA90b2tlbl93YXNtX2hhc2gAAAAD7gAAACA=",
            "AAAAAQAAAAAAAAAAAAAAEEFkZHJlc3NBbmRBbW91bnQAAAACAAAAAAAAAAdhZGRyZXNzAAAAABMAAAAAAAAABmFtb3VudAAAAAAACg==",
            "AAAAAQAAAAAAAAAAAAAABURlbGF5AAAAAAAAAQAAAAAAAAABMAAAAAAAAAY="]), options);
        this.options = options;
        this.fromJSON = {
            pool_type: (this.txFromJSON),
            get_info: (this.txFromJSON),
            get_pool: (this.txFromJSON),
            share_id: (this.txFromJSON),
            get_total_shares: (this.txFromJSON),
            get_reserves: (this.txFromJSON),
            rebase: (this.txFromJSON),
            deposit: (this.txFromJSON),
            swap: (this.txFromJSON),
            estimate_swap: (this.txFromJSON),
            withdraw: (this.txFromJSON),
            get_liquidity: (this.txFromJSON),
            get_liquidity_calculator: (this.txFromJSON),
            set_liquidity_calculator: (this.txFromJSON),
            version: (this.txFromJSON),
            contract_name: (this.txFromJSON),
            commit_upgrade: (this.txFromJSON),
            apply_upgrade: (this.txFromJSON),
            revert_upgrade: (this.txFromJSON),
            set_emergency_mode: (this.txFromJSON),
            get_emergency_mode: (this.txFromJSON),
            init_admin: (this.txFromJSON),
            set_privileged_addrs: (this.txFromJSON),
            get_privileged_addrs: (this.txFromJSON),
            set_token_hash: (this.txFromJSON),
            set_pool_hash: (this.txFromJSON),
            set_elastic_pool_hash: (this.txFromJSON),
            set_rewards_gauge_hash: (this.txFromJSON),
            set_reward_token: (this.txFromJSON),
            set_protocol_fee_fraction: (this.txFromJSON),
            get_rewards_config: (this.txFromJSON),
            get_tokens_for_reward: (this.txFromJSON),
            get_total_liquidity: (this.txFromJSON),
            config_global_rewards: (this.txFromJSON),
            fill_liquidity: (this.txFromJSON),
            config_pool_rewards: (this.txFromJSON),
            get_rewards_info: (this.txFromJSON),
            get_user_reward: (this.txFromJSON),
            get_total_accumulated_reward: (this.txFromJSON),
            get_total_configured_reward: (this.txFromJSON),
            get_total_claimed_reward: (this.txFromJSON),
            get_total_outstanding_reward: (this.txFromJSON),
            distribute_outstanding_reward: (this.txFromJSON),
            claim: (this.txFromJSON),
            init_standard_pool: (this.txFromJSON),
            init_elastic_pool: (this.txFromJSON),
            get_pools: (this.txFromJSON),
            remove_pool: (this.txFromJSON),
            get_tokens_sets_count: (this.txFromJSON),
            get_tokens: (this.txFromJSON),
            get_pools_for_tokens_range: (this.txFromJSON),
            get_protocol_fee_fraction: (this.txFromJSON),
            pool_gauge_set_reward_thresholds: (this.txFromJSON),
            pool_gauge_get_min_daily_amount: (this.txFromJSON),
            pool_gauge_get_min_duration: (this.txFromJSON),
            pool_gauge_switch_token: (this.txFromJSON),
            pool_gauge_token_enabled: (this.txFromJSON),
            pool_gauge_schedule_reward: (this.txFromJSON),
            set_pools_plane: (this.txFromJSON),
            get_plane: (this.txFromJSON),
            commit_transfer_ownership: (this.txFromJSON),
            apply_transfer_ownership: (this.txFromJSON),
            revert_transfer_ownership: (this.txFromJSON),
            get_future_address: (this.txFromJSON),
            init_config_storage: (this.txFromJSON)
        };
    }
}
exports.Client = Client;

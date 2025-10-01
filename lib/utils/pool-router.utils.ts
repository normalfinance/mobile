import { Keypair, type Account } from "@stellar/stellar-sdk";
import {
  Client as PoolRouterClient,
  type SwapDirection as ContractSwapDirection
} from "../contracts/pool_router";

import { type AssembledTransaction } from "@stellar/stellar-sdk/contract";

export interface EstimateSwapArgs {
  asset_in: string;
  asset_out: string;
  amount_in: bigint;
}

export interface SwapEstimateResult {
  amount_out: bigint;
  spread_amount: bigint;
}

export type SwapDirection = ContractSwapDirection;

export function getSwapDirectionAndAsset(
  asset_in: string,
  asset_out: string
): {
  asset: string;
  direction: SwapDirection;
} {
  if (asset_in === "native") {
    const asset = addressToSymbol(asset_out);
    return {
      asset,
      direction: { tag: "Buy", values: undefined }
    };
  } else {
    const asset = addressToSymbol(asset_in);
    return {
      asset,
      direction: { tag: "Sell", values: undefined }
    };
  }
}

function addressToSymbol(address: string): string {
  if (address === "GB55TEPZCAPVA5QKOGTKEBLGJNCP4LSEIM65PMKYKVTABMFCKQNKPJ2H") {
    return "nBTC";
  }

  if (address === "native") {
    return "XLM";
  }

  if (
    address.length <= 12 &&
    !address.startsWith("G") &&
    !address.startsWith("C")
  ) {
    return address;
  }

  console.warn(`⚠️ Unknown asset address: ${address}, using as symbol`);
  return address;
}

export async function estimateSwap(
  poolRouterAddress: string,
  args: EstimateSwapArgs,
  networkConfig: {
    rpcUrl: string;
    networkPassphrase: string;
    testingSource: Account;
  }
): Promise<SwapEstimateResult> {
  console.log(`🏊 Calling Pool Router estimate_swap...`);
  console.log("Pool Router Address:", poolRouterAddress);
  console.log("Estimate Args:", {
    asset_in: args.asset_in,
    asset_out: args.asset_out,
    amount_in: args.amount_in.toString()
  });

  const poolRouterClient = new PoolRouterClient({
    contractId: poolRouterAddress,
    networkPassphrase: networkConfig.networkPassphrase,
    publicKey: networkConfig.testingSource.accountId(),
    rpcUrl: networkConfig.rpcUrl
  });

  const { asset, direction } = getSwapDirectionAndAsset(
    args.asset_in,
    args.asset_out
  );

  console.log("🔧 Pool Router parameters:", {
    asset,
    direction,
    in_amount: args.amount_in.toString()
  });

  const simulation = await poolRouterClient.estimate_swap(
    {
      asset,
      direction: direction as ContractSwapDirection,
      in_amount: args.amount_in
    },
    { simulate: true, fee: 1000 }
  );

  if (!simulation.result) {
    throw new Error("Pool Router estimate failed: empty result");
  }

  const result = simulation.result;
  console.log("✅ Pool Router estimate result:", result);
  console.log("🔍 Result type:", typeof result);

  if (typeof result === "object" && result !== null && "error" in result) {
    const errorMessage = result.error || "Unknown contract error";
    console.error("❌ Pool Router contract error:", errorMessage);
    throw new Error(
      `Pool Router contract error: ${
        errorMessage || "Contract execution failed"
      }`
    );
  }

  if (!Array.isArray(result)) {
    console.error(
      "❌ Unexpected result format - expected array, got:",
      typeof result
    );
    throw new Error(
      `Pool Router returned unexpected format: ${typeof result}. Expected array with [amount_out, spread_amount]`
    );
  }

  console.log("🔍 Result[0]:", result[0], "type:", typeof result[0]);
  console.log("🔍 Result[1]:", result[1], "type:", typeof result[1]);
  console.log("🔍 Result length:", result.length);

  const safeToBigInt = (value: any, name: string): bigint => {
    console.log(`🔧 Converting ${name}:`, value, "type:", typeof value);

    if (value === null || value === undefined) {
      throw new Error(`${name} is null or undefined`);
    }

    if (typeof value === "bigint") {
      return value;
    }

    if (typeof value === "string" || typeof value === "number") {
      try {
        return BigInt(value);
      } catch (error) {
        throw new Error(
          `Failed to convert ${name} "${value}" to BigInt: ${error}`
        );
      }
    }

    if (typeof value === "object" && value.toString) {
      try {
        return BigInt(value.toString());
      } catch (error) {
        throw new Error(
          `Failed to convert ${name} object "${value}" to BigInt: ${error}`
        );
      }
    }

    throw new Error(`${name} has unsupported type: ${typeof value}`);
  };

  return {
    amount_out: safeToBigInt(result[0], "amount_out"),
    spread_amount: safeToBigInt(result[1], "spread_amount")
  };
}

export async function buildSwapTransaction(
  poolRouterAddress: string,
  swapArgs: {
    user: string;
    asset_in: string;
    asset_out: string;
    amount_in: bigint;
    amount_out_min: bigint;
  },
  sourceAccount: Account,
  networkConfig: {
    networkPassphrase: string;
    rpcUrl: string;
  }
): Promise<AssembledTransaction<bigint>> {
  console.log(`🔨 Building Pool Router swap transaction...`);

  const poolRouterClient = new PoolRouterClient({
    contractId: poolRouterAddress,
    networkPassphrase: networkConfig.networkPassphrase,
    publicKey: sourceAccount.accountId(),
    rpcUrl: networkConfig.rpcUrl
  });

  const { asset, direction } = getSwapDirectionAndAsset(
    swapArgs.asset_in,
    swapArgs.asset_out
  );

  console.log(
    "🔄 Building swap transaction - Direction:",
    direction.tag,
    "for asset:",
    asset
  );

  return poolRouterClient.swap(
    {
      user: swapArgs.user,
      asset,
      direction: direction as ContractSwapDirection,
      in_amount: swapArgs.amount_in,
      out_min: swapArgs.amount_out_min
    },
    { simulate: false, fee: 1000 }
  );
}

export function getAssetAddress(symbol: string, issuer?: string): string {
  if (symbol === "XLM") return "native";
  return issuer || "";
}

export function toContractAmount(amount: string, decimals: number): bigint {
  const num = parseFloat(amount);
  return BigInt(Math.floor(num * Math.pow(10, decimals)));
}

export function fromContractAmount(amount: bigint, decimals: number): string {
  const divisor = BigInt(Math.pow(10, decimals));
  const quotient = Number(amount / divisor);
  const remainder = Number(amount % divisor);

  return (quotient + remainder / Math.pow(10, decimals)).toString();
}

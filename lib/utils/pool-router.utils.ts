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
  // commission_amount: bigint;
  // total_fee: bigint;
}

export type SwapDirection = ContractSwapDirection;

// Helper function to encode SwapDirection as simple symbol (Option A)
// Helper function to determine swap direction and asset symbol
export function getSwapDirectionAndAsset(
  asset_in: string,
  asset_out: string
): {
  asset: string;
  direction: SwapDirection;
} {
  if (asset_in === "native") {
    // Buying token with XLM - use the symbol of the token we're buying
    // Convert contract address to symbol (GB55... -> nBTC)
    const asset = addressToSymbol(asset_out);
    return {
      asset,
      direction: { tag: "Buy", values: undefined }
    };
  } else {
    // Selling token for XLM - use the symbol of the token we're selling
    // Convert contract address to symbol (GB55... -> nBTC)
    const asset = addressToSymbol(asset_in);
    return {
      asset,
      direction: { tag: "Sell", values: undefined }
    };
  }
}

// Helper function to convert contract address to symbol for Pool Router
function addressToSymbol(address: string): string {
  // The Pool Router expects symbols, not addresses
  // For now, we'll map the known address to nBTC (this should be dynamic based on actual assets)
  if (address === "GB55TEPZCAPVA5QKOGTKEBLGJNCP4LSEIM65PMKYKVTABMFCKQNKPJ2H") {
    return "nBTC"; // The Pool Router expects just the symbol
  }

  // For native asset
  if (address === "native") {
    return "XLM";
  }

  // If it's already a symbol (short string), return as-is
  if (
    address.length <= 12 &&
    !address.startsWith("G") &&
    !address.startsWith("C")
  ) {
    return address;
  }

  // Fallback - this should be improved to look up actual symbol from address
  console.warn(`⚠️ Unknown asset address: ${address}, using as symbol`);
  return address;
}

// Pool Router contract client (same as web app)
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

  return {
    amount_out: BigInt(result[0]),
    spread_amount: BigInt(result[1])
  };
}

// Build swap transaction (same structure as web app)
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

// Asset address helpers
export function getAssetAddress(symbol: string, issuer?: string): string {
  if (symbol === "XLM") return "native";
  return issuer || "";
}

// Convert display amount to contract amount (with decimals)
export function toContractAmount(amount: string, decimals: number): bigint {
  const num = parseFloat(amount);
  return BigInt(Math.floor(num * Math.pow(10, decimals)));
}

// Convert contract amount to display amount
export function fromContractAmount(amount: bigint, decimals: number): string {
  const divisor = BigInt(Math.pow(10, decimals));
  const quotient = Number(amount / divisor);
  const remainder = Number(amount % divisor);

  return (quotient + remainder / Math.pow(10, decimals)).toString();
}

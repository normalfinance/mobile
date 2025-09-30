import {
  TransactionBuilder,
  Contract,
  rpc as SorobanRpc,
  scValToNative,
  xdr,
  Account,
  Keypair,
  Address
} from "@stellar/stellar-sdk";

export interface EstimateSwapArgs {
  asset_in: string;
  asset_out: string;
  amount_in: bigint;
}

export interface SwapEstimateResult {
  amount_out: bigint;
  spread_amount: bigint;
  commission_amount: bigint;
  total_fee: bigint;
}

export type SwapDirection = {
  tag: 'Buy';
  values: void;
} | {
  tag: 'Sell';
  values: void;
};

// Helper function to determine swap direction and asset
export function getSwapDirectionAndAsset(asset_in: string, asset_out: string): {
  asset: string;
  direction: SwapDirection;
} {
  if (asset_in === "native") {
    // Buying token with XLM
    return {
      asset: asset_out,
      direction: { tag: 'Buy', values: undefined as void }
    };
  } else {
    // Selling token for XLM 
    return {
      asset: asset_in,
      direction: { tag: 'Sell', values: undefined as void }
    };
  }
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

  const txBuilder = new TransactionBuilder(networkConfig.testingSource, {
    fee: "1000000", // Higher fee for contract simulation
    timebounds: { minTime: 0, maxTime: 0 },
    networkPassphrase: networkConfig.networkPassphrase
  });

  // Get the correct asset and direction for the pool router
  const { asset, direction } = getSwapDirectionAndAsset(args.asset_in, args.asset_out);
  
  console.log("🔄 Swap direction:", direction.tag, "for asset:", asset);

  // Convert arguments to ScVal format using correct method signature
  const assetParam = Address.fromString(asset).toScVal();
  
  // SwapDirection is a variant type - encode as vector with tag as first element
  const directionParam = xdr.ScVal.scvVec([
    xdr.ScVal.scvSymbol(direction.tag)
  ]);
  
  const amountInParam = xdr.ScVal.scvU128(
    new xdr.UInt128Parts({
      lo: new xdr.Uint64(args.amount_in.toString()),
      hi: new xdr.Uint64("0")
    })
  );

  // Add contract operation
  txBuilder.addOperation(
    new Contract(poolRouterAddress).call(
      "estimate_swap",
      assetParam,
      directionParam,
      amountInParam
    )
  );

  const stellarRpc = new SorobanRpc.Server(networkConfig.rpcUrl);

  try {
    const result = await stellarRpc.simulateTransaction(txBuilder.build());

    if (SorobanRpc.Api.isSimulationSuccess(result)) {
      const resultXdr = result.result?.retval;
      if (resultXdr) {
        const nativeResult = scValToNative(resultXdr);

        console.log("✅ Pool Router estimate result:", nativeResult);

        // Parse the result based on your contract's return structure
        return {
          amount_out: BigInt(nativeResult.amount_out || nativeResult[0] || 0),
          spread_amount: BigInt(
            nativeResult.spread_amount || nativeResult[1] || 0
          ),
          commission_amount: BigInt(
            nativeResult.commission_amount || nativeResult[2] || 0
          ),
          total_fee: BigInt(nativeResult.total_fee || nativeResult[3] || 0)
        };
      }
    }

    console.error("❌ Pool Router simulation failed:", result);
    throw new Error(`Pool Router estimate failed: ${JSON.stringify(result)}`);
  } catch (error) {
    console.error("❌ Pool Router estimate error:", error);
    throw error;
  }
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
  }
): Promise<TransactionBuilder> {
  console.log(`🔨 Building Pool Router swap transaction...`);

  const txBuilder = new TransactionBuilder(sourceAccount, {
    fee: "10000000", // 1 XLM fee for complex swap transaction
    networkPassphrase: networkConfig.networkPassphrase
  });

  // Get the correct asset and direction for the pool router
  const { asset, direction } = getSwapDirectionAndAsset(swapArgs.asset_in, swapArgs.asset_out);
  
  console.log("🔄 Building swap transaction - Direction:", direction.tag, "for asset:", asset);

  // Convert arguments to ScVal format using correct method signature
  const userParam = xdr.ScVal.scvAddress(
    xdr.ScAddress.scAddressTypeAccount(
      Keypair.fromPublicKey(swapArgs.user).xdrAccountId()
    )
  );

  const assetParam = Address.fromString(asset).toScVal();
  
  // SwapDirection is a variant type - encode as vector with tag as first element
  const directionParam = xdr.ScVal.scvVec([
    xdr.ScVal.scvSymbol(direction.tag)
  ]);
  
  const amountInParam = xdr.ScVal.scvU128(
    new xdr.UInt128Parts({
      lo: new xdr.Uint64(swapArgs.amount_in.toString()),
      hi: new xdr.Uint64("0")
    })
  );

  const amountOutMinParam = xdr.ScVal.scvU128(
    new xdr.UInt128Parts({
      lo: new xdr.Uint64(swapArgs.amount_out_min.toString()),
      hi: new xdr.Uint64("0")
    })
  );

  // Add swap operation
  txBuilder.addOperation(
    new Contract(poolRouterAddress).call(
      "swap",
      userParam,
      assetParam,
      directionParam,
      amountInParam,
      amountOutMinParam
    )
  );

  return txBuilder;
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

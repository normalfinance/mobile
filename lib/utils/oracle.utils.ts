import { 
  TransactionBuilder, 
  Contract, 
  rpc as SorobanRpc, 
  scValToNative, 
  xdr 
} from "@stellar/stellar-sdk";

export interface PriceData {
  price: bigint;
  timestamp: number;
}

// Get oracle price (same implementation as web app)
export async function getOraclePrice(
  oracleAddress: string, 
  asset: string,
  networkConfig: {
    rpcUrl: string;
    networkPassphrase: string;
    testingSource: any;
  }
): Promise<PriceData> {
  console.log(`🔮 Fetching oracle price for ${asset} from ${oracleAddress}`);
  
  const txBuilder = new TransactionBuilder(networkConfig.testingSource, {
    fee: '1000',
    timebounds: { minTime: 0, maxTime: 0 },
    networkPassphrase: networkConfig.networkPassphrase,
  });

  // Create asset parameter (same as web app)
  const assetParam = xdr.ScVal.scvVec([
    xdr.ScVal.scvSymbol('Other'), 
    xdr.ScVal.scvSymbol(asset)
  ]);

  txBuilder.addOperation(new Contract(oracleAddress).call('lastprice', assetParam));

  const stellarRpc = new SorobanRpc.Server(networkConfig.rpcUrl);
  const result = await stellarRpc.simulateTransaction(txBuilder.build());

  if (SorobanRpc.Api.isSimulationSuccess(result)) {
    const xdrStr = result.result?.retval.toXDR('base64');
    if (xdrStr) {
      const priceResult: any = xdr.ScVal.fromXDR(xdrStr, 'base64')?.value();
      if (priceResult) {
        const price = scValToNative(priceResult[0]?.val());
        const timestamp = Number(scValToNative(priceResult[1]?.val()));
        
        console.log(`📊 Oracle price for ${asset}: ${price} (timestamp: ${timestamp})`);
        
        return {
          price,
          timestamp,
        };
      }
    }
    throw new Error('Unable to decode oracle price result');
  } else {
    throw new Error(`Failed to fetch oracle price: ${result.error}`);
  }
}

// Get oracle decimals (same as web app)
export async function getOracleDecimals(
  oracleId: string,
  networkConfig: {
    rpcUrl: string;
    networkPassphrase: string;
    testingSource: any;
  }
): Promise<{ decimals: number; latestLedger: number }> {
  console.log(`🔢 Fetching oracle decimals for ${oracleId}`);
  
  const txBuilder = new TransactionBuilder(networkConfig.testingSource, {
    fee: '1000',
    timebounds: { minTime: 0, maxTime: 0 },
    networkPassphrase: networkConfig.networkPassphrase,
  });
  
  txBuilder.addOperation(new Contract(oracleId).call('decimals'));

  const stellarRpc = new SorobanRpc.Server(networkConfig.rpcUrl);
  const result = await stellarRpc.simulateTransaction(txBuilder.build());

  if (SorobanRpc.Api.isSimulationSuccess(result)) {
    const val = scValToNative((result as any).result.retval);
    
    console.log(`📐 Oracle decimals: ${val}`);
    
    return {
      decimals: val,
      latestLedger: result.latestLedger,
    };
  } else {
    throw new Error(`Failed to fetch oracle decimals: ${result.error}`);
  }
}

// Format token amount with oracle decimals (same as web app)
export function formatTokenAmount(amount: bigint, decimals: number): string {
  const divisor = BigInt(10 ** decimals);
  const quotient = amount / divisor;
  const remainder = amount % divisor;
  
  if (remainder === BigInt(0)) {
    return quotient.toString();
  }
  
  const remainderStr = remainder.toString().padStart(decimals, '0');
  const trimmedRemainder = remainderStr.replace(/0+$/, '');
  
  return trimmedRemainder ? `${quotient}.${trimmedRemainder}` : quotient.toString();
}
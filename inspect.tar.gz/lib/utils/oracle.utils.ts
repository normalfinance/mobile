import { rpc as SorobanRpc } from "@stellar/stellar-sdk";
import type { Account } from "@stellar/stellar-sdk";
import {
  Client as OracleRegistryClient,
  type Asset
} from "../contracts/oracle_registry";
import { formatNormalToken } from "./format.utils";

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
    testingSource: Account;
  }
): Promise<PriceData> {
  oracleAddress = "CB4OHJ5KAEY2O5ZOFWOFYOCP6WL5FSZEPO4GVJLW4PBJZRWM4IID7QDF";
  console.log(`🔮 Fetching oracle price for ${asset} from ${oracleAddress}`);

  const oracleClient = new OracleRegistryClient({
    contractId: oracleAddress,
    networkPassphrase: networkConfig.networkPassphrase,
    publicKey: networkConfig.testingSource.accountId(),
    rpcUrl: networkConfig.rpcUrl
  });

  // trim out n from the asset

  let formattedAsset = formatNormalToken(asset, "without-n");

  console.log("formattedAsset", formattedAsset);

  // const assetParam: Asset = { tag: "Other", values: [formattedAsset] };

  const tx = await oracleClient.get_last_price(
    { asset: formattedAsset },
    { simulate: true, fee: 1000 }
  );

  const simulation = await tx.simulate();

  if (!simulation.result) {
    throw new Error("Unable to decode oracle price result");
  }

  const { last_oracle_price_twap, last_oracle_price_twap_ts } =
    simulation.result;

  console.log("last_oracle_price_twap", formattedAsset, last_oracle_price_twap);

  return {
    price: last_oracle_price_twap,
    timestamp: Number(last_oracle_price_twap_ts)
  };
}

// Get oracle decimals (same as web app)
export async function getOracleDecimals(
  oracleId: string,
  networkConfig: {
    rpcUrl: string;
    networkPassphrase: string;
    testingSource: Account;
  }
): Promise<{ decimals: number }> {
  console.log(`🔢 Fetching oracle decimals for ${oracleId}`);

  const oracleClient = new OracleRegistryClient({
    contractId: oracleId,
    networkPassphrase: networkConfig.networkPassphrase,
    publicKey: networkConfig.testingSource.accountId(),
    rpcUrl: networkConfig.rpcUrl
  });

  const tx = await oracleClient.get_oracle(
    { asset: oracleId },
    { simulate: true, fee: 1000 }
  );
  const simulation = await tx.simulate();

  if (!simulation.result) {
    throw new Error("Failed to fetch oracle decimals: empty result");
  }

  return {
    decimals: simulation.result.decimals
  };
}

// Format token amount with oracle decimals (same as web app)
export function formatTokenAmount(amount: bigint, decimals: number): string {
  const divisor = BigInt(10 ** decimals);
  const quotient = amount / divisor;
  const remainder = amount % divisor;

  if (remainder === BigInt(0)) {
    return quotient.toString();
  }

  const remainderStr = remainder.toString().padStart(decimals, "0");
  const trimmedRemainder = remainderStr.replace(/0+$/, "");

  return trimmedRemainder
    ? `${quotient}.${trimmedRemainder}`
    : quotient.toString();
}

import {
  rpc,
  xdr,
  Contract,
  scValToNative,
  TransactionBuilder,
  Account
} from "@stellar/stellar-sdk";
import { STELLAR_CONFIG } from "@/lib/constants/stellar.constants";
import { getKeypair } from "@/services/wallet.service";

export interface PriceData {
  price: bigint;
  timestamp: number;
}

export async function getOraclePrice(
  oracle_address: string,
  _asset: string
): Promise<PriceData> {
  console.log("🔍 Getting oracle price for:", _asset);
  console.log("🔍 Oracle address:", oracle_address);
  
  const keypair = await getKeypair();
  if (!keypair) {
    throw new Error("No wallet found in secure storage");
  }
  
  const sourceAccount = new Account(keypair.publicKey(), "0");
  const tx_builder = new TransactionBuilder(sourceAccount, {
    fee: "1000",
    timebounds: { minTime: 0, maxTime: 0 },
    networkPassphrase: STELLAR_CONFIG.TESTNET_PASSPHRASE
  });

  const asset = xdr.ScVal.scvVec([
    xdr.ScVal.scvSymbol("Other"),
    xdr.ScVal.scvSymbol(_asset)
  ]);

  tx_builder.addOperation(
    new Contract(oracle_address).call("get_last_price", asset)
  );

  const stellar_rpc = new rpc.Server(STELLAR_CONFIG.SOROBAN_RPC_URLS.TESTNET);
  const result = await stellar_rpc.simulateTransaction(tx_builder.build());

  if (rpc.Api.isSimulationSuccess(result)) {
    const xdr_str = result.result?.retval.toXDR("base64");
    if (xdr_str) {
      const price_result: any = xdr.ScVal.fromXDR(xdr_str, "base64")?.value();
      if (price_result) {
        return {
          // eslint-disable-next-line
          // @ts-ignore
          price: scValToNative(price_result[0]?.val()),
          timestamp: Number(scValToNative(price_result[1]?.val()))
        };
      }
    }
    throw new Error("Unable to decode oracle price result");
  } else {
    throw new Error(`Failed to fetch oracle price: ${result.error}`);
  }
}

export async function getOracleDecimals(
  oracle_id: string
): Promise<{ decimals: number; latestLedger: number }> {
  const keypair = await getKeypair();
  if (!keypair) {
    throw new Error("No wallet found in secure storage");
  }
  
  const sourceAccount = new Account(keypair.publicKey(), "0");
  const tx_builder = new TransactionBuilder(sourceAccount, {
    fee: "1000",
    timebounds: { minTime: 0, maxTime: 0 },
    networkPassphrase: STELLAR_CONFIG.TESTNET_PASSPHRASE
  });
  tx_builder.addOperation(new Contract(oracle_id).call("get_oracle"));

  const stellar_rpc = new rpc.Server(STELLAR_CONFIG.SOROBAN_RPC_URLS.TESTNET);
  const result = await stellar_rpc.simulateTransaction(tx_builder.build());

  if (rpc.Api.isSimulationSuccess(result)) {
    const oracleInfo = scValToNative((result as any).result.retval);
    return {
      decimals: oracleInfo.decimals,
      latestLedger: result.latestLedger
    };
  } else {
    throw new Error(`Failed to fetch oracle decimals: ${result.error}`);
  }
}

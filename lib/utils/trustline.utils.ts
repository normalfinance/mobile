import {
  rpc,
  Contract,
  Horizon,
  TransactionBuilder,
  Operation,
  Asset,
  BASE_FEE,
} from "@stellar/stellar-sdk";

export interface AssetInfo {
  code: string;
  issuer: string;
}

/**
 * Mapping of known SAC (Stellar Asset Contract) addresses to their underlying classic assets
 * Separated by network for proper trustline creation
 */
const MAINNET_SAC_ASSETS: Record<string, AssetInfo> = {
  CCW67TSZV3SSS2HXMBQ5JFGCKJNXKZM7UQUWUZPUTHXSTZLEO7SJMI75: {
    code: "USDC",
    issuer: "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN",
  },
  // Add other mainnet SAC assets here as needed
};

const TESTNET_SAC_ASSETS: Record<string, AssetInfo> = {
  // Add testnet SAC assets here when available
  // Most testnet tokens are native Soroban tokens, not classic asset wrappers
};

/**
 * Get the appropriate SAC assets mapping based on current network
 */
function getKnownSacAssets(): Record<string, AssetInfo> {
  const network = process.env.EXPO_PUBLIC_NETWORK || "TESTNET";
  return network === "MAINNET" ? MAINNET_SAC_ASSETS : TESTNET_SAC_ASSETS;
}

/**
 * Get the underlying classic asset info from a Stellar Asset Contract (SAC) address
 * For now, uses a hardcoded mapping of known assets
 */
export async function getAssetInfoFromSAC(
  contractAddress: string,
  rpcUrl: string
): Promise<AssetInfo | null> {
  const network = process.env.EXPO_PUBLIC_NETWORK || "TESTNET";
  const knownAssets = getKnownSacAssets();
  
  // Check if this is a known SAC contract
  const knownAsset = knownAssets[contractAddress];
  if (knownAsset) {
    console.log(
      `✅ Found known SAC asset on ${network}: ${knownAsset.code} (${contractAddress})`
    );
    return knownAsset;
  }

  // For unknown contracts, we'll assume no trustline is needed
  // (most likely it's a native Soroban token, not a classic asset wrapper)
  console.log(
    `⚠️ Unknown SAC contract ${contractAddress} on ${network}, assuming no trustline needed`
  );
  return null;
}

/**
 * Check if an account has a trustline for a given asset
 * Uses Horizon API to check account balances
 */
export async function hasTrustline(
  accountId: string,
  assetCode: string,
  assetIssuer: string,
  horizonUrl: string
): Promise<boolean> {
  try {
    const server = new Horizon.Server(horizonUrl);
    const account = await server.loadAccount(accountId);

    // Check if account has the trustline in its balances
    return account.balances.some((balance: any) => {
      // Native XLM doesn't need a trustline
      if (balance.asset_type === "native") {
        return assetCode === "XLM" || assetCode === "native";
      }

      // Check for matching asset code and issuer
      return (
        balance.asset_code === assetCode &&
        balance.asset_issuer === assetIssuer
      );
    });
  } catch (error) {
    console.error(
      `Failed to check trustline for ${accountId}:`,
      error
    );
    // If account not found or other error, assume no trustline
    return false;
  }
}

/**
 * Check if a token (by contract address) requires a trustline and if the account has it
 * Returns null if no trustline is needed (native asset or already has trustline)
 * Returns AssetInfo if trustline is needed
 */
export async function checkTrustlineNeeded(
  accountId: string,
  tokenAddress: string,
  horizonUrl: string
): Promise<AssetInfo | null> {
  // Native XLM doesn't need a trustline
  if (
    tokenAddress === "native" ||
    tokenAddress === "CAS3J7GYLGXMF6TDJBBYYSE3HQ6BBSMLNUQ34T6TZMYMW2EVH34XOWMA"
  ) {
    return null;
  }

  // Try to get the classic asset info from the SAC
  // We pass empty string for rpcUrl since we're not using it anymore
  const assetInfo = await getAssetInfoFromSAC(tokenAddress, "");

  if (!assetInfo) {
    // Not a classic asset wrapper, no trustline needed
    return null;
  }

  // Check if account already has the trustline using Horizon API
  const hasTrust = await hasTrustline(
    accountId,
    assetInfo.code,
    assetInfo.issuer,
    horizonUrl
  );

  if (hasTrust) {
    return null;
  }

  // Trustline is needed
  return assetInfo;
}

/**
 * Build a trustline transaction for a given asset
 */
export function buildTrustlineTransaction(
  account: any, // Account type from Stellar SDK
  assetCode: string,
  assetIssuer: string,
  networkPassphrase: string
): any {
  console.log("🏗️ Building trustline transaction with params:", {
    assetCode,
    assetCodeLength: assetCode.length,
    assetIssuer,
    assetIssuerLength: assetIssuer.length,
    networkPassphrase: networkPassphrase.substring(0, 30) + "...",
  });

  // Validate inputs
  if (!assetCode || typeof assetCode !== "string") {
    throw new Error(`Invalid assetCode: ${assetCode}`);
  }
  if (!assetIssuer || typeof assetIssuer !== "string") {
    throw new Error(`Invalid assetIssuer: ${assetIssuer}`);
  }

  const txBuilder = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase,
  });

  console.log("📦 Creating Asset object...");
  const asset = new Asset(assetCode, assetIssuer);
  console.log("✅ Asset created:", asset);

  // Add changeTrust operation
  console.log("📦 Adding changeTrust operation...");
  txBuilder.addOperation(
    Operation.changeTrust({
      asset: asset,
      limit: "922337203685.4775807", // Maximum trustline limit
    })
  );

  // Set timeout (5 minutes)
  console.log("⏰ Setting timeout...");
  txBuilder.setTimeout(300);

  console.log("🔨 Building transaction...");
  const tx = txBuilder.build();
  console.log("✅ Transaction built successfully");

  return tx;
}

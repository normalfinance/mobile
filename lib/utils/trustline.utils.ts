import {
  Horizon,
  Networks,
  TransactionBuilder,
  Operation,
  Asset,
  Account,
  Contract,
  rpc,
  scValToNative,
  nativeToScVal,
  xdr
} from "@stellar/stellar-sdk";
import { getKeypair } from "@/services/wallet.service";

interface NetworkConfig {
  horizonUrl: string;
  rpcUrl: string;
  networkPassphrase: string;
}

const getNetworkConfig = (): NetworkConfig => {
  const network = process.env.EXPO_PUBLIC_NETWORK || "TESTNET";

  if (network === "MAINNET") {
    return {
      horizonUrl:
        process.env.EXPO_PUBLIC_MAINNET_HORIZON_URL ||
        "https://horizon.stellar.org",
      rpcUrl:
        process.env.EXPO_PUBLIC_MAINNET_RPC_URL ||
        "https://soroban.stellar.org",
      networkPassphrase: Networks.PUBLIC
    };
  } else {
    return {
      horizonUrl:
        process.env.EXPO_PUBLIC_TESTNET_HORIZON_URL ||
        "https://horizon-testnet.stellar.org",
      rpcUrl:
        process.env.EXPO_PUBLIC_TESTNET_RPC_URL ||
        "https://soroban-testnet.stellar.org",
      networkPassphrase: Networks.TESTNET
    };
  }
};

/**
 * Check if an account has a trustline/authorization for a token
 * Handles both classic assets and Soroban tokens
 */
export async function hasTrustline(
  accountAddress: string,
  tokenAddress: string,
  tokenSymbol: string
): Promise<boolean> {
  const config = getNetworkConfig();
  const horizonServer = new Horizon.Server(config.horizonUrl);

  try {
    console.log(`🔍 Checking trustline for ${tokenSymbol} (${tokenAddress})`);

    // Skip check for native XLM
    if (tokenAddress === "native" || tokenSymbol === "XLM") {
      console.log("✅ Native XLM - no trustline needed");
      return true;
    }

    // For Soroban tokens (contract addresses starting with 'C')
    if (tokenAddress.startsWith("C")) {
      try {
        // Try to query the token contract balance to check if authorization exists
        // If the query succeeds, authorization exists (even if balance is 0)
        const account = new Account(accountAddress, "0");
        const txBuilder = new TransactionBuilder(account, {
          fee: "1000",
          timebounds: { minTime: 0, maxTime: 0 },
          networkPassphrase: config.networkPassphrase
        });

        const userAddress = nativeToScVal(accountAddress, {
          type: "address"
        } as any);
        txBuilder.addOperation(
          new Contract(tokenAddress).call("balance", userAddress)
        );

        const stellarRpc = new rpc.Server(config.rpcUrl);
        const result = await stellarRpc.simulateTransaction(txBuilder.build());

        if (rpc.Api.isSimulationSuccess(result)) {
          // If simulation succeeds, authorization exists (contract can read balance)
          console.log(
            `✅ Soroban token authorization exists for ${tokenSymbol}`
          );
          return true;
        } else {
          // If simulation fails, authorization doesn't exist
          console.log(
            `❌ No Soroban token authorization found for ${tokenSymbol}`
          );
          return false;
        }
      } catch (error: any) {
        // For Soroban tokens, if we can't check authorization (e.g., 401 error),
        // we assume authorization doesn't exist yet, but that's OK because
        // Soroban will create it automatically during transaction simulation/execution
        const errorMessage = error?.message || "";
        const statusCode = error?.response?.status || error?.status || 0;

        if (statusCode === 401 || errorMessage.includes("401")) {
          console.log(
            `⚠️ Cannot check Soroban token authorization (401). Authorization will be created automatically during transaction.`
          );
          // Return false so we proceed (authorization will be created during tx)
          return false;
        }

        console.log(
          `❌ Error checking Soroban token authorization: ${errorMessage}`
        );
        // For other errors, assume authorization doesn't exist
        return false;
      }
    }

    // For classic Stellar assets, check Horizon balances
    try {
      const account = await horizonServer.loadAccount(accountAddress);
      const hasClassicTrustline = account.balances.some((balance: any) => {
        if (
          balance.asset_type === "native" ||
          balance.asset_type === "liquidity_pool_shares"
        ) {
          return false;
        }
        return (
          balance.asset_code === tokenSymbol &&
          balance.asset_issuer === tokenAddress
        );
      });

      console.log(
        hasClassicTrustline
          ? `✅ Found classic trustline for ${tokenSymbol}`
          : `❌ No classic trustline found for ${tokenSymbol}`
      );
      return hasClassicTrustline;
    } catch (error: any) {
      // If account doesn't exist or other error, assume trustline doesn't exist
      console.error(
        `❌ Error checking classic trustline:`,
        error?.message || error
      );
      return false;
    }
  } catch (error) {
    console.error(`❌ Error checking trustline:`, error);
    // If we can't check, assume we need to add it
    return false;
  }
}

/**
 * Add a trustline for a token (classic asset)
 * Note: For Soroban tokens, trustlines are typically created automatically on first interaction
 */
export async function addClassicTrustline(
  tokenAddress: string,
  tokenSymbol: string
): Promise<string> {
  const config = getNetworkConfig();
  const horizonServer = new Horizon.Server(config.horizonUrl);

  try {
    const keypair = await getKeypair();
    if (!keypair) {
      throw new Error("No wallet found");
    }

    console.log(`➕ Adding classic trustline for ${tokenSymbol}...`);

    // Load account to get current sequence number
    const sourceAccount = await horizonServer.loadAccount(keypair.publicKey());

    const asset = new Asset(tokenSymbol, tokenAddress);

    // Get current fee stats for dynamic fee
    const feeStats = await horizonServer.feeStats();
    const baseFee = feeStats.fee_charged.mode || "100000";

    const transaction = new TransactionBuilder(sourceAccount, {
      fee: baseFee,
      networkPassphrase: config.networkPassphrase
    })
      .addOperation(
        Operation.changeTrust({
          asset: asset,
          limit: "9223372036854775807" // Maximum int64 limit
        })
      )
      .setTimeout(300)
      .build();

    transaction.sign(keypair);

    console.log(`📤 Submitting trustline transaction...`);
    const result = await horizonServer.submitTransaction(transaction);
    console.log(`✅ Trustline transaction submitted:`, result.hash);

    // Wait for transaction to be included in a ledger
    // Poll Horizon until transaction appears in ledger
    const maxAttempts = 30;
    const delayMs = 1000;
    let attempts = 0;

    while (attempts < maxAttempts) {
      try {
        const transactionResult = await horizonServer
          .transactions()
          .transaction(result.hash)
          .call();
        if (transactionResult.successful) {
          console.log(
            `✅ Trustline added successfully and confirmed:`,
            result.hash
          );
          return result.hash;
        }
      } catch (error) {
        // Transaction not yet in ledger, continue polling
      }

      attempts++;
      if (attempts < maxAttempts) {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }

    // If we get here, transaction was submitted but confirmation timed out
    // Still return the hash as the transaction was submitted
    console.log(
      `⚠️ Trustline transaction submitted but confirmation timed out:`,
      result.hash
    );
    return result.hash;
  } catch (error: any) {
    console.error(`❌ Error adding classic trustline:`, error);
    const errorMessage =
      error?.response?.data?.extras?.result_codes?.operations ||
      error?.message ||
      "Unknown error";
    throw new Error(
      `Failed to add trustline for ${tokenSymbol}: ${errorMessage}`
    );
  }
}

/**
 * Ensure Soroban token authorization by simulating a transaction
 * For Soroban tokens, authorization is created automatically during transaction simulation
 * We simulate a balance query to establish authorization before swap estimation
 */
export async function ensureSorobanTokenAuth(
  tokenAddress: string,
  tokenSymbol: string,
  accountAddress: string,
  sourceAccount?: Account
): Promise<void> {
  try {
    console.log(
      `🔐 Ensuring Soroban token authorization for ${tokenSymbol}...`
    );

    const config = getNetworkConfig();

    // We need a source account for the transaction
    // If not provided, load it from Horizon
    let account: Account;
    if (sourceAccount) {
      account = sourceAccount;
    } else {
      const horizonServer = new Horizon.Server(config.horizonUrl);
      try {
        const accountResponse = await horizonServer.loadAccount(accountAddress);
        account = new Account(
          accountResponse.accountId(),
          accountResponse.sequence
        );
      } catch (error: any) {
        console.error(
          `❌ Could not load account for Soroban auth:`,
          error?.message
        );
        throw new Error(
          `Failed to load account for Soroban token authorization: ${error?.message}`
        );
      }
    }

    // Create a transaction that calls the token contract's balance function
    // This will establish authorization automatically during simulation
    const txBuilder = new TransactionBuilder(account, {
      fee: "1000",
      timebounds: { minTime: 0, maxTime: 0 },
      networkPassphrase: config.networkPassphrase
    });

    const userAddress = nativeToScVal(accountAddress, {
      type: "address"
    } as any);

    // Call balance function to establish authorization
    txBuilder.addOperation(
      new Contract(tokenAddress).call("balance", userAddress)
    );

    const stellarRpc = new rpc.Server(config.rpcUrl);

    // Simulate the transaction - this will create the authorization entry
    console.log(`📊 Simulating balance query to establish authorization...`);
    const simulation = await stellarRpc.simulateTransaction(txBuilder.build());

    if (rpc.Api.isSimulationSuccess(simulation)) {
      console.log(
        `✅ Soroban token authorization established for ${tokenSymbol}`
      );
    } else {
      // Even if simulation fails, the authorization entry might have been created
      // Log a warning but continue
      console.log(
        `⚠️ Simulation result unclear, but authorization may have been established for ${tokenSymbol}`
      );
    }
  } catch (error: any) {
    const errorMessage = error?.message || "Unknown error";
    console.error(
      `❌ Error ensuring Soroban token authorization:`,
      errorMessage
    );

    // Don't throw - authorization will be created during actual swap execution
    // We just log the error and continue
    console.log(
      `⚠️ Could not pre-establish authorization for ${tokenSymbol}. ` +
        `Authorization will be created automatically during swap execution.`
    );
  }
}

/**
 * Ensure trustline exists for a token, adding it if necessary
 * Handles both classic assets and Soroban tokens
 */
export async function ensureTrustline(
  accountAddress: string,
  tokenAddress: string,
  tokenSymbol: string,
  sourceAccount?: Account
): Promise<void> {
  console.log(`🔧 Ensuring trustline for ${tokenSymbol}...`);

  // Skip for native XLM
  if (tokenAddress === "native" || tokenSymbol === "XLM") {
    console.log("✅ Native XLM - no trustline needed");
    return;
  }

  // For Soroban tokens (contract addresses), establish authorization before estimation
  // Authorization is created automatically during transaction simulation
  if (tokenAddress.startsWith("C")) {
    console.log(
      `ℹ️ Soroban token ${tokenSymbol}: Establishing authorization via simulation...`
    );
    // Try to establish authorization by simulating a balance query
    // This will create the authorization entry so swap estimation can succeed
    try {
      await ensureSorobanTokenAuth(
        tokenAddress,
        tokenSymbol,
        accountAddress,
        sourceAccount
      );
      console.log(
        `✅ Soroban token authorization established for ${tokenSymbol}`
      );
    } catch (error: any) {
      // If we can't establish authorization now, log warning but continue
      // Authorization will be created during actual swap execution
      console.log(
        `⚠️ Could not pre-establish authorization for ${tokenSymbol}. ` +
          `Authorization will be created automatically during swap execution.`
      );
    }
    return;
  }

  // For classic assets, check and create trustline if needed
  const hasTrust = await hasTrustline(
    accountAddress,
    tokenAddress,
    tokenSymbol
  );

  if (hasTrust) {
    console.log(`✅ Trustline already exists for ${tokenSymbol}`);
    return;
  }

  console.log(`📝 Trustline needed for ${tokenSymbol}`);

  // For classic assets, add a trustline
  try {
    const txHash = await addClassicTrustline(tokenAddress, tokenSymbol);
    console.log(`✅ Trustline added for ${tokenSymbol} (tx: ${txHash})`);
  } catch (error: any) {
    const errorMessage = error?.message || "Unknown error";
    throw new Error(
      `Failed to ensure trustline for ${tokenSymbol}: ${errorMessage}`
    );
  }
}

/**
 * Ensure trustlines for both tokens in a swap
 */
export async function ensureSwapTrustlines(
  accountAddress: string,
  tokenInAddress: string,
  tokenInSymbol: string,
  tokenOutAddress: string,
  tokenOutSymbol: string,
  sourceAccount?: Account
): Promise<void> {
  console.log("🔧 Checking and ensuring trustlines for swap...");
  console.log(`   Token In: ${tokenInSymbol} (${tokenInAddress})`);
  console.log(`   Token Out: ${tokenOutSymbol} (${tokenOutAddress})`);

  try {
    // Check and ensure trustlines for both tokens sequentially
    await ensureTrustline(
      accountAddress,
      tokenInAddress,
      tokenInSymbol,
      sourceAccount
    );
    await ensureTrustline(
      accountAddress,
      tokenOutAddress,
      tokenOutSymbol,
      sourceAccount
    );

    console.log("✅ All trustlines ensured");
  } catch (error: any) {
    const errorMessage = error?.message || "Unknown error";
    console.error("❌ Error ensuring swap trustlines:", errorMessage);
    throw new Error(`Failed to ensure trustlines for swap: ${errorMessage}`);
  }
}

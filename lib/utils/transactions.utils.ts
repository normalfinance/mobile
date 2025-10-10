import { Horizon, ServerApi } from "@stellar/stellar-sdk";

import { STELLAR_CONFIG } from "@/lib/constants/stellar.constants";
import type {
  Transaction,
  TransactionType
} from "@/services/portfolio.service";

export type NetworkKey = "TESTNET" | "PUBLIC"; // this should go in stellar.constants.ts

const serverCache: Partial<Record<NetworkKey, Horizon.Server>> = {};

const getNetworkKey = (networkOverride?: NetworkKey): NetworkKey => {
  if (networkOverride) {
    return networkOverride;
  }

  const envNetwork = (
    process.env.EXPO_PUBLIC_NETWORK || "TESTNET"
  ).toUpperCase();

  return envNetwork === "MAINNET" ? "PUBLIC" : "TESTNET";
};

const getHorizonServer = (network: NetworkKey): Horizon.Server => {
  if (!serverCache[network]) {
    const horizonUrl = STELLAR_CONFIG.HORIZON_URLS[network];
    serverCache[network] = new Horizon.Server(horizonUrl);
  }

  return serverCache[network]!;
};

const normalizeAssetCode = (assetType: string, assetCode?: string): string => {
  if (assetType === "native") {
    return "XLM";
  }

  if (assetCode) {
    return assetCode.toUpperCase();
  }

  return "UNKNOWN";
};

const getTransactionTypeFromRecord = (
  record: ServerApi.OperationRecord,
  walletPublicKey: string
): TransactionType => {
  if (record.type === "payment") {
    const payment = record as ServerApi.PaymentOperationRecord;

    if (payment.from === walletPublicKey && payment.to === walletPublicKey) {
      return "swap";
    }

    if (payment.from === walletPublicKey) {
      return "send";
    }

    if (payment.to === walletPublicKey) {
      return "receive";
    }

    return "swap";
  }

  if (
    record.type === "path_payment_strict_send" ||
    record.type === "path_payment_strict_receive"
  ) {
    return "swap";
  }

  if (record.type === "create_account") {
    const createAccount = record as ServerApi.CreateAccountOperationRecord;

    return createAccount.account === walletPublicKey ? "receive" : "send";
  }

  return "swap";
};

const mapOperationRecordToTransaction = (
  record: ServerApi.OperationRecord,
  walletPublicKey: string
): Transaction | null => {
  try {
    let amount = 0;
    let assetCode = "XLM";

    if (record.type === "payment") {
      const payment = record as ServerApi.PaymentOperationRecord;
      amount = parseFloat(payment.amount);
      assetCode = normalizeAssetCode(payment.asset_type, payment.asset_code);
    } else if (record.type === "path_payment_strict_send") {
      const pathPayment =
        record as ServerApi.PathPaymentStrictSendOperationRecord;
      amount = parseFloat(
        pathPayment.destination_amount || pathPayment.amount || "0"
      );
      assetCode = normalizeAssetCode(
        pathPayment.destination_asset_type || pathPayment.asset_type,
        pathPayment.destination_asset_code || pathPayment.asset_code
      );
    } else if (record.type === "path_payment_strict_receive") {
      const pathPayment =
        record as ServerApi.PathPaymentStrictReceiveOperationRecord;
      amount = parseFloat(pathPayment.amount);
      assetCode = normalizeAssetCode(
        pathPayment.asset_type,
        pathPayment.asset_code
      );
    } else if (record.type === "create_account") {
      const createAccount = record as ServerApi.CreateAccountOperationRecord;
      amount = parseFloat(createAccount.starting_balance);
      assetCode = "XLM";
    } else {
      return null;
    }

    if (!Number.isFinite(amount) || amount <= 0) {
      return null;
    }

    const transactionType = getTransactionTypeFromRecord(
      record,
      walletPublicKey
    );

    return {
      id: record.id,
      type: transactionType,
      asset: assetCode,
      amount,
      usdValue: 0,
      timestamp: new Date(record.created_at),
      status: "completed"
    };
  } catch (error) {
    console.error(
      "Failed to map operation record to transaction",
      error,
      record
    );
    return null;
  }
};

export interface FetchWalletTransactionsOptions {
  limit?: number;
  network?: NetworkKey;
}

export const fetchWalletTransactions = async (
  walletPublicKey: string,
  options: FetchWalletTransactionsOptions = {}
): Promise<Transaction[]> => {
  if (!walletPublicKey) {
    throw new Error("Wallet public key is required to fetch transactions");
  }

  const { limit = 30, network } = options;
  const networkKey = getNetworkKey(network);
  const server = getHorizonServer(networkKey);

  try {
    const paymentCallBuilder = server
      .payments()
      .forAccount(walletPublicKey)
      .order("desc")
      .limit(limit);

    const response = await paymentCallBuilder.call();

    const transactions = response.records
      .map((record) => mapOperationRecordToTransaction(record, walletPublicKey))
      .filter(
        (transaction): transaction is Transaction => transaction !== null
      );

    return transactions.sort(
      (a, b) => b.timestamp.getTime() - a.timestamp.getTime()
    );
  } catch (error: any) {
    if (error?.response?.status === 404) {
      return [];
    }

    const message =
      error instanceof Error
        ? error.message
        : "Failed to fetch wallet transactions";

    throw new Error(message);
  }
};

import { Transaction, Keypair } from '@stellar/stellar-sdk';
import { NETWORK_PASSPHRASE, STELLAR_ERRORS } from '../constants/stellar.constants';

export interface TransactionDetails {
  hash: string;
  operations: any[];
  fee: string;
  sequence: string;
}

export const parseTransaction = (xdr: string): Transaction => {
  try {
    return new Transaction(xdr, NETWORK_PASSPHRASE);
  } catch (error) {
    throw new Error(`${STELLAR_ERRORS.PARSE_FAILED}: ${error}`);
  }
};

export const getTransactionHash = (transaction: Transaction): string => {
  return transaction.hash().toString('hex');
};

export const getTransactionDetails = (xdr: string): TransactionDetails => {
  const transaction = parseTransaction(xdr);
  
  return {
    hash: getTransactionHash(transaction),
    operations: transaction.operations.map((op) => ({
      type: op.type
    })),
    fee: transaction.fee,
    sequence: transaction.sequence
  };
};

export const verifyTransactionSignature = (
  transaction: Transaction,
  keypair: Keypair
): boolean => {
  return transaction.signatures.some((sig) => {
    try {
      return keypair.verify(transaction.hash(), sig.signature());
    } catch {
      return false;
    }
  });
};

export const signTransactionWithKeypair = (
  transaction: Transaction,
  keypair: Keypair
): void => {
  transaction.sign(keypair);
};
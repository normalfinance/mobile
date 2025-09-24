import { Transaction, Networks } from '@stellar/stellar-sdk';
import { WalletService } from './WalletService';

export interface SignedTransaction {
  signedXDR: string;
  transactionHash: string;
  walletAddress: string;
}

export class TransactionService {
  // Stellar network passphrase (you can configure this based on your environment)
  private static readonly NETWORK_PASSPHRASE = Networks.PUBLIC; // Use Networks.TESTNET for testnet

  /**
   * Sign a transaction XDR with the user's wallet
   */
  static async signTransaction(unsignedXDR: string): Promise<SignedTransaction> {
    try {
      // Get the user's keypair
      const keypair = await WalletService.getKeypair();
      if (!keypair) {
        throw new Error('No wallet found. Please create or import a wallet first.');
      }

      // Get wallet info for the address
      const walletInfo = await WalletService.getWallet();
      if (!walletInfo) {
        throw new Error('Wallet information not found.');
      }

      // Parse the transaction from XDR
      const transaction = new Transaction(unsignedXDR, this.NETWORK_PASSPHRASE);

      // Sign the transaction
      transaction.sign(keypair);

      // Get the signed XDR
      const signedXDR = transaction.toXDR();

      // Calculate transaction hash
      const transactionHash = transaction.hash().toString('hex');

      return {
        signedXDR,
        transactionHash,
        walletAddress: walletInfo.publicKey
      };
    } catch (error) {
      throw new Error(`Failed to sign transaction: ${error}`);
    }
  }

  /**
   * Verify a transaction signature
   */
  static async verifyTransaction(signedXDR: string, expectedWalletAddress: string): Promise<boolean> {
    try {
      // Parse the signed transaction
      const transaction = new Transaction(signedXDR, this.NETWORK_PASSPHRASE);
      
      // Get the wallet info
      const walletInfo = await WalletService.getWallet();
      if (!walletInfo || walletInfo.publicKey !== expectedWalletAddress) {
        return false;
      }

      // Get the keypair for verification
      const keypair = await WalletService.getKeypair();
      if (!keypair) {
        return false;
      }

      // Verify signature
      return transaction.signatures.some((sig) => {
        try {
          return keypair.verify(transaction.hash(), sig.signature());
        } catch {
          return false;
        }
      });
    } catch (error) {
      console.error('Transaction verification failed:', error);
      return false;
    }
  }

  /**
   * Get transaction details from XDR
   */
  static getTransactionDetails(xdr: string): {
    hash: string;
    operations: any[];
    fee: string;
    sequence: string;
  } {
    try {
      const transaction = new Transaction(xdr, this.NETWORK_PASSPHRASE);
      
      return {
        hash: transaction.hash().toString('hex'),
        operations: transaction.operations.map(op => ({
          type: op.type,
          // Add more operation details as needed
        })),
        fee: transaction.fee,
        sequence: transaction.sequence
      };
    } catch (error) {
      throw new Error(`Failed to parse transaction: ${error}`);
    }
  }

  /**
   * Set network passphrase (for switching between mainnet/testnet)
   */
  static setNetworkPassphrase(passphrase: string): void {
    // This would typically be stored in config or env
    console.log(`Network passphrase set to: ${passphrase}`);
  }
}
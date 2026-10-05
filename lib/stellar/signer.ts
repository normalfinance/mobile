// ONE Stellar signing entry point (web kit-signer.ts signStellarTxForMgi /
// runWalletKitSigning): the address decides who signs. The active external
// wallet's address → WalletConnect (LOBSTR …); anything else → the Normal
// wallet's passkey via Turnkey. Every money path (savings, send, Soroswap,
// CCTP burn, MoneyGram SEP-10) calls this, so none of them know which wallet
// is in the slot.

import { signStellarXdrWithTurnkey, type SignStellarParams } from "@/lib/turnkey/stellar-signer";
import { isExternalAddress } from "@/lib/external-wallet/store";
import { signXdrWithWalletConnect } from "@/lib/external-wallet/walletconnect";

export const signStellarXdr = async (params: SignStellarParams): Promise<string> => {
  if (isExternalAddress(params.stellarAddress)) return signXdrWithWalletConnect(params.xdr);
  return signStellarXdrWithTurnkey(params);
};

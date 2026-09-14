// Stellar send — a port of the web's rules, not a reinterpretation:
//   packages/web/src/utils/stellar-reserve.ts      reserve / spendable math
//   packages/web/src/lib/stellar/send-plan.ts       destination plan (pure, unit-tested on web)
//   packages/web/src/lib/stellar/memo-required*.ts  three-layer memo guard (finding #48)
//   packages/web/src/hooks/stellar/use-send-token.ts tx shape, probes, error mapping
// Stellar sends are CLIENT-SIDE (Q41): build → sign with the Turnkey passkey →
// submit straight to Horizon. No backend route is involved.

import {
  Asset,
  Horizon,
  Keypair,
  Memo,
  Networks,
  Operation,
  StrKey,
  TransactionBuilder
} from "@stellar/stellar-sdk";

import { ApiError, apiFetch } from "@/lib/api";
import { signStellarXdrWithTurnkey } from "@/lib/turnkey/stellar-signer";

// ---------------------------------------------------------------------------
// Constants (web: stellar-reserve.ts, send-plan.ts, use-send-token.ts)
// ---------------------------------------------------------------------------

export const HORIZON_URL =
  process.env.EXPO_PUBLIC_MAINNET_HORIZON_URL || "https://horizon.stellar.org";

export const STELLAR_BASE_RESERVE = 0.5;
/** Fixed 2000-stroop network fee (0.0002 XLM) used when building the payment. */
export const STELLAR_TX_FEE_STROOPS = "2000";
export const STELLAR_TX_FEE_XLM = 0.0002;
/** Minimum starting balance Stellar accepts for createAccount (2 × base reserve). */
export const MIN_ACTIVATION_XLM = 1;
/** Held back from every XLM outflow while a savings position is active (#67). */
export const SAVINGS_XLM_BUFFER = 1;

/** Circle USDC on Stellar mainnet (same issuer web's canonical token uses). */
export const MAINNET_USDC = {
  code: "USDC",
  issuer: "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN"
} as const;

export type SendableSymbol = "XLM" | "USDC";

// ---------------------------------------------------------------------------
// Reserve math
// ---------------------------------------------------------------------------

/** Minimum XLM the account must keep to stay valid on-chain. */
export const stellarMinReserve = (subentryCount: number): number =>
  (2 + Math.max(subentryCount, 0)) * STELLAR_BASE_RESERVE;

/** Max XLM that can actually be sent: balance − minimum reserve − network fee. */
export const spendableXlm = (balance: number, subentryCount: number): number =>
  Math.max(balance - stellarMinReserve(subentryCount) - STELLAR_TX_FEE_XLM, 0);

// Soroban fees (savings deposit/withdraw, Soroswap) run 0.05–0.5+ XLM — hundreds
// of times the classic fee. Web's #67 semaphore: below this the action is
// blocked, below SAVINGS_XLM_BUFFER it is "low", at/above it "ok".
export const MIN_XLM_FOR_SOROBAN_TX = 0.5;

/** XLM above the minimum reserve, i.e. what can go to network/Soroban fees. */
export const xlmAvailableForFees = (xlmBalance: number, subentryCount = 1): number =>
  Math.max(xlmBalance - stellarMinReserve(subentryCount), 0);

export type XlmFeeStatus = "ok" | "low" | "blocked";

export const xlmFeeStatus = (xlmBalance: number, subentryCount = 1): XlmFeeStatus => {
  const available = xlmAvailableForFees(xlmBalance, subentryCount);
  if (available < MIN_XLM_FOR_SOROBAN_TX) return "blocked";
  if (available < SAVINGS_XLM_BUFFER) return "low";
  return "ok";
};

export const spendableXlmForOutflow = (
  balance: number,
  subentryCount: number,
  hasActiveSavings: boolean
): number => {
  const base = spendableXlm(balance, subentryCount);
  return hasActiveSavings ? Math.max(base - SAVINGS_XLM_BUFFER, 0) : base;
};

// ---------------------------------------------------------------------------
// Address / memo
// ---------------------------------------------------------------------------

/** Classic G-address only — muxed/contract addresses are not send targets here. */
export const isValidStellarAddress = (address: string): boolean =>
  /^G[A-Z2-7]{55}$/.test(address) && StrKey.isValidEd25519PublicKey(address);

export type MemoType = "MEMO_TEXT" | "MEMO_ID";

/** Digits that fit a uint64 → id memo (what exchanges hand out); else text (≤ 28 bytes). */
export const detectMemoType = (memo: string): MemoType | null => {
  const m = memo.trim();
  if (!m) return null;
  if (/^\d{1,20}$/.test(m)) {
    try {
      if (BigInt(m) <= 18446744073709551615n) return "MEMO_ID";
    } catch {
      /* fall through */
    }
  }
  return Buffer.byteLength(m, "utf8") <= 28 ? "MEMO_TEXT" : null;
};

export interface MemoRequirement {
  required: boolean;
  name?: string;
  /** true = the live check could not run — warn, never silently pass. */
  unknown?: boolean;
}

// Seed list verified from stellar.expert's directory (web memo-required-list.ts,
// fetched 2026-08-06). Instant, offline floor; the live route covers the rest.
export const KNOWN_MEMO_REQUIRED: ReadonlyMap<string, string> = new Map([
  ["GDS2WFLIJID6BDM64FGUD7MNOVZUEWHJ5VJPO2GQ32KOZCYIYIRIQTG6", "Coinbase"],
  ["GB5CLRWUCBQ6DFK2LR5ZMWJ7QCVEB3XKMPTQUYCDIYB4DRZJBEW6M26D", "Coinbase"],
  ["GBOYDKMW7MKSXV3UAPTEWVF3IX2EIJ4YOCEH6MOO5XTYOJKIH73YESVB", "Coinbase"],
  ["GC23BCI644P66PPNRGRMKFFVQZZXE3CSCGMFIYFV5OW4WCPM2XICKWQZ", "Coinbase"],
  ["GC5PFAXPL3BYIRHLMUFD3E353DINA6A52DXJIXLKQEVO2GA7WFWGWCFS", "Coinbase"],
  ["GAHK7EEG2WWHVKDNT4CEQFZGKF2LGDSW2IVM4S5DP42RBW3K6BTODB4A", "Binance"],
  ["GBUTD5DNV43JBJP7AA657H2CYPUCAAFBXCKX7QE4XXGYIYFZZX2EKKVF", "Binance"],
  ["GABFQIK63R2NETJM7T673EAMZN4RJLLGP3OFUEJU5SZVTGWUKULZJNL6", "Binance"],
  ["GA5XIGA5C7QTPTWXQHY6MCJRMTRZDOSHR6EFIBNDQTCQHG262N4GGKTM", "Kraken"],
  ["GAQZU7Y7GB3E4XOA3ZXEZDOTIEIWQRYOAIVJ6STY2YTUQAGZL3GYJCXG", "Kraken"],
  ["GBBALM76B5OUPOZCMFCNT5PVIFV3WTUYX3VVGC7FMN4ZPQLGCG2C4X3D", "Kraken"],
  ["GAJ4BSGJE6UQHZAZ5U5IUOABPDCYPKPS3RFS2NVNGFGFXGVQDLBQJW2P", "KuCoin"],
  ["GBJNV2MQA7M5GNBRDFW46JLXIN7ZLYVVM4UW4CWDZO4KZKXIXCRYHMH2", "KuCoin"],
  ["GA3NTBDIKQVDDM6ZDKJLGXJFESWJ636AGRIW34RH5WL24LUMX3YASKX2", "Bitstamp"],
  ["GAWPTHY6233GRWZZ7JXDMVXDUDCVQVVQ2SXCSTG3R3CNP5LQPDAHNBKL", "Bitfinex"],
  ["GB6YPGW5JFMMP2QB2USQ33EUWTXVL4ZT5ITUNCY3YKVWOJPP57CANOF3", "Bittrex"],
  ["GBGII2C7M4TOEC2MVAZYG3TRFM3ATCCEWANSN4Q3AHEX3NRKXJCVZDEV", "OKX"],
  ["GBC6NRTTQLRCABQHIR5J4R4YDJWFWRAO4ZRQIM2SVI5GSIZ2HZ42RINW", "Gate.io"],
  ["GB67TJFJO3GUA432EJ4JTODHFYSBTM44P4XQCDOFTXJNNPV2UKUJYVBF", "Crypto.com"],
  ["GB2ES2N326MZK4EGJBKN3ZARCQ5RTFQSAWIJAAKFVIIIJSCC35TXIMLB", "Robinhood"],
  ["GAW4E6NGM4NPNX2LO2BKDPCCTUX3FJLKWHPU4VQPGBIBQGD6JTVF5C7C", "Upbit"],
  ["GARAR5QR7WRL24MQMSO4INWV7C5SE4EE2YVXTLD6ORONYFHSUAGZYSLN", "Blockchain.com"],
  ["GBF6SZEZ4AJY7BCBUV3ZYJ3Q27YMO4NJU6IZQP7ODY47MPVFWCO24SNW", "Blockchain.com"],
  ["GB3RMPTL47E4ULVANHBNCXSXM2ZA5JFY5ISDRERPCXNJUDEO73QFZUNK", "CEX.IO"],
  ["GBW64JT24G4M2FTXVDKJOEQDSBLULXALEYY6VPEJIEN4NTFGMW35BPP5", "Bitvavo"],
  ["GBS2RTBGEWBT7DJOH7CTA4PDVLIPONCPCIILJPPESWSHDIV4NFZJHRP3", "Bitkub"],
  ["GC7YNBWTTLCMAODL2KRBGVN6PIHH25GVUYTSIOSC744TZOG53VFNQ247", "Bithumb"],
  ["GAPRC4SRTZSIUA34CWP7KB7FIMURX3ZT2CPNBGET5TJ4XZBONKHS6TPF", "NiceHash"],
  ["GBQYTZQHIHEP4GAACBCDM4X7OGMHULRUMX5B7L5WANGVXISDWJTUPM25", "Changelly"],
  ["GC4KAS6W2YCGJGLP633A6F6AKTCV4WSLMTMIQRSEQE5QRRVKSX7THV6S", "Indodax"],
  ["GBZLHGDYMSVF4X6DYAGKLIQX3F64W3MXNDVGHKQPR226TCJ5QJ2ZQKVA", "Paribu"],
  ["GABRNO3RCFT5VS3JZ5K6A5PBVI47BKKNO6SH3XFQQHIPCW5AWIU3F4SL", "Bitpanda"],
  ["GALKEUDKJYXIAWPB2W4L6CP44ZRZR5KD2IQOUIXIO6U2FFTUL4MNTDVK", "NDAX"]
]);

export const knownMemoRequirement = (address: string): MemoRequirement | null => {
  const name = KNOWN_MEMO_REQUIRED.get(address.trim().toUpperCase());
  return name ? { required: true, name } : null;
};

const memoCache = new Map<string, MemoRequirement>();

/** Seed list, then GET /api/stellar/memo-required (directory + SEP-29). Fails OPEN to the seed list. */
export const fetchMemoRequirement = async (address: string): Promise<MemoRequirement> => {
  const known = knownMemoRequirement(address);
  if (known) return known;
  const key = address.trim().toUpperCase();
  const cached = memoCache.get(key);
  if (cached) return cached;
  try {
    const data = await apiFetch<{ required?: boolean; name?: string; degraded?: boolean }>(
      "/api/stellar/memo-required",
      { query: { address: key } }
    );
    const result: MemoRequirement = { required: !!data?.required, name: data?.name, unknown: !!data?.degraded };
    memoCache.set(key, result);
    return result;
  } catch (e) {
    return { required: false, unknown: !(e instanceof ApiError && e.status === 400) };
  }
};

// ---------------------------------------------------------------------------
// Destination plan (web send-plan.ts, verbatim logic)
// ---------------------------------------------------------------------------

export type StellarSendPlan =
  | { kind: "payment" }
  | { kind: "create-account" }
  | {
      kind: "blocked";
      reason: "activation-minimum" | "destination-not-active" | "destination-needs-trustline";
    };

export const planStellarSend = (params: {
  symbol: SendableSymbol;
  amount: number;
  destinationExists: boolean;
  destinationHasTrustline: boolean | null;
}): StellarSendPlan => {
  const { symbol, amount, destinationExists, destinationHasTrustline } = params;
  const isXlm = symbol === "XLM";
  if (!destinationExists) {
    if (!isXlm) return { kind: "blocked", reason: "destination-not-active" };
    if (amount < MIN_ACTIVATION_XLM) return { kind: "blocked", reason: "activation-minimum" };
    return { kind: "create-account" };
  }
  if (!isXlm && destinationHasTrustline === false)
    return { kind: "blocked", reason: "destination-needs-trustline" };
  return { kind: "payment" };
};

export const BLOCK_MESSAGES: Record<Extract<StellarSendPlan, { kind: "blocked" }>["reason"], (sym: string) => string> = {
  "activation-minimum": () =>
    `This account isn’t active on Stellar yet — the first transfer must be at least ${MIN_ACTIVATION_XLM} XLM to activate it.`,
  "destination-not-active": (sym) =>
    `This account isn’t active on Stellar yet. Send it at least ${MIN_ACTIVATION_XLM} XLM first, add a ${sym} trustline there, then send ${sym}.`,
  "destination-needs-trustline": (sym) =>
    `That wallet can’t hold ${sym} yet — it needs a ${sym} trustline. Add the asset in that wallet’s app, then try again.`
};

// ---------------------------------------------------------------------------
// Horizon helpers
// ---------------------------------------------------------------------------

export const horizon = () => new Horizon.Server(HORIZON_URL);

export interface SourceState {
  account: Horizon.AccountResponse;
  xlmBalance: number;
  usdcBalance: number | null; // null = no USDC trustline
  subentryCount: number;
}

export const loadSource = async (address: string): Promise<SourceState> => {
  const account = await horizon().loadAccount(address);
  const native = account.balances.find((b) => b.asset_type === "native");
  const usdc = account.balances.find(
    (b) =>
      "asset_code" in b && b.asset_code === MAINNET_USDC.code && b.asset_issuer === MAINNET_USDC.issuer
  );
  return {
    account,
    xlmBalance: Number(native?.balance ?? 0),
    usdcBalance: usdc ? Number(usdc.balance) : null,
    subentryCount: account.subentry_count
  };
};

export const probeDestination = async (
  destination: string,
  symbol: SendableSymbol
): Promise<{ exists: boolean; hasTrustline: boolean | null }> => {
  try {
    const dest = await horizon().loadAccount(destination);
    if (symbol === "XLM") return { exists: true, hasTrustline: null };
    const has = !!dest.balances.find(
      (b) =>
        "asset_code" in b && b.asset_code === MAINNET_USDC.code && b.asset_issuer === MAINNET_USDC.issuer
    );
    return { exists: true, hasTrustline: has };
  } catch (e: unknown) {
    const status = (e as { response?: { status?: number } })?.response?.status;
    const name = (e as { name?: string })?.name;
    if (status === 404 || name === "NotFoundError") return { exists: false, hasTrustline: null };
    // Any other Horizon failure: leave the defaults — the chain stays the judge.
    return { exists: true, hasTrustline: null };
  }
};

/** Poll Horizon /transactions/{hash} (700ms, 8s budget) until the ledger has
 *  it. A 404 is "not ingested yet", not an error; never throws (web
 *  lib/stellar/await-tx-visible.ts). Direct Horizon read on purpose: no
 *  server cache, no floor in the way. */
export const awaitTxVisible = async (hash: string, budgetMs = 8_000): Promise<boolean> => {
  const deadline = Date.now() + budgetMs;
  while (Date.now() < deadline) {
    try {
      await horizon().transactions().transaction(hash).call();
      return true;
    } catch {
      /* 404 or hiccup — keep polling */
    }
    await new Promise((r) => setTimeout(r, 700));
  }
  return false;
};

/** Horizon result codes → something a person can act on (web friendlyAppError subset). */
export const friendlyHorizonError = (err: unknown): string => {
  const codes = (err as { response?: { data?: { extras?: { result_codes?: { transaction?: string; operations?: string[] } } } } })
    ?.response?.data?.extras?.result_codes;
  const all = `${codes?.transaction ?? ""} ${(codes?.operations ?? []).join(" ")}`.trim();
  const map: [RegExp, string][] = [
    [/op_underfunded/, "Not enough balance to cover this amount plus the network reserve."],
    [/op_no_destination/, "That account doesn’t exist on Stellar yet."],
    [/op_no_trust/, "That wallet has no trustline for this asset."],
    [/op_line_full/, "That wallet can’t receive this much of the asset (trustline limit)."],
    [/tx_bad_seq/, "The account changed while sending. Please try again."],
    [/tx_too_late/, "The transaction expired before it was submitted. Please try again."],
    [/tx_insufficient_fee/, "Network fee too low right now. Please try again in a moment."],
    [/tx_bad_auth/, "The signature was rejected by the network."],
    [/tx_insufficient_balance/, "Not enough XLM to cover the fee and reserve."]
  ];
  for (const [re, msg] of map) if (re.test(all)) return msg;
  if (all) return `The network rejected the transaction (${all}).`;
  return err instanceof Error ? err.message : "The transaction failed.";
};

// ---------------------------------------------------------------------------
// The send
// ---------------------------------------------------------------------------

export type SendStep = "checking" | "building" | "signing" | "submitting";

export interface SendStellarParams {
  subOrgId: string;
  from: string;
  symbol: SendableSymbol;
  amount: number;
  destination: string;
  memo?: string;
  hasActiveSavings?: boolean;
  onStep?: (step: SendStep) => void;
}

export const sendStellar = async ({
  subOrgId,
  from,
  symbol,
  amount,
  destination,
  memo,
  hasActiveSavings = false,
  onStep
}: SendStellarParams): Promise<{ hash: string; plan: StellarSendPlan }> => {
  if (!isValidStellarAddress(destination)) throw new Error("Enter a valid Stellar address (starts with G).");
  if (destination === from) throw new Error("You can’t send to your own address.");
  if (!(amount > 0)) throw new Error("Enter an amount.");

  onStep?.("checking");
  const source = await loadSource(from);

  if (symbol === "XLM") {
    const spendable = spendableXlmForOutflow(source.xlmBalance, source.subentryCount, hasActiveSavings);
    if (amount > spendable) {
      throw new Error(
        `Insufficient balance. You can send at most ${spendable.toFixed(7).replace(/\.?0+$/, "")} XLM (minimum reserve ${stellarMinReserve(source.subentryCount).toFixed(1)} XLM).`
      );
    }
  } else {
    if (source.usdcBalance === null) throw new Error("This wallet has no USDC trustline.");
    if (amount > source.usdcBalance) throw new Error("Insufficient USDC balance.");
    if (spendableXlm(source.xlmBalance, source.subentryCount) < 0) throw new Error("Not enough XLM to pay the network fee.");
  }

  const probe = await probeDestination(destination, symbol);
  const plan = planStellarSend({
    symbol,
    amount,
    destinationExists: probe.exists,
    destinationHasTrustline: probe.hasTrustline
  });
  if (plan.kind === "blocked") throw new Error(BLOCK_MESSAGES[plan.reason](symbol));

  onStep?.("building");
  const amountStr = amount.toFixed(7).replace(/\.?0+$/, "");
  const builder = new TransactionBuilder(source.account, {
    fee: STELLAR_TX_FEE_STROOPS,
    timebounds: { minTime: 0, maxTime: Math.floor(Date.now() / 1000) + 2 * 60 },
    networkPassphrase: Networks.PUBLIC
  });
  if (plan.kind === "create-account") {
    builder.addOperation(Operation.createAccount({ destination, startingBalance: amountStr }));
  } else if (symbol === "XLM") {
    builder.addOperation(Operation.payment({ destination, asset: Asset.native(), amount: amountStr }));
  } else {
    builder.addOperation(
      Operation.payment({ destination, asset: new Asset(MAINNET_USDC.code, MAINNET_USDC.issuer), amount: amountStr })
    );
  }
  if (memo?.trim()) {
    const type = detectMemoType(memo);
    if (type === "MEMO_ID") builder.addMemo(Memo.id(memo.trim()));
    else if (type === "MEMO_TEXT") builder.addMemo(Memo.text(memo.trim()));
    else throw new Error("Memo must be up to 28 characters, or a numeric id.");
  }
  const unsignedXdr = builder.build().toXDR();

  onStep?.("signing");
  const signedXdr = await signStellarXdrWithTurnkey({
    xdr: unsignedXdr,
    subOrgId,
    stellarAddress: from,
    networkPassphrase: Networks.PUBLIC
  });

  onStep?.("submitting");
  try {
    const tx = TransactionBuilder.fromXDR(signedXdr, Networks.PUBLIC);
    const result = await horizon().submitTransaction(tx);
    return { hash: result.hash, plan };
  } catch (e) {
    throw new Error(friendlyHorizonError(e));
  }
};

/** Sanity helper for UIs: does this string look like a public key at all? */
export const isStellarKeypairAddress = (s: string) => {
  try {
    Keypair.fromPublicKey(s);
    return true;
  } catch {
    return false;
  }
};

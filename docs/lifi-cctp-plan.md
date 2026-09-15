# LI.FI + CCTP on mobile — implementation map (2026-09-16)

**Status 2026-09-16: all four families are built** (CCTP outbound + inbound tested on a device;
LI.FI native ⇄ native and BTC as a source built from source, untested). Kept as the reference map.
Written from the web source (`../normal-v1-interface/packages/web/src`) and the web agent's map. Scope is the last two swap families:
BTC/ETH/SOL ⇄ each other via **LI.FI**, and Stellar ⇄ BTC/ETH/SOL via the
**CCTP composite** (Soroswap → Circle CCTP → LI.FI). Estimated effort: LI.FI 2–3 days,
CCTP 4–6 days, both dominated by testing with real funds.

## What mobile already has that these reuse
- Turnkey signers: EVM `SIGN_TRANSACTION_V2` (`lib/send/evm.ts`), Solana raw payload
  (`lib/send/solana.ts`), Bitcoin PSBT via `TRANSACTION_TYPE_BITCOIN` (`lib/send/bitcoin.ts`),
  Stellar envelope (`lib/turnkey/stellar-signer.ts`).
- Lazy chain accounts (`lib/turnkey/accounts.ts`), device gate, after-action refresh
  (`lib/data/after-action.ts`), step list UI (`components/savings/StepList.tsx`), quote
  drift/consent pattern (`app/(tabs)/swap.tsx`).

## LI.FI (native ⇄ native)
Routes (all under `/api/lifi/`):
- `quote` — **public**, IP-limited. Body `{ fromSymbol, toSymbol, fromAmount (base units),
  fromAddress, toAddress, denyBridges?, denyExchanges? }` → `{ success, quote, feePercent }`.
  Server core `server/lifi-quote.ts` (integrator fee, feeless retry on LI.FI error 1011,
  permanent `gasZipBridge` deny, `LIFI_DENY_EXCHANGES` default `fly`). `LIFI_API_KEY` is
  server-only.
- `status` (authed, `?txHash&fromChain&toChain`), `statuses` (authed, batch ≤25, cached 86400s
  terminal / 30s transient), `record` (authed, `{ fromSymbol, toSymbol, amountIn, amountOut,
  txHash, feeAmount? }` → the swap's ONLY activity row; 3 attempts on web).
Client sequence (web `use-lifi-engine.tsx`, `lib/lifi/execute.ts`, `lifi-tracker.ts`):
1. Debounced quote (one silent retry on 429/5xx). Freshness `QUOTE_STALE_MS` 10 min; a
   materially worse re-quote aborts and needs a second press (`quote-freshness.ts`).
2. Pre-signature affordability: `gas-shortfall.ts` → "use the affordable amount" dialog.
3. Execute — **one signature per chain**:
   - EVM: build from `quote.transactionRequest`, `SIGN_TRANSACTION_V2`; a second ceremony only on
     a nonce race. No ERC-20 approve on this path.
   - SOL: `SIGN_RAW_PAYLOAD_V2` over the serialized **v0** message, spliced into
     `vtx.signatures[signerIndex]`.
   - BTC: local BIP-143 sighashes + ONE `SIGN_RAW_PAYLOADS` batched over all inputs, with
     **low-S normalisation** (high-S is valid but non-standard; relays silently drop it);
     `btc-spend-verdict.ts` refuses to spend materially more than quoted. **Hard rule 8:
     only ever add signatures to the PSBT.** Turnkey's `TRANSACTION_TYPE_BITCOIN` cannot be
     used here (OP_RETURN outputs → "UnrecognizedScript").
4. `confirmSource` (ETH receipt ×45/4s, SOL signature ×30/2s, BTC = broadcast accepted) →
   `POST lifi/record` → poll `status` every 15s up to 80 polls (~20 min) → on DONE await the
   destination balance (15s cap) → status override so the feed doesn't show the 30s-cached
   PENDING.
Mobile notes: `@noble/curves/secp256k1` for the BTC sighash signing (web uses it; no native
binding), `bitcoinjs-lib` v7 (noble-based). Both should run on Hermes with the existing shim.
Needs `EXPO_PUBLIC_ETH_RPC_URL`, `EXPO_PUBLIC_SOLANA_RPC_URL`, `EXPO_PUBLIC_BASE_RPC_URL`.

## CCTP composite (Stellar ⇄ native)
Routes (`/api/cctp/`): `quote` (authed; **$10 min**, feeBps 50, fee on the LI.FI leg),
`transfers` POST (record-before-broadcast; `refund:true` must name your own unfinished outbound
row), `transfers` GET (`?history=1` → 30 rows for the feed; default → in-flight for the banner),
`transfers/[id]` GET (**advances the state machine** unless `?noAdvance=1`), PATCH (write-once
hashes), `gas-topup`, `autopilot/{burn,pivot}`, cron `cctp-advance` (every 2 min).
State (`lib/cctp/state.ts`, plain string column): CREATED → BURN_SUBMITTED → BURN_CONFIRMED →
ATTESTED → MINT_SUBMITTED → COMPLETED, plus FAILED / REFUNDED. Domains: ethereum 0, solana 5,
base 6, stellar 27.
Recovery surface = `sections/swap/cctp-phase.ts` **copied verbatim** (`hidden | auto |
halt-receive | halt-finish`); resume = `gas-topup` then burn or pivot. Poll 5–15s while
bridging, 10s arrival/pivot, 30s recovery banner; abandon after 45 min.
INBOUND (native → Stellar), signatures: LI.FI swap to the user's own Base address (1) → arrival
watch (Base USDC ≥95% of `toAmountMin`, refund verdict every 3rd poll, 45-min cap) → relayer gas
top-up (0) → burn: autopilot 0 sigs, else 1–2 (approve only if allowance short) → Iris
attestation (0) → mint + forward on Stellar by the relayer (0) → poll to COMPLETED.
OUTBOUND (Stellar USDC → native): Soroban burn `approve + deposit_for_burn` (1–2) → attestation →
relayer mint on Base → gas top-up → LI.FI pivot: autopilot 0 sigs (one automatic failover), else
1–2 → delivery watch (BTC ~60 min). Two consecutive pivot reverts auto-start the refund.
Custody hard rule 10: `mintRecipient` and `destinationCaller` = the CctpForwarder, the real
recipient only in `hookData`; take only what *this* transfer is owed (`scopedAmountWire` =
quoted + 5%). Verify the USDC trustline before burning.
Autopilot (optional, `EXPO_PUBLIC_AUTOPILOT_PUBLIC_KEY`; absent = dark): one-time ceremony
`CREATE_API_ONLY_USERS` + `CREATE_POLICY_V3`, Base-chain legs only. No Stellar autopilot ever.

## Suggested order
1. LI.FI ETH ⇄ SOL first (no BTC sighash work), reusing the Swap tab with a chain picker.
2. LI.FI BTC (sighash + low-S + spend verdict).
3. CCTP inbound (mostly relayer-driven; one user signature with autopilot off = 2–3).
4. CCTP outbound + recovery banner.
Before any of it: the per-IP limits on `lifi/quote` and `swap/quote` (server change requested
from the web side) and a decision on autopilot on mobile.

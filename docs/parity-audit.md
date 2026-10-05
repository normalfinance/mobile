# Web → mobile parity audit (started 2026-10-03)

Source of truth: the web agent's code-read inventory (5 parts), diffed against this repo.
Status per item: **have** · **partial** · **missing** · **by design** (deliberate mobile difference, agreed).
Build order after the inventory completes: Sell (Coinbase off-ramp) → transaction detail + BTC tracker →
Settings General/Accounts → referrals → MoneyGram → legal/support/geo-block/session banner → earnings history.

## 1. Savings (inventory 1/5)

| Web feature | Mobile | Action |
|---|---|---|
| Page gate: no Stellar wallet → "Set up your savings wallet" | have (`Add Stellar to your wallet`, lazy provision) | — |
| Vault info (APY, name, asset), skeleton while null | have (`useVaultInfo`, once per launch) | — |
| Hero: balance, current earnings (+%), est. annual / weekly / monthly, APY | have (earnings %, est. annual / monthly / weekly) | — |
| Position: shares/currentValue/totalDeposited/earnings; never shows a transient 0 | have (disk cache, epoch guard) | — |
| "Your Deposits" net of events merged with own pending rows | have (server-side; mobile reads it) | — |
| Deposit: net amount, fee pair sign-both-first, execute-pair, pre-check copy | have | — |
| Deposit fee 0.5%, "Net deposit", "Est. yearly earnings", separate-settle note | have | — |
| Deposit progress steps (checking → sign 1/2 → sign 2/2 → crediting) | have (`savings-action`) | — |
| Withdraw with yield commission as chained payment; 1 signature when 0 | have | — |
| Yield-commission tiers 20/15/10/5 % | have (`normal-fees.ts` verbatim) | — |
| No minimums; "> 0" only | have | — |
| MAX deposit = wallet USDC 7dp; withdraw = currentValue 7dp | have | — |
| XLM-fee guard: blocked < 0.5 / low < 1 / ok, with Swap/Buy/Receive XLM actions | have (`FeeLight` + Swap USDC→XLM / Buy / Receive actions) | — |
| 1 XLM savings buffer held back by Send/Swap while position active | have (`spendableXlmForOutflow`) | — |
| Setup gate: activate (QR + buy XLM + watch) → trustline → done | have (`SetupCard`, 4s probe) | — |
| Trustline modal when an action error mentions "trustline" | have (alert with “Add USDC trustline”, `savings-action`) | — |
| Earnings chart (1W…ALL, period chip) via `savings/earnings-history` | have (`EarningsChart`, verbatim curve builder) | — |
| Transaction history list (Deposit/Withdraw, explorer link) on the Savings page | have (`HistoryCard`, 10 + Show more, tap → detail) | — |
| Onramp card "Need USDC? Deposit cash / Deposit crypto" | have (`OnrampCard`: Coinbase / Receive USDC) | — |
| Optimistic position after action + 3/15/45s reads | have | — |
| Fee-escrow sweeper copy for timeouts | have (`submitFeePair` copy) | — |
| External/hybrid wallet pickers | by design (no external wallets on mobile) | — |

## 2. Swap (inventory 2/5)

| Web feature | Mobile | Action |
|---|---|---|
| Pairs matrix, canPair filter, flip no-op when invalid | have (`lib/swap/registry.ts`) | — |
| `/swap?from=` preselect, `?cctpResume=` | have (`from`/`to` params; resume via `runId`/`transferId`) | — |
| Readiness notices (not active / no trustline) | have (as button gates) | — |
| USD⇄token toggle, receive 6dp, hints | have | — |
| Spendable incl. **pending outflows** (in-flight swap amounts excluded from MAX) | have (`lib/spendable.ts`, all panels + Send) | — |
| ETH live gas reserve 550k×1.6, 60s refresh | have (per-screen, not 60s refresh) | — |
| Done waits for balances (15s cap) | have | — |
| Stellar result-code → friendly error map | have (`friendlyHorizonError` in Soroswap runs too) | — |
| Soroswap: 500ms debounce, 1% slippage, embedded vs two-sig, fee-XLM guard, gates, steps | have | — |
| LI.FI: $5 min, 10-min freshness + 1% drift, gas honesty, ETH affordability, BTC PSBT signer, SOL v0, tracker, record | have (budget derived from settlement window — better than web) | — |
| CCTP: $10 min, fee rows, ETA, gate order, autopilot, top-up, failover, refund, calm ending | have | — |
| CCTP inbound BTC MAX = mempool halfHourFee×210×1.4 clamped 0.00003–0.0005 | have | — |
| Recovery banner phases (auto / halt-receive / halt-finish) | have (In flight card + run page) | — |
| Activity "Swap details" modal with legs + "Finish this transfer" | have (`app/tx.tsx`) | — |
| Server cap `CCTP_PILOT_MAX_USD` message | have (server error surfaces) | — |
| Known web defects (stale halt rows; reverted pivot hash stored) | not copied | — |

## 3. Send · Buy · Sell · USDC-on-Stellar rules (inventory 3+4/5)

### Send
| Web feature | Mobile | Action |
|---|---|---|
| Asset list = held assets (+ add chain) | have | — |
| Crypto ⇄ USD input toggle | have (Send `⇅ ≈` toggle) | — |
| Spendable minus in-flight pending sends | have (`lib/spendable.ts`) | — |
| CTA label = validation state | have | — |
| Review screen with "I have verified the address and amount" checkbox | have (confirm sheet checkbox) | — |
| Stellar address regex, muxed rejected, self-send blocked | have / verify self-send | check |
| Memo toggle, MEMO_ID vs TEXT, seed list, live memo-required check (fails open) | have | — |
| Unactivated XLM destination → createAccount ≥ 1 XLM | have | — |
| Unactivated / no-trustline USDC destination blocked before signing | have | — |
| XLM reserve + savings buffer; USDC needs 0.0002 fee XLM | have | — |
| BTC: dust 546, fee preview, MAX = UTXOs − sweep fee, PSBT via server | have | — |
| BTC status modal (polls mempool until confirmed) | have (`app/tx.tsx`, 30 s mempool poll) | — |
| ETH: gas reserve, estimateGas ×1.2, revert copy, "reduce by X ETH" | have / partial copy | — |
| SOL: rent rule, fee 0.000005, MAX = lamports − 5000 | have | — |
| ETH/SOL via `send/execute` (409 while confirming) | have | — |
| Pending rows with per-chain expiry (XLM/SOL 10 min, ETH 2 h, BTC 48 h) | have | — |

### Buy
| Web feature | Mobile | Action |
|---|---|---|
| Coinbase on-ramp (session → pay.coinbase.com, pending row, baseline) | have (plus USD/EUR/GBP + presets — better than web's fixed $100) | — |
| USDC gates: no trustline → add trustline; unfunded account (web gap) | have (Buy XLM instead / Savings setup) | — |
| "$5 XLM" activation shortcut | partial (Buy screen with XLM preselected) | — |
| MoneyGram deposit (SEP-10/24, limits from `mgi/info`, status poll, banner) | have (`app/deposit-cash.tsx`, `lib/ramp/moneygram.ts`; commit learned by polling the proxy while MoneyGram’s page is open — the app has no postMessage; pending rows in Activity + tx detail with Refresh / Open MoneyGram) | — |
| Stripe link | have (Buy → “Pay with Stripe”, static link) | — |

### Sell (Coinbase off-ramp) — **missing entirely → first build**
Contract (inventory 3/5): session → `pay.coinbase.com/v3/sell/input` (partnerUserRef = uid, presetCryptoAmount 6dp, defaultNetwork/Asset, redirectUrl) → return → find the STARTED order (`coinbase/offramp-status`, fills) → claim fill → send Coinbase's amount to Coinbase's address (memo rules) → record fill with hash → poll to SUCCESS. Fix web's three defects: never re-send when a fill hash exists; timeout = "still processing", not success; prefer orders created after the hand-off. MoneyGram cash-out: parked (web incomplete).

### USDC on Stellar
| Rule | Mobile | Action |
|---|---|---|
| Reserve math (0.5 base, (2+subentries)×0.5, fee 0.0002, activation 1 XLM) | have | — |
| Nobody sponsors accounts; "Buy XLM via Coinbase" to activate | have | — |
| changeTrust (default limit), inactive → "fund with 1 XLM first" | have (`addUsdcTrustline`) | verify fee = fee-stats p90 |
| Readiness states; a failed lookup never shown as "not activated" | have | — |
| Receive warning + add trustline; unactivated copy | have (mobile gates harder: hides address until trustline) | — |
| Buy / Swap / Savings gates | have | — |
| No "no trustline" indicator in portfolio (web gap) | same | optional: "Add trustline" chip on the USDC asset row |

## 4. Auth · Onboarding · Home · Assets · Receive · Activity · Settings · Referrals · Compliance (inventory 5/5)

### Auth
| Web | Mobile | Action |
|---|---|---|
| Password sign-in / sign-up / verify code / email code / Google / forgot password | have (+ Apple, + six-cell code input; web's verify screen has no code input — not copied) | — |
| ToS checkbox required before any method | have (Create account) | — |
| Marketing opt-in (`marketing/opt-in`) | have (Create account + Settings switch) | — |
| Captcha on password sign-in/up, OTP send, reset | have | — |
| Session-expired banner with "Sign in" | have (`SessionExpiredBanner`) | — |
| Sign-out confirm mentioning the recovery phrase | have | — |

### Onboarding
| Web | Mobile | Action |
|---|---|---|
| Get-started asset-first, lazy chain setup, link-limit pre-check, provisioning ladder | have | — |
| Backup gate mandatory | by design optional (Niko) | — |
| Import an existing wallet (24-word, INIT_IMPORT_WALLET / IMPORT_WALLET) | have (`app/import-wallet.tsx`, `lib/turnkey/import.ts`; 12/24 words, local Stellar-address preview, offered only while the account has no wallet) | — |
| Connect external wallets (Freighter, Lobstr, Ledger, WalletConnect) | by design (web only) | — |

### Portfolio / Home
| Web | Mobile | Action |
|---|---|---|
| Total incl. savings, 24h weighted change, rows sorted, zeros hidden, savings row | have | — |
| Tabs All / Crypto / DeFi | have (Home token pills) | — |
| Actions Buy / Sell / Swap / Send / Receive | have | — |
| Cadence: 30 s poll on web | by design (no polling; focus + actions — agreed with web) | — |
| Outage copy "Couldn't load your balances — nothing is lost." + Retry | have | — |

### Assets
| Web | Mobile | Action |
|---|---|---|
| List + detail with actions per asset (Sell, Save for USDC) | have (Sell; Save on USDC → Savings) | — |
| Chart ranges 1D 1W 1M 1Y 5Y **All** | have | — |
| Token info (address, network, decimals) | have (About card: network, USDC issuer, decimals) | — |

### Receive
| Web | Mobile | Action |
|---|---|---|
| Per-chain warnings, QR, copy, explorer | have | — |
| BTC incoming-payment watcher (mempool WS + poll) | have (`use-btc-address-watch`, Receive sheet on Bitcoin) | — |

### Activity
| Web | Mobile | Action |
|---|---|---|
| Sources: wallet/activity, cctp, ramps, four chain feeds, LI.FI statuses | have (+ MoneyGram rows, off-ramp relabel) | — |
| Tabs All / Swaps / Savings / Transfers | have (Home Activity filter pills) | — |
| Dedupe: swap/CCTP leg hashes; Receive dropped as CCTP delivery (same asset, ±2 %, −5…+60 min) | have | — |
| Row tap → swap detail (four legs, Finish) / MoneyGram detail / explorer | have (`app/tx.tsx`) | — |
| Badges Pending / Failed / Refunded | have | — |

### Settings
| Web | Mobile | Action |
|---|---|---|
| General: profile (name, email, created, provider), Product updates switch | have | — |
| Accounts: addresses with copy, export phrase, trustline, autopilot | have (addresses card with copy, recovery phrase, import, autopilot; trustline via Receive USDC / Savings) | — |
| Security: reset link | have (sign-in) | add row |
| Mobile extras: set up device, test signing, notifications, appearance | mobile only | — |

### Referrals
| Web | Mobile | Action |
|---|---|---|
| Capture ?ref/?referral/?referrer (30 d), apply after first Stellar address (user → codes → activate), silent | have (`lib/referral.ts`, applied from `WalletEvents`) | — |

### Notifications / compliance
| Web | Mobile | Action |
|---|---|---|
| Toasts | have | — |
| Legal pages ToS / PP / Disclaimer | have (Settings; sign-in footer links) | — |
| Support: /contact + Discord/Telegram | have (Settings “Help & support” → /contact) | — |
| Geo-block, migration modal, Crisp, maintenance UI | parked/dead on web | skip |

## Build order (confirmed against the inventory)
1. **Sell** via Coinbase off-ramp (new screen + return handling + fills + Activity relabel).
2. **Transaction detail**: Activity row tap → detail (swap legs with Finish, send/receive with explorer), BTC confirmation tracker.
3. **Settings** General (profile, product updates) + Accounts (addresses) + legal/support rows; session-expired banner; sign-out confirm; ToS + marketing on Create account.
4. **Referrals** capture + apply.
5. **Savings**: earnings chart, history list, onramp card, hero stats, trustline-error alert.
6. **Activity** filters + CCTP-delivery dedupe; Send pending expiry per chain; outflow registry for MAX; Asset chart "All" + token info; Save action.
7. **MoneyGram** deposit (SEP-10/24).
8. **Import wallet** by recovery phrase.
9. Nice-to-haves: BTC receive watcher, Home tabs, Stripe link.

# Normal Mobile — CLAUDE.md

Context for Claude Code working in `normalfinance/mobile`.
Last verified 2026-09-10 against `develop@3bc0217` plus the local deletions in §7, and the
web repo at `../normal-v1-interface` (`master@6a403a8d`). Written by Niko's mobile session
from Niko's hand-off doc and `docs/web-agent-answers.md` (fifty code-verified answers from
the web repo's agent). Answer numbers below (`Q7`, `Q33`, …) point into that file.

---

## 0. Read this first

**This repo is being pivoted.** It began as a Stellar-only prototype with a BIP-39 seed-phrase
wallet, its own AMM contracts and a separate backend. The target is the full Normal client:
four chains, Turnkey passkey sub-orgs, backed by the existing Next.js API. §1–§6 describe the
**target**; §7 describes **what is on disk**. Never assume target code exists — check the tree.

**Discontinued products — code touching these is dead, not a foundation** (Niko, 2026-09-10):
Normal no longer runs **liquidity pools**, **synthetic assets** (nBTC/nETH/nSOL, Q16) or
**indexes**, and **testnet is gone** everywhere. Do not extend or port any of it.

**The web app source is at `../normal-v1-interface`. Read it before asking.** Paths written as
`web:src/...` mean `../normal-v1-interface/packages/web/src/...`; `web:../utils/...` means the
sibling package. Open questions and their answers live in `docs/web-agent-questions.md` and
`docs/web-agent-answers.md`; check the answers before inferring web behaviour, and ask Niko
rather than guess when something is unanswered. The web repo keeps its own copy at
`docs/mobile/web-agent-answers.md` (with a corrected Q30) and `docs/mobile/MOBILE_APP_CONTEXT.md`;
when they disagree with the live site, trust the live site. The web repo's Claude session can be
reached by cross-session message as `normal-v1-interface-58` for anything that must change on the
backend — never ask it to commit.

Niko is the sole mobile developer and the decision maker. Justin (CEO) grants account access.

---

## 1. What Normal is

A consumer savings + wallet app. Users sign up with email (Supabase Auth), get a self-custodial
Turnkey wallet secured by a passkey, and can:

- **Save**: deposit USDC into Normal Savings (DeFindex vault over Blend lending pools on
  Stellar, ~7% APY). The core product and the brand.
- **Hold** BTC, ETH, SOL, XLM, USDC across four chains (Bitcoin, Ethereum, Solana, Stellar).
- **Swap**: Stellar-native via Soroswap; BTC/ETH/SOL cross-chain via LI.FI; Stellar↔BTC/ETH/SOL
  via a composite Soroswap → Circle CCTP → LI.FI route (our own state machine).
- **Send / receive** on all four chains.
- **On/off-ramp**: MoneyGram (SEP-10/SEP-24), Coinbase. Onramper is dead (Q43).
- **Referrals**, activity feed, portfolio.

Web: Next.js App Router on Vercel, MUI + Emotion, zustand, Prisma/Postgres, Supabase Auth.
**PostHog is not wired** — dead env vars only (Q45). Yarn monorepo: `packages/web` (the app),
`packages/state|utils|types|contracts|goldsky`.

## 2. What we are building

A **React Native app on Expo (EAS)** for iOS and Android, **mainnet-only**, as a second client of
the **existing Next.js API**. No new backend, no change of identity provider.

v1 scope: sign up / sign in, passkey wallet, portfolio, savings deposit/withdraw, swap
(Soroswap, LI.FI, CCTP composite), send/receive, activity, MoneyGram ramp, referrals.

### Decisions already made — do not re-open without asking Niko

| Decision | Status / why |
|---|---|
| **Auth = Supabase, not Clerk** | ✅ Done in this repo (PR #32). Every API route verifies a Supabase JWT; every DB row is keyed by the Supabase uid. |
| **Backend = the existing Next.js API routes** | 73 routes, 58 behind `withAuth`; auth is the `Authorization: Bearer` header only, no cookie session anywhere (Q7). |
| **Turnkey passkeys, rpId `normalfinance.io`** | Wallets are passkey-only. Mobile stack: `@turnkey/http` + `@turnkey/crypto` + `@turnkey/react-native-passkey-stamper` + `react-native-passkey`. **Not** `@turnkey/react-native-wallet-kit` (hosted auth-proxy model; our server creates sub-orgs itself). ❌ Not started here. |
| **Mainnet only, testnet discontinued** | No network switch in the app. Still send `Cookie: normal-network=mainnet` on every request and `?network=mainnet` on the five routes that honour it (Q1) so we never depend on a deployment default. |
| **API backward compatibility from launch** | Installed apps cannot be force-updated. No breaking API change without versioning once shipped. |
| **Bundle identifiers** | iOS `io.normalfinance.app` (prod) / `io.normalfinance.app.dev` (dev+staging); Android package `io.normalfinance.app`. Apple Team `FA938A596N` (Normal Finance, Inc.) — **Niko is Admin, and the team shows in Xcode → Settings → Accounts** (confirmed 2026-09-11). Live in the AASA already. `app.json` still says `io.normalfinance.normalfi` — must change (§11). |

## 3. Talking to the backend

**Base URL** = `EXPO_PUBLIC_API_BASE_URL` (var name chosen; code does not read it yet):
`https://staging.normalfinance.io` (Vercel, `develop`) during development,
`https://www.normalfinance.io` (`master`) in production builds. Localhost web runs on `:8082`
with rpId `localhost` — **never point the app at it**; passkeys made there are unusable.
The bare `normalfinance.io` redirects to www for everything except `/.well-known/*`.

**Staging is mainnet with real money** and shares the production Supabase project (Q4). There
are no mocks or dry-run flags anywhere. Test with $10–$50 and never with a wallet that matters.

**Every request:** `Authorization: Bearer <supabase access_token>`, `Content-Type: application/json`,
`Cookie: normal-network=mainnet`. **Never send `x-mobile-app: true`** — it is an unconditional
bypass of the web middleware (`web:src/middleware.ts:203`) including the parked geo-blocking; the
app must not pre-exempt itself from a future compliance control.
`?network=mainnet` additionally on `savings/vault-info`, `savings/user-position`,
`savings/earnings-history`, `wallet/portfolio` (and the dead `portfolio/activity`).

**Status handling** (Q8) — port `web:src/utils/authed-fetch.ts` (42 lines) as an event emitter:
- **401** → `refreshSession()` once, retry once; still 401 → emit `session-expired` (debounce 5s)
  and show a banner with a sign-in button. Never throw, never redirect.
- **403** = not your wallet/resource. Never retry.
- **409** = three families: `{ embedded_unavailable: true }` from `swap/*` → use the two-signature
  path; CCTP autopilot refusal with `reason` → interactive fallback; in-flight duplicate → wait.
- **429** = our limiter, DeFindex busy (`savings/deposit`, retry after a pause), or wallet-link
  quota `{ error, reset }`. **503** = maintenance / disabled endpoint. 423 does not exist.

**Error shape is inconsistent** (Q13): 32 routes return `{ success:false, error }`, the CCTP /
Coinbase / MGI cluster returns bare `{ error, ...extra }` with machine codes such as
`below_minimum` + `minAmountWire`. **`error` is the only reliable key.** Never rely on `success`.

**Public routes** (no auth, IP-limited): `activity/{bitcoin,ethereum,solana,stellar}`,
`prices/history`, `mgi/info`, `savings/vault-info`, `savings/user-position`,
`savings/earnings-history`, `lifi/quote`, `swap/quote`.

**Rate limits** (Q11): user limiter 30/10s; IP limiter 50/10s; **`swap/quote` and `lifi/quote`
are 30 per 10s per IP** — mobile users behind carrier NAT share an IP, so quote-heavy screens
must debounce hard. Raise this with the web side before the swap screen ships.

**Routes are pure JSON** (Q14): no redirects, no `Set-Cookie`, no HTML, no streaming.
**There is no pagination anywhere** (Q21); infinite scroll needs a new endpoint.

**Copy these web files verbatim — do not redefine them** (Q12, Q22, Q39):
`web:src/types/portfolio.ts`, `web:src/types/wallet-activity.ts`, `web:src/lib/chains/registry.ts`
(the CHAINS registry — every chain-varying value lives here), `web:src/sections/swap/cctp-phase.ts`
(the "needs a signature" table), `web:src/components/_common/send-adapters/*`,
`web:src/utils/normal-fees.ts`. They import nothing from Next or the DOM.

### Route inventory (under `/api/`)

- **Wallet / Turnkey**: `turnkey/wallet` (POST create sub-org+wallet, idempotent; GET read),
  `turnkey/wallets`, `turnkey/credentials`, `turnkey/import`, `turnkey/import-init`,
  `turnkey/btc-pubkey`, `turnkey/build-btc-tx`, `turnkey/broadcast-btc`,
  `wallets/check-limit` (= 3 external links / 24h), `wallets/link`, `wallets/linked`.
- **Portfolio / activity**: `wallet/portfolio`, `wallet/activity`, `activity/{chain}`,
  `prices/history`. `portfolio/activity` is **dead** (zero callers).
- **Savings**: `savings/vault-info`, `savings/user-position`, `savings/deposit`,
  `savings/withdraw`, `savings/earnings-history`. `savings/log-transaction` is **deprecated**.
- **Fees**: `fees/build-payment`, `fees/execute-pair` (the server-side submit funnel).
- **Swap**: `swap/quote`, `swap/submit-single`, `swap/log-transaction`; `lifi/quote`,
  `lifi/status`, `lifi/statuses`, `lifi/record`; `cctp/quote`, `cctp/transfers` (+`/[id]`),
  `cctp/gas-topup`, `cctp/autopilot/{burn,pivot}`, `autopilot/status`.
- **Send**: `send/execute` (native ETH/SOL only), `stellar/memo-required`. `send` is **dead**.
- **Ramps**: `mgi/*`, `ramp/transfers`, `coinbase/session`, `coinbase/offramp-status`, `offramp/fills`.
- **Other**: `referral/*`, `marketing/opt-in`, `crisp`, `transaction`. `cron/*` is server-only.

## 4. Auth (Supabase)

- Web uses (Q5): `signUp`, `signInWithPassword`, `signInWithOtp` (OTP + magic link,
  `shouldCreateUser: true`), `verifyOtp` type `email`, `resend`, `resetPasswordForEmail`,
  `signInWithOAuth` **Google only**, PKCE with `detectSessionInUrl: false`. No Apple. **App Store
  review requires Sign in with Apple if Google is offered** — dashboard config + a provider row.
- **Redirect allowlist is dashboard config** (Q6). `normalapp://auth/callback` must be added
  under Supabase Auth → URL Configuration before OAuth or magic links can return to the app.
- **Captcha** (Q9): web sends a Turnstile token as `captchaToken`; **Supabase verifies it, not
  our API**. If captcha protection is enabled on the project, every auth call from this app fails
  because `services/auth.service.ts` sends no token. Check the dashboard; either disable captcha
  for mobile or render Turnstile in a WebView.
- `withAuth` checks nothing but the Bearer token (Q7). No CSRF, no Origin, no user status.
- Mobile env names: `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY` = the web's
  `NEXT_PUBLIC_MAINNET_SUPABASE_URL` / `_ANON_KEY` values (code names, Q2 — the web
  `.env.example` misnames them). One mainnet project serves staging and production.

## 5. Wallet model (Turnkey) — the part that must be exactly right

- One Turnkey **sub-organization per user**, row in Postgres `turnkey_wallets` (`supabaseUid`
  unique → `subOrgId` unique, plus nullable `bitcoinAddress`, `ethereumAddress`,
  `solanaAddress`, `stellarAddress`).
- **Passkey-only.** The passkey is the root authenticator (quorum 1). No password, no OTP signer.
- **rpId `normalfinance.io`** on staging and prod (`NEXT_PUBLIC_TURNKEY_RP_ID`; mobile
  `EXPO_PUBLIC_TURNKEY_RP_ID`). Byte-identical at registration and signing. Read with `||` not
  `??` (blank env must fall back, Q50-12). Always pass `allowCredentials` from
  `turnkey/credentials` so the OS prompt shows only this account's passkeys.
- **Signing is client-side, straight to `https://api.turnkey.com`** (hardcoded, not env; Q26).
  No Next route proxies signing. Activities: Stellar `SIGN_RAW_PAYLOAD_V2` over hex `tx.hash()`
  with `HASH_FUNCTION_NOT_APPLICABLE`, then a `DecoratedSignature` appended (port
  `web:src/lib/turnkey/stellar-signer.ts`, 60 lines; always pass the passphrase explicitly;
  Soroban auth entries are **not** handled). EVM `SIGN_TRANSACTION_V2`. Solana raw payload over
  `serializeMessage()` with no pre-hash. BTC send = server-built PSBT + `TRANSACTION_TYPE_BITCOIN`;
  BTC LI.FI = local sighashes + one `SIGN_RAW_PAYLOADS` with `HASH_FUNCTION_NO_OP`.
- **A passkey prompt on every signing request; no session** (Q27). CCTP swaps cost 1–4 prompts
  (table in Q27). Autopilot is a one-time ceremony (`CREATE_API_ONLY_USERS` + `CREATE_POLICY_V3`,
  Base-chain legs only; needs `EXPO_PUBLIC_AUTOPILOT_PUBLIC_KEY`, absent = feature dark, Q40).
- **Sign-up order** (Q25): Supabase account → RN `createPasskey()` (returns
  `{ challenge, attestation: { credentialId, clientDataJson, attestationObject, transports } }`)
  → `POST /api/turnkey/wallet { challenge, attestation, chain: 'stellar' }` → 201
  `{ wallet }` (idempotent: 200 if a row exists). Park a failed attestation and reuse it so a
  retry never mints a second passkey. Mark the new seed for backup and await the mark.
- **Lazy asset creation (HARD RULE)**: one chain address at signup, others on first use. Web:
  `ensureChainAccount` (Q29) — passkey-stamped `CREATE_WALLET_ACCOUNTS`, then
  `POST /api/turnkey/import { walletId, chain }` so the **server** re-reads addresses. Idempotent.
- **Export** (Q32) reveals one BIP-39 phrase via `EXPORT_WALLET`; web decrypts in Turnkey's
  iframe, mobile must use `@turnkey/crypto` with a local ephemeral key. **Import** (Q31) is a
  mnemonic via `import-init` → `INIT_IMPORT_WALLET` → HPKE bundle → `IMPORT_WALLET` → `import`.
- **There is NO recovery if the passkey is lost** (Q33). One authenticator, no add-authenticator
  flow on either side. **Consequence: an existing web user can sign in on mobile only if their
  passkey is synced (iCloud Keychain / Google Password Manager).** Chrome-on-Windows users have
  no path in. Fixing it means `CREATE_AUTHENTICATORS_V2` on web too — a product decision (§11).
- **Personal-team builds cannot do passkeys**: WebAuthn under `normalfinance.io` needs the
  associated-domains entitlement, which needs Team `FA938A596N`. That team is available in Xcode;
  for Phase 2 switch the target to Team = Normal Finance, Inc., bundle id `io.normalfinance.app.dev`
  (Debug) / `io.normalfinance.app` (Release), add the Associated Domains capability
  `webcredentials:normalfinance.io?mode=developer` (Developer Mode on the phone makes the
  `?mode=developer` suffix bypass Apple's CDN cache), and let Xcode create the profile.

## 6. Money flows (port the logic, rebuild the UI)

- **Portfolio** (Q18): `GET wallet/portfolio` returns balances **and** USD values for all five
  assets (BTC, ETH, SOL, XLM, USDC, fixed order) in one call; server cache 15s; `?refresh=1`
  floored to one per 5s. Chains without an address come back `balance:"0", status:"ok"`.
  **No current-prices endpoint exists** (Q19); `GET prices/history?symbol=&range=` (public) is the
  only price route — take the last point for an unheld asset. Icons: `${EXPO_PUBLIC_CDN_URL}/tokens/{bitcoin,ethereum,solana,XLM,USDC}.webp`.
- **Activity** (Q21): web merges eight sources client-side (`wallet/activity`, four chain
  routes, `cctp/transfers?history=1`, `ramp/transfers?active=1` + MGI, `coinbase/offramp-status`,
  `POST lifi/statuses`). No pagination.
- **New Stellar accounts: nobody sponsors them** (Q36). The user funds their own address with
  XLM (default 4, min 2) then signs a `changeTrust` for USDC. Gate every USDC action behind
  "fund first, then trustline", exactly like web. **A first savings deposit therefore has three
  prerequisites — funded account, USDC trustline, a USDC balance — so Receive or a ramp precedes
  it in the real journey.** For development, fund the test account from the web app.
- **Savings** (Q34/35): `POST savings/deposit { amount: net, caller }` → unsigned XDR; `POST
  fees/build-payment` → fee XDR at sequence+1; client signs **both** (two prompts); `POST
  fees/execute-pair` submits server-side. Fees: 50 bps deposit, 50 bps swap, yield commission
  tiers ≥50k → 5%, ≥2.5k → 10%, ≥500 → 15%, else 20% (`web:src/utils/normal-fees.ts`).
- **Soroswap** (Q37): `POST swap/quote` with `sender` returns an unsigned XDR. Embedded fee =
  1 signature; `embedded_unavailable` 409 → fee-pair path = 2 signatures. `POST
  swap/submit-single { signedXdr, record }` submits server-side.
- **LI.FI** (Q38): quote via `POST lifi/quote`; execution runs **on the client** against
  `EXPO_PUBLIC_ETH_RPC_URL` / `_SOLANA_RPC_URL` / `_BASE_RPC_URL` (shippable — already public on
  web); BTC broadcasts through `turnkey/broadcast-btc`. `POST lifi/record` is the swap's only
  activity row — skip it and the feed shows nothing.
- **CCTP** (Q39): the client drives every signature-bearing leg; the cron owns the bridge middle
  and abandoned rows; `GET cctp/transfers/[id]` advances the machine unless `?noAdvance=1`.
  Poll 5–15s while bridging, 10s for arrival/pivot, 30s for the recovery banner. Min $10.
  Recovery surface = `cctp-phase.ts` verbatim; resume = `gas-topup` then burn or pivot.
- **Send** (Q41): ETH/SOL through `POST send/execute` (server decodes and cross-checks the
  signed tx; 409 while a prior send is unsettled). Stellar is client-side to Horizon; BTC via
  `build-btc-tx` + `broadcast-btc`. Check `stellar/memo-required` before enabling Send.
- **MoneyGram** (Q42): web relies on `postMessage`, which mobile cannot; use an in-app browser
  and poll `mgi/transactions/[id]` (SEP-10 token in header `x-mgi-token`). Never open the
  browser and a passkey prompt in the same tick.
- **Coinbase** (Q43): `POST coinbase/session` → token; build the URL client-side with a
  `redirectUrl` that must be on Coinbase's CDP allowlist (add the native scheme). Single-use URL.
- **Referrals** (Q44): capture `ref`/`referral`/`referrer` from the deep link; apply **after
  wallet creation** via `referral/user` → `referral/codes` → `referral/activate`.
- **Analytics**: none exists on web. Design the event taxonomy fresh (Q45).

---

## 7. What is actually in this repo today

Verified at `develop@3bc0217` plus the deletions below. Treat as the starting point, not the target.

| Area | Target | On disk |
|---|---|---|
| Auth | Supabase | ✅ `lib/supabase.ts` (AsyncStorage adapter, `detectSessionInUrl:false`), `providers/supabase-auth-provider.tsx`, `services/auth.service.ts` (OTP, magic link, Google + Apple OAuth via `expo-auth-session`), `app/auth/callback.tsx`. **Sends no `captchaToken`.** |
| Wallet | Turnkey sub-org, passkey-only | ⚠️ **Gate done, creation not.** `hooks/use-turnkey-wallet.ts` asks `GET /api/turnkey/wallet`; `app/(tabs)/_layout.tsx` routes `wallet === null` → `app/create-wallet.tsx` (placeholder until the passkey ceremony lands). The BIP-39 files (`lib/utils/mnemonic.utils.ts`, `crypto.utils.ts`, `services/wallet.service.ts`, `app/wallet-setup.tsx`) are still on disk but **nothing routes to them** — delete in a later commit. |
| Chains | BTC, ETH, SOL, XLM | ❌ Stellar only. No registry. |
| Swap | Soroswap / LI.FI / CCTP | ☠️ deleted (was `normal_pool_router` AMM). UI shells in `components/swap/*` kept, unreferenced. |
| Backend | Next.js API, Bearer | ✅ `lib/api.ts` — `apiFetch()`: Bearer, `Cookie: normal-network=mainnet`, 401 → refresh once → retry once → `onSessionExpired`; `ApiError` with `status` and the server's `error`. Reads `EXPO_PUBLIC_API_BASE_URL`. `hooks/use-transaction.ts` still posts to a hardcoded `http://localhost:8095` — dead, replace with `fees/execute-pair` / `swap/submit-single`. |
| Prices | backend `wallet/portfolio` + `prices/history` | ✅ Done. `hooks/use-backend-portfolio.ts` (portfolio + 24h change from `wallet/portfolio`, `usePriceHistory` from `prices/history`, Stellar txs from Horizon keyed by the Turnkey address). `lib/types/portfolio.types.ts` is a verbatim copy of web `src/types/portfolio.ts`. **CoinMarketCap and the Reflector oracle are deleted**; `EXPO_PUBLIC_CMC_API_KEY` is no longer read. |
| Indexes / Invest | not a product | ☠️ deleted. |
| Savings | DeFindex vault | ⚠️ `app/(tabs)/savings.tsx` shows live vault facts (`hooks/use-savings.ts` → public `savings/vault-info`: APY, asset); position + deposit/withdraw wait for the Turnkey wallet. |
| Onboarding | — | ☠️ Removed (Niko, 2026-09-11): no pre-login carousel; unauthenticated users land on sign-in. Bring back later with new art if wanted. |

**Deleted 2026-09-11 (design pass)**: `app/onboarding.tsx` + `assets/images/splash-screens/`, `app/font-test.tsx`,
`app/modal.tsx`, `app/(tabs)/{prices,wallet-settings,assets}.tsx`, `components/icons/navbar/`, `components/swap/`,
`components/portfolio/TransactionHistory.tsx`, all `components/ui/skeleton/*-skeletons.tsx`, `components/sign-out.tsx`,
`services/{coinmarketcap,oracle,prices,balance}.service.ts`, `hooks/{use-portfolio,use-asset-detail,use-token-price}.ts`,
`lib/utils/{oracle,format,http,mocks}.utils.ts`, `lib/types/{oracle,tokenprice.hook}.types.ts`, `lib/contracts/oracle/`,
`lib/constants/api.constants.ts`, `constants/assetClassStyles.ts`, Barlow + unused Satoshi cuts, template images.
`services/portfolio.service.ts` is now types-only.

**Deleted 2026-09-10** (~7,200 lines, all confirmed dead): `lib/contracts/pool_router/`,
`lib/utils/pool-router.utils.ts`, `services/swap.service.ts`, `hooks/use-swap.ts`,
`app/(tabs)/{indexes,invest}.tsx`, `app/indexes/`, `services/indexes.service.ts`,
`services/api.service.ts`, `lib/constants/tokens.constants.ts` (n-tokens; had zero importers).

**Do NOT delete — adjacent but live:** `lib/utils/trustline.utils.ts` + `hooks/use-trustline.ts`
(trustlines are required to hold USDC); the Reflector oracle files (generic price feed —
re-source, don't delete); `components/swap/*` (presentational, reusable for Soroswap).

**Still to remove**: the `|| "TESTNET"` fallbacks in `hooks/use-transaction.ts`,
`lib/constants/stellar.constants.ts`, `lib/utils/transactions.utils.ts`,
`lib/utils/trustline.utils.ts`; `lib/constants/api.constants.ts` if nothing else reads it;
`@stellar/typescript-wallet-sdk-km` from `package.json` (unused; its Trezor peer deps are what
rewrite the lockfile on every `npm install`).

### Design system (2026-09-11)

**The spec is the web ACCOUNT DRAWER, not the MUI theme** — see `docs/web-agent-answers.md`
"Design system (D1–D12)". Encoded once in `lib/theme/tokens.ts` (ink `#0A0A0F`, muted `#6B6B76`,
border `rgba(10,10,15,0.08)`, press tint `rgba(10,10,15,0.03)`, positive `#1AB37D`, chips, radii
16/12/8/22, spacing) and `tamagui.config.ts` (fonts, tokens, light theme). Rules: text and solid
buttons are ink; every number/amount/address is **Geist Mono** (`fontFamily='$mono'` or `$numeric`)
with -0.01em tracking; UI text is **Satoshi** 400/500/600(→Bold)/700; white cards with a 1px
border and **no shadow**; one press state everywhere (the tint); positives green, negatives ink;
**light and dark** (`lib/theme/appearance.tsx`: Light / Dark / System chosen in Settings, persisted in AsyncStorage; `useColors()` returns `ink` or the derived `inkDark`; the root layout switches the Tamagui `Theme`, React Navigation colours and the status bar). Fonts on disk: `assets/fonts/satoshi/{Regular,Medium,Bold}.otf`,
`assets/fonts/geist-mono/{Regular,Medium,Bold}.ttf` (OFL). Barlow and Satoshi Light/Black removed.
Building blocks: `components/home/primitives.tsx` (Card, Divider, Pressable, Mono, UiText, IconBox,
Chip, PrimaryButton, PillButton, EmptyState, Skeleton), `BalanceCard`, `AssetRow`, `ActivityRow`,
`HomeTabs`, `ReceiveSheet`. Number formatting: `lib/utils/number-format.utils.ts` (port of web
`format-number.ts`; display decimals BTC 8 / ETH 6 / SOL 4 / XLM 4 / USDC 2). Icons: lucide, 16–20px,
stroke 1.8–2. Token icons and logo from the CDN via `lib/utils/cdn.utils.ts`.
Every routed screen uses these primitives: Home (the drawer's content), Savings, Swap (shell), Activity,
Settings (appearance, account, sign out), `asset/[symbol]` (ink line chart from `prices/history`),
sign-in + OTP components, auth callback, create-wallet. App icon / splash / adaptive icon are
derived from `logo/logo-single.svg` (`assets/images/*`; monochrome Android icon still the old one).
**Icon changes need a native rebuild to show on the phone.**

### Stack as configured

Expo SDK 54, React Native 0.81.4, React 19.1.0, New Architecture on, React Compiler experiment
on. `expo-router` with typed routes (`app/`, tabs under `app/(tabs)/` = **Home / Savings / Swap / Activity / Settings**, custom bar in `_layout.tsx`).
Tamagui UI. TanStack Query for server state. Aliases `@/*` → root, `@svgs/*` → `assets/svgs/*`.
`expo-dev-client` is **not** installed. No `ios/`/`android/` committed (CNG; both gitignored).

### Environment variables the code reads today

| Variable | Behaviour if missing |
|---|---|
| `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY` | throws at startup (`lib/supabase.ts`) |
| `EXPO_PUBLIC_NETWORK` | **must be `MAINNET`**; several files still default to `TESTNET` |
| `EXPO_PUBLIC_RPC_API_KEY` | optional; switches Stellar RPC to validationcloud |
| `EXPO_PUBLIC_MAINNET_{HORIZON_URL,RPC_URL}` | fall back to public SDF endpoints |

### Target `EXPO_PUBLIC_*` set (Q3 — everything web already ships in its public bundle)

`EXPO_PUBLIC_API_BASE_URL`, `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`,
`EXPO_PUBLIC_TURNKEY_RP_ID=normalfinance.io`, `EXPO_PUBLIC_ETH_RPC_URL`,
`EXPO_PUBLIC_SOLANA_RPC_URL`, `EXPO_PUBLIC_BASE_RPC_URL`, `EXPO_PUBLIC_CDN_URL`,
`EXPO_PUBLIC_AUTOPILOT_PUBLIC_KEY` (optional), and the web's `NEXT_PUBLIC_MAINNET_*` Stellar
constants (Horizon, Soroban RPC, USDC issuer/address, XLM address, DeFindex vault, oracles).
**Never ship** `TURNKEY_*`, `LIFI_API_KEY`, `SOROSWAP_*`, `DEFINDEX_API_KEY`, `COINGECKO_API_KEY`,
`DATABASE_*` or any of the 58 server-only vars. Every `EXPO_PUBLIC_*` is extractable from an IPA.

## 8. Environments

| Env | API base | rpId | Whose passkeys work |
|---|---|---|---|
| localhost web | `http://localhost:8082` | `localhost` | browser only — **never the app** |
| staging (`develop`) | `https://staging.normalfinance.io` | `normalfinance.io` | any account from staging/prod web or the app, if the passkey is synced to the phone |
| production (`master`) | `https://www.normalfinance.io` | `normalfinance.io` | same |

One mainnet Supabase project across staging and production. Association files are live at
`https://normalfinance.io/.well-known/apple-app-site-association` (Team `FA938A596N`, both bundle
ids) and `assetlinks.json` (Android SHA-256 still the all-zero placeholder until
`eas credentials -p android` produces a keystore). Validator: `web:scripts/check-passkey-association.mjs --live`.

## 9. Local setup (verified working 2026-09-10 on Xcode 26.0.1)

- **Node 20.19.4 via nvm** (`package.json` `engines`; EAS production profile). Other majors
  rewrite `package-lock.json`. `nvm use 20.19.4` before any `npm`.
- **`export LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8`** in the shell — CocoaPods crashes with
  `Unicode Normalization not appropriate for ASCII-8BIT` without it.
- `brew install cocoapods watchman`. `npx expo prebuild --platform ios` then `cd ios && pod install`.
- **Expo Go does not work** (`react-native-randombytes` ships native code, `expo-updates` configured).
  Start JS with `npx expo start` (**not** `--dev-client`); build and install with Xcode or
  `npx expo run:ios`.
- **Keychain needs real signing.** An ad-hoc or unsigned build fails every SecureStore call
  (`A required entitlement isn't present`) — onboarding completion and wallet storage both die.
  Sign with a real team (personal Apple ID is enough for UI work).
- Personal-team device builds: set the bundle id in Xcode's Signing tab (not `app.json`) to
  something unowned, e.g. `io.normalfinance.normalfi.niko`; expires after 7 days; no passkeys.
- `expo prebuild` rewrites the `ios`/`android` npm scripts in `package.json` — revert that.
- Debug console noise that is **not** a bug: `@noble/hashes` "not listed in exports" warnings
  (from the seed-phrase code), `SafeAreaView` deprecation.

## 10. Hard rules

1. **Never `git commit` or `git push`.** Stage/merge is fine; hand Niko the message.
2. **Never write to `.env` or any secrets file.** Name the variables and exact lines.
3. **No guessing.** Verify in code — this repo or `../normal-v1-interface` — before asserting.
   Label shortcuts and trade-offs.
4. **Cause → effect** ("if you do X you will see Y"). Direct answer first. Decode big diffs into
   categories with counts. Give verifiable test steps.
5. **Scale-first**: thousands of users; rate limits, N+1, blast radius.
6. **Never `**` on a BigInt** — transpiles to `Math.pow`, crashes at runtime.
7. **Lazy asset creation** (§5) and **the chain registry** (§3) are absolute.
8. **LI.FI Bitcoin PSBTs: only ever add signatures.** Never reorder or add outputs — Chainflip
   cannot refund a malformed deposit; the loss is permanent.
9. Self-completing money state always has a UI surface owned by no modal; explicit user clicks
   bypass freshness heuristics; resume intent goes in route params, not events.
10. **CCTP custody**: `mintRecipient` and `destinationCaller` = the CctpForwarder, the real
    recipient only in `hookData`; take only what *this* transfer is owed on Base (a whole-balance
    burn stranded a sibling row on 2026-08-26). Verify the USDC trustline before burning.
11. **Fee pairs are sequence-chained** (fee = service + 1); retries reuse sequences, so a
    double charge is impossible — do not "fix" that.
12. **Memo-less Stellar sends to exchanges silently lose funds**; three layers of memo check.
13. **BTC MAX = UTXOs minus sweep fee**; BTC broadcast is idempotent by pre-computed txid.
14. **Never show "Done" against a stale balance** — refetch the destination chain first.
    "Arrived" means the chain says so, not the provider; abandon after 45 min.
15. **Check the wallet-link limit before the passkey ceremony**; the ceremony is irreversible.
16. **Bound every shared in-flight promise** (10s).
17. Coinbase offramp amounts must be crypto-denominated (Coinbase sometimes returns EUR).

## 11. Open items and decisions for Niko (2026-09-10)

- **Change `app.json` `ios.bundleIdentifier` to `io.normalfinance.app`** (+ an `.app.dev` variant
  for dev builds) and add `android.package: io.normalfinance.app`. Both must match the live
  association files. The `FA938A596N` team is available in Xcode; do this at the start of Phase 2.
- **Existing-user sign-in** (Q33): decide whether v1 ships without it (synced-passkey users
  only) or whether web builds `CREATE_AUTHENTICATORS_V2` first.
- **Captcha**: confirm whether Supabase captcha protection is on; if so, choose WebView Turnstile
  or a mobile exemption.
- **Supabase dashboard**: add **`normalapp://wallet-setup`** (the exact `redirectTo` the app sends,
  `services/auth.service.ts:107`) to Authentication → URL Configuration → Redirect URLs — without
  it every OAuth attempt falls back to the web Site URL and dies with "Missing authorization
  code". Enable Apple as a provider (App Store guideline 4.8 when Google is offered).
- **Monorepo** (Q49): web recommends moving this repo to `packages/mobile` with a shared
  `packages/core`. Blocked on the web repo's own Node 20.14 / 22 + yarn 1 / 3 conflict.
- **Quote rate limit**: per-IP 30/10s on the two public quote routes will collide behind carrier
  NAT; ask for a per-user variant before the swap screen ships.
- **Onboarding copy and art** still sell synthetics and indexes (§7).
- Remove the testnet fallbacks, `api.constants.ts`, the CMC dependency and
  `@stellar/typescript-wallet-sdk-km` (§7).
- Decide the fate of `hooks/use-transaction.ts` / `services/transaction.service.ts` (dead
  `localhost:8095` submit path) — replace with `fees/execute-pair` / `swap/submit-single`.
- Android: generate the keystore (`eas credentials -p android`) and put its SHA-256 in `assetlinks.json`.
- Account access: Apple Developer team `FA938A596N` ✅ (Admin). Still pending: Expo org
  `normalfi` (possibly orphaned), Google Play. CoinMarketCap is moot once prices move to the backend.
- Branching: `develop` is the trunk (`origin/HEAD`); `master` is one stale commit — sync or delete.

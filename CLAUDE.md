# Normal Mobile — CLAUDE.md

Context for Claude Code working in `normalfinance/mobile`.
Last verified against the tree at commit `3bc0217` (`develop`) on 2026-09-10.

---

## 0. Read this first

This repo started as a **Stellar-only prototype** with its own wallet model. We are
**pivoting it** into the full Normal mobile client described below — multi-chain, Turnkey
passkey wallets, backed by the existing Next.js API. Both realities are documented here:
§1–§6 are the **target**, §7 is **what is actually on disk today**. When they disagree, the
target wins as direction, but never assume target code exists — verify in the tree first (§9
rule 3).

The reference implementation for nearly everything is the web repo
**`normalfinance/normal-v1-interface`** (`packages/web`). Port logic from there; do not
reinvent it.

---

## 1. What Normal is

Normal is a consumer savings + wallet app. Users sign up with email (Supabase Auth), get a
self-custodial Turnkey wallet secured by a passkey, and can:

- **Save**: deposit USDC into Normal Savings (DeFindex vault over Blend lending pools on
  Stellar, ~7% APY). This is the core product and the brand.
- **Hold** BTC, ETH, SOL, XLM, USDC across four chains (Bitcoin, Ethereum, Solana, Stellar).
- **Swap**: Stellar-native via Soroswap; BTC/ETH/SOL cross-chain via LI.FI; Stellar↔BTC/ETH/SOL
  via a composite Soroswap → Circle CCTP → LI.FI route (our own state machine).
- **Send / receive** on all four chains.
- **On/off-ramp**: MoneyGram (SEP-10/SEP-24), Coinbase offramp.
- **Referrals**, activity feed, portfolio.

Web app: Next.js (App Router) on Vercel, MUI + Emotion, zustand, Prisma/Postgres, Supabase
Auth, PostHog. Production `normalfinance.io`; staging on a `*.normalfinance.io` Vercel
preview. Yarn monorepo: `packages/web` (the app), `packages/state|utils|types|contracts|goldsky`.

## 2. What we are building here

A **React Native app on Expo (EAS)** for iOS and Android, **mainnet-only in v1**, that is a
second client of the **existing Next.js backend**. We do not build a new backend and we do
not change the identity provider.

v1 scope (web parity minus web-only bits): sign up / sign in, passkey wallet, portfolio,
savings deposit/withdraw, swap (Soroswap, LI.FI, CCTP composite), send/receive, activity,
MoneyGram ramp, referrals.

### Decisions already made — do not re-open without asking Niko

| Decision | Why |
|---|---|
| **Auth = Supabase, NOT Clerk** | Every API route verifies a Supabase JWT; every DB row is keyed by the Supabase user id. Clerk tokens would 401 everywhere. ✅ **Migration complete in this repo** (PR #32, commits `715aa8c`…`fe290fb`). |
| **Backend = the existing Next.js API routes** | 73 routes, 58 behind `withAuth`. Auth is `Authorization: Bearer <supabase access_token>` (header, not cookie), so native clients work today. |
| **Turnkey passkeys, rpId `normalfinance.io`** | Wallets are passkey-only. The same passkey must work on web and in the app, so the app is associated with `normalfinance.io` (AASA + assetlinks) and uses Turnkey's React Native SDK / native passkey stamper. ❌ **Not yet started here** — see §7. |
| **Mainnet only** | Testnet toggle, dev pages and `normal-network` cookie logic stay web-only. Send `?network=mainnet` (or the cookie header); the server falls back to its deployment default. |
| **API backward compatibility from app launch** | Installed apps cannot be force-updated. No breaking API changes without versioning once the app ships. |

## 3. Backend contract

Base URL = the web deployment (`https://normalfinance.io` prod, the staging URL for dev).
All JSON. Authed routes need `Authorization: Bearer <token>`; on 401, refresh the Supabase
session **once** and retry (web helper: `packages/web/src/utils/authed-fetch.ts`).

Routes under `/api/`:

- **Wallet / Turnkey**: `turnkey/wallet` (create sub-org + wallet at signup; also adds
  per-chain addresses lazily), `turnkey/wallets`, `turnkey/credentials` (passkey credential
  ids for `allowCredentials`), `turnkey/btc-pubkey`, `turnkey/build-btc-tx`,
  `turnkey/broadcast-btc`, `turnkey/import`, `turnkey/import-init`, `wallets/check-limit`,
  `wallets/link`, `wallets/linked`.
- **Portfolio / activity**: `wallet/portfolio`, `wallet/activity`, `portfolio/activity`,
  `activity/{bitcoin|ethereum|solana|stellar}`, `prices/history`.
- **Savings**: `savings/vault-info`, `savings/user-position`, `savings/deposit`,
  `savings/withdraw`, `savings/log-transaction`, `savings/earnings-history`.
- **Swap**: `swap/quote` (Soroswap), `swap/submit-single`, `swap/log-transaction`,
  `lifi/quote`, `lifi/status`, `lifi/statuses`, `lifi/record`, `cctp/quote`,
  `cctp/transfers` (POST create / GET list, `?history=1`), `cctp/transfers/[id]`
  (GET advances the state machine, `?noAdvance=1` for a fast read; PATCH attaches tx hashes),
  `cctp/gas-topup`, `cctp/autopilot/burn`, `cctp/autopilot/pivot`, `autopilot/status`.
- **Send**: `send`, `send/execute`, `stellar/memo-required`, `fees/build-payment`,
  `fees/execute-pair`.
- **Ramps**: `mgi/*` (SEP-10 challenge/complete, SEP-24 deposit/withdraw, transactions),
  `ramp/transfers`, `coinbase/session`, `coinbase/offramp-status`, `offramp/fills`.
- **Other**: `referral/*`, `marketing/opt-in`, `crisp`, `transaction`.
- Server-only, never called by a client: `cron/*`.

## 4. Wallet model (Turnkey) — the part that must be exactly right

- One Turnkey **sub-organization per user**, stored in Postgres `turnkey_wallets`
  (`supabaseUid` unique → `subOrgId` unique, plus nullable `bitcoinAddress`,
  `ethereumAddress`, `solanaAddress`, `stellarAddress`).
- **Passkey-only.** The passkey is the root authenticator of the sub-org. There is no
  password, no email-OTP signer and no recovery-passkey flow in code today.
- **rpId is `normalfinance.io`** on staging and prod (`NEXT_PUBLIC_TURNKEY_RP_ID`). Localhost
  web dev uses rpId `localhost`. A passkey only ever works under the rpId it was created with.
- **Signing is client-side.** Web stamps with `@turnkey/webauthn-stamper`; the app must use
  Turnkey's React Native SDK + native passkey stamper. The parent-org API key on the server
  can create sub-orgs and read metadata — it **cannot move funds**.
- **Passkey prompt restriction**: fetch credential ids from `turnkey/credentials` and pass
  them as `allowCredentials` so the OS prompt does not offer other accounts' passkeys
  (web: `lib/turnkey/passkey-stamper.ts`).
- **Lazy asset creation (HARD RULE)**: never create addresses for all chains at signup. A
  chain address is created on first use of that asset — Turnkey bills per address.
- **Autopilot** (optional, per user): a delegated "Normal Autopilot" API user + policy inside
  the user's sub-org lets the server sign the Base-chain legs of CCTP swaps. Server-side only;
  the app just calls `autopilot/status` and the consent ceremony route.
- Wallet **export** on web uses `@turnkey/iframe-stamper` (browser only). Use the Turnkey RN
  SDK export flow instead.

## 5. Feature engines to port (logic, not UI)

Source of truth in `packages/web/src/`:

- `sections/swap/engines/` — `use-soroswap-engine.tsx`, `use-lifi-engine.tsx`,
  `use-cctp-engine.tsx`, `types.ts` (`canPair`, routing groups), `gas-reserve.ts`,
  `autopilot-gate.ts`, `lifi-tracker.ts`.
- `lib/cctp/` — `burn-stellar.ts`, `burn-evm.ts`, `pivot-swap.ts`, `hookdata.ts`,
  `decimals.ts`, `addresses.ts`, `config.ts`.
- `lib/lifi/execute.ts` — executes a LI.FI quote per chain (BTC PSBT via Turnkey raw sighash
  signing; EVM via viem; Solana via web3.js).
- `lib/turnkey/` — `evm-signer.ts`, `stellar-signer.ts`, `passkey.ts`, `passkey-stamper.ts`,
  `add-account.ts`, `autopilot-consent.ts`.
- `lib/savings/`, `lib/send/`,
  `components/_common/send-adapters/{bitcoin,ethereum,solana,stellar}.ts`.
- `lib/chains/registry.ts` — **the CHAINS registry (HARD RULE: every chain-varying value
  lives here, never hard-coded)**.

Client crypto: `@stellar/stellar-sdk`, `viem`, `@solana/web3.js`, `bitcoinjs-lib` (v7, no Node
Buffer), `bignumber.js`. In RN these need polyfills (`react-native-get-random-values`, Buffer,
TextEncoder, URL) — this repo already has a `shim.js` doing some of that. Expect friction.

### CCTP composite flow

Outbound USDC(Stellar) → BTC/ETH/SOL: user signs approve + `deposit_for_burn` on Stellar →
Circle attests (~7s) → our relayer mints USDC to the user's own Base address → LI.FI swap
Base USDC → target (user signs, or Autopilot signs) → done. Inbound reverses it: LI.FI to USDC
on Base → user burns on Base → relayer mints on Stellar (delivers **USDC on Stellar**, never
XLM). Minimum $10. Progress must survive the app being killed: rows live in `cctp_transfers`,
the server cron finishes them, and the client shows a recovery surface for any row needing a
signature.

## 6. Not portable — plan replacements

- **UI**: 276 MUI/Emotion files. Full native rebuild in Tamagui. Reuse hooks + logic only.
- **External Stellar wallets** (Freighter, Lobstr, Ledger via `stellar-wallets-kit`): browser
  extensions. Only WalletConnect is possible on mobile. `packages/state` imports extension
  APIs directly and must be split into portable vs web-only.
- **Turnstile captcha** → mobile-appropriate bot protection.
- **MoneyGram SEP-24** opens a browser flow → in-app browser + deep-link return.
- **Window events** (`nf:cctp-resume`, `nf:session-expired`, …) and `localStorage` caches in
  ~12 engine/lib files → event emitter + AsyncStorage/SecureStore.
- PostHog web SDK → PostHog RN.

---

## 7. What is actually in this repo today

Verified at `3bc0217`. Treat this as the starting point to pivot, not as the target.

| Area | Target (§1–§6) | On disk now |
|---|---|---|
| Auth | Supabase | ✅ Supabase — `lib/supabase.ts`, `providers/supabase-auth-provider.tsx`, `services/auth.service.ts`, `app/auth/callback.tsx`. Google + Apple OAuth via `expo-auth-session`. Clerk fully removed. |
| Wallet | Turnkey sub-org, passkey-only | ❌ **BIP-39 seed phrase** — `lib/utils/mnemonic.utils.ts` + `crypto.utils.ts`, secret stored in SecureStore under `stellar_private_key` / `stellar_mnemonic`. Must be replaced wholesale. |
| Chains | BTC, ETH, SOL, XLM | ❌ Stellar only. No chain registry. |
| Swap | Soroswap / LI.FI / CCTP | ❌ Normal's own **pool router** + **Reflector oracle** Soroban contracts (`lib/contracts/`, `services/swap.service.ts`). |
| Backend | Next.js API, bearer JWT | ❌ `services/api.service.ts` hits `https://api.normalfinance.io` with 4 endpoints and **sends no Authorization header**. Prices come client-side from CoinMarketCap. |
| Savings | DeFindex/Blend vault | ❌ absent. Tabs exist for `invest` / `indexes` but on the prototype's own model. |

Zero occurrences of `turnkey`, `lifi`, `cctp`, `defindex`, `blend` or `passkey` anywhere in
the tree.

### Stack as configured

- **Expo SDK 54**, React Native 0.81.4, React 19.1.0, New Architecture on, React Compiler
  experiment on.
- **expo-router** with `typedRoutes`; screens in `app/`, tabs under `app/(tabs)/`.
- **Tamagui** for UI (`tamagui.config.ts`, `jsxImportSource: "tamagui"`).
- **TanStack Query** for all server state (`lib/utils/query.utils.ts` holds `STALE_TIMES`).
- Path aliases: `@/*` → repo root, `@svgs/*` → `assets/svgs/*`.
- No `ios/` or `android/` dirs — Continuous Native Generation. **Do not commit them.**

### Local setup

- **Node is pinned to 20.19.4** (`package.json` `engines`, and the EAS production profile).
  Using another major rewrites `package-lock.json` with thousands of spurious lines. Always
  `nvm use 20.19.4` before `npm install`.
- **Expo Go does not work.** `react-native-randombytes` ships native code and `expo-updates`
  is configured, so a **development build** is required:
  `npx expo prebuild --platform ios && npx expo run:ios --device`, or
  `eas build --profile development --platform ios`.
- EAS project `normalfi/normal`, id `3526d985-d1a6-4a57-ba43-4f585c763244`.
  iOS bundle id `io.normalfinance.normalfi`.

### Environment variables

`.env` is gitignored; real values live in EAS environment variables. Required:

| Variable | Behaviour if missing |
|---|---|
| `EXPO_PUBLIC_SUPABASE_URL` | throws at startup (`lib/supabase.ts`) |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | throws at startup |
| `EXPO_PUBLIC_CMC_API_KEY` | throws in `services/coinmarketcap.service.ts` — all prices dead |
| `EXPO_PUBLIC_RPC_API_KEY` | Stellar RPC access |
| `EXPO_PUBLIC_NETWORK` | defaults to `TESTNET`; v1 target is `MAINNET` |
| `EXPO_PUBLIC_{MAINNET,TESTNET}_{HORIZON_URL,RPC_URL,POOL_ROUTER,REFLECTOR_ORACLE}` | fall back to hardcoded values in `services/swap.service.ts` |

## 8. Environments

| Env | Backend | rpId | Whose passkeys work |
|---|---|---|---|
| localhost web | `http://localhost:3000` | `localhost` | browser on localhost only — **never the app** |
| staging | staging Vercel URL | `normalfinance.io` | any account from staging/prod web or the app |
| production | `https://normalfinance.io` | `normalfinance.io` | same as staging |

One Supabase Auth project is shared by localhost/staging/prod (one identity per email).
Mobile development targets **staging** with a staging account. Passkeys must live in a
keychain the phone can reach (iCloud Keychain on iOS, Google Password Manager on Android), or
just create a fresh account from the app.

## 9. Hard rules

1. **Never `git commit` or `git push`.** Staging and merging are fine; hand Niko the commit
   message to run himself.
2. **Never write to `.env` or any secrets file.** Name the variables and the exact lines
   instead.
3. **No guessing.** Verify in code before asserting. Label shortcuts and their trade-offs.
4. **Explain as cause → effect** ("if you do X you will see Y"). Direct answer first. Decode
   large diffs into categories with counts. Give verifiable test steps.
5. **Scale-first**: thousands of users. Think rate limits, N+1, blast radius.
6. **Never use `**` on a BigInt** — it transpiles to `Math.pow` and crashes at runtime.
7. **Lazy asset creation** (§4) and the **chain registry** (§5) rules are absolute.
8. **LI.FI Bitcoin PSBTs**: sign exactly what LI.FI builds. Never reorder or add outputs —
   Chainflip cannot refund a malformed deposit, so the loss is permanent.
9. Self-completing money state always has a UI surface owned by no modal. Explicit user
   clicks bypass freshness heuristics. Resume intent goes in route params, not an event.

## 10. Open items (2026-09-10)

- Publish `/.well-known/apple-app-site-association` and `/.well-known/assetlinks.json` on
  `normalfinance.io` (needs the Apple Team ID + bundle ids, Android package + cert SHA-256).
- Decide bundle identifiers for dev/staging vs prod builds.
- Extract a shared `core` package from `packages/web` (API client, engines, signers) so web
  and mobile share one implementation.
- Confirm whether the `normalfinance.io` apex is served by the Next.js app (needed to host the
  association files) or by a separate marketing site.
- Decide the fate of the prototype wallet: migration path for any existing seed-phrase users,
  or confirm there are none and delete `mnemonic.utils.ts` / `crypto.utils.ts` outright.
- Branching: `develop` is the trunk (`origin/HEAD` points at it). `master` holds only the
  initial commit and is stale — either sync it as the release branch or delete it.

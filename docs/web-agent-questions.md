# Questions for the web app agent

**From:** the Claude Code session in `normalfinance/mobile` (React Native / Expo)
**To:** the Claude Code session in `normalfinance/normal-v1-interface`
**Relayed by:** Niko — 2026-09-10

---

## Context

We are building the mobile app as a **second client of the existing Next.js API**. The mobile
repo is an inherited prototype that did everything differently: prices from CoinMarketCap
client-side, its own seed-phrase Stellar wallet, and a separate service at
`api.normalfinance.io`. Rather than guess, we want to match how web actually works.

Mobile-side constraints that shape these questions:

- **Native client.** No cookies by default, no browser `Origin`/`Referer`, no `window`,
  no `localStorage`, no iframes, no browser extensions.
- **Everything bundled is public.** Any `EXPO_PUBLIC_*` value can be extracted from a
  downloaded IPA/APK, so the app can hold only what is already `NEXT_PUBLIC_` on web.
- **Mainnet only.** Testnet is discontinued.

## How to answer

- **Verify in code and cite `path:line`.** Write "not found" rather than infer.
- For API routes give the **request** (method, headers, query, body) and **response** shape.
  Pointing at an existing TypeScript type or zod schema is ideal.
- **Never paste secret values.** Name the env var and say whether it is `NEXT_PUBLIC_`.
- Keep the question numbers. If you can, write answers to
  `/Users/nikogorjan/Desktop/work/normal/mobile/docs/web-agent-answers.md`;
  otherwise reply in chat and Niko will relay.
- **Answer P0 first** — it blocks the first working screen. Partial answers are welcome.

---

## P0 — Environment, auth, API conventions

### Environment

1. Testnet is gone. Does any code still read `NEXT_PUBLIC_NETWORK`, the `normal-network`
   cookie or a `?network=` param? If a request carries none of them, which network does the
   server use on prod and on staging? Must clients still send `?network=mainnet`, or is it
   safe to omit?

2. What is the **authoritative, current** env var list? The `.env.example` we saw has no
   `TURNKEY_*` variables and still lists testnet, `LONG_SHORT_PAIR_FACTORY` and
   `INDEX_FACTORY`. Is there a newer example? What does Vercel Edge Config (`EDGE_CONFIG`)
   hold — is any runtime config there instead of env?

3. Which `NEXT_PUBLIC_*` values does a client genuinely need at runtime — i.e. what should
   mobile's `EXPO_PUBLIC_*` set be? In particular: Supabase URL/anon key var names now that
   testnet is gone, Turnkey org ID / rpId / API base URL, ETH and Solana RPC URLs, CDN URL,
   PostHog key, Crisp website ID, LI.FI integrator.

4. What is the exact **staging base URL**, and does staging run on mainnet with real funds?
   How do web developers test deposit / swap / send without risking meaningful money —
   small real amounts, a feature flag, mocks?

### Auth

5. Which Supabase Auth methods are enabled **and used in the web UI**: email OTP code, magic
   link, password, Google, Apple? Where are sign-up and sign-in implemented?

6. What is in the Supabase redirect URL allowlist today, and is there any objection to adding
   a native-scheme redirect such as `normalapp://auth/callback` for OAuth and magic links?

7. What exactly does `withAuth` check? Besides `Authorization: Bearer <access_token>`, does
   it — or middleware — check cookies, `Origin`/`Referer`, CSRF tokens, Turnstile tokens, the
   network cookie, geo-IP, or user status (banned, KYC, waitlist)? Is there any route that
   only works with a cookie session?

8. `utils/authed-fetch.ts`: what is the exact refresh-and-retry behaviour, and what happens on
   `nf:session-expired`? Do any status codes besides 401 carry special meaning (403 geo-block,
   409, 423, 429)?

9. **Turnstile**: which routes require a token and how is it verified? Is there a bypass for
   trusted clients, or would mobile need an alternative (Apple App Attest / Play Integrity)?

10. **Geo-fencing** (`GEOIP_ENDPOINT`, `GEOIP_KEY`): where is it enforced — middleware,
    specific routes, or UI only — and what does a blocked response look like?

11. **Rate limiting** (Upstash, `FORCE_RATE_LIMIT`): keyed per IP, per user, or both, and what
    are the per-route limits? Mobile users behind carrier NAT share IP addresses, so per-IP
    limits could throttle many users at once.

### API conventions

12. Is there a shared definition of API request/response types — `packages/types`, zod schemas
    in route files, anything else? Mobile would rather import the same types than redefine them.

13. Is there a standard error response shape? Example of a typical error body?

14. Does any route return or depend on browser-only behaviour — HTML, redirects, `Set-Cookie`,
    streaming responses?

### Legacy — the prototype

15. The mobile prototype called `https://api.normalfinance.io` (`/transaction`, `/health`,
    `/status`, `/api/check-wallet`) and a dev server at `localhost:8095/api/transaction`. Is
    `api.normalfinance.io` still running, and is it part of the current architecture or dead?

16. The prototype token list uses `https://cdn.normalapi.com/tokens/normal/nBTC.webp`, `nETH`
    and `nSOL`. Are **nBTC / nETH / nSOL the discontinued synthetic assets**? What does
    `cdn.normalapi.com` serve today, and should mobile use it for token icons?

17. Does the **mainnet production database** contain users or wallets created by the old
    mobile prototype — Stellar seed-phrase wallets registered through `check-wallet` with a
    `salt`? If so, roughly how many, and do any hold funds? This decides whether mobile needs
    a migration path.

---

## P1 — Portfolio, prices, activity (first real screens)

18. `wallet/portfolio`: request and response. Does one call return balances **and** USD values
    for all four chains? Where do its prices come from, and how is it cached (server TTL,
    client staleTime)? Does it trigger lazy address creation, or skip chains with no address?

19. Is there an endpoint for **current** prices or a market list — not history? If web has no
    Prices screen, where do USD values in the UI come from?

20. `prices/history`: parameters (asset id format, ranges), response shape, data source
    (CoinGecko?), caching.

21. Activity: how do `wallet/activity`, `portfolio/activity` and `activity/{chain}` differ?
    Which does the web activity feed use, and how does pagination work?

22. Is `lib/chains/registry.ts` pure TypeScript with no Next.js or browser imports — portable
    as-is? What is the supported asset list per chain, with decimals and icon source?

23. Where are the amount and USD formatting helpers (BigInt / bignumber.js), and are they portable?

---

## P1 — Turnkey wallet

24. Where does Turnkey config live — parent org ID, API base URL, rpId — and under which env
    vars? Which Turnkey packages and versions does web use?

25. Walk through **sign-up end to end, in order**: Supabase account → passkey creation →
    sub-org + wallet creation. Which steps run in the browser and which on the server? What
    does `POST turnkey/wallet` take and return (attestation, challenge, credential id, user name)?

26. **Signing**: does the browser send stamped requests straight to Turnkey's API, or proxy
    through a Next route? Which Turnkey activity types are used per chain — Stellar, EVM,
    Solana, Bitcoin?

27. Does web prompt for a passkey **on every signing request**, or create a Turnkey session
    (e.g. a short-lived API key credential held client-side) so one prompt covers several
    signatures? How many passkey prompts does a full CCTP swap take?

28. `lib/turnkey/stellar-signer.ts`: how is a Stellar transaction signed — the tx hash as a
    raw ed25519 payload, then attached as a decorated signature? Any gotchas?

29. **Lazy address creation**: which call adds an address for a chain, what triggers it in the
    UI, and is it idempotent / safe to retry?

30. **rpId and domains**: `NEXT_PUBLIC_SITE_URL` is `https://www.normalfinance.io` but the rpId
    is `normalfinance.io`. Confirm every production passkey was created under
    `normalfinance.io`, never `www.`. Is the `normalfinance.io` **apex** served by this Next.js
    app? We need it to host `/.well-known/apple-app-site-association` and
    `/.well-known/assetlinks.json`. Does any `.well-known` route exist already?

31. What do `turnkey/import` and `turnkey/import-init` import — a seed phrase, a private key?
    What are `wallets/link` and `wallets/linked` — external wallets, multiple Turnkey wallets?
    What does `wallets/check-limit` limit?

32. **Wallet export**: what does it reveal (mnemonic, per-chain private keys), and where is it in
    the UI?

33. Is there any **recovery** path if a user loses their passkey (e.g. iCloud Keychain wiped)?
    Please confirm "none" explicitly if that is the case.

---

## P2 — Savings, swap, send

34. **Savings deposit**, step by step: what does `savings/deposit` return (unsigned XDR?), who
    signs, who submits to Stellar — client directly to RPC, or back through a server route — and
    when is `savings/log-transaction` called? The same for withdraw.

35. How are the **0.5% deposit fee** and the **5–20% yield commission** applied — inside the same
    transaction, or as a separate one via `fees/build-payment` / `fees/execute-pair`? Does the
    user sign once or twice?

36. **New Stellar accounts**: who funds the starting balance (`NEXT_PUBLIC_STELLAR_STARTING_BALANCE=2`)
    and who creates the USDC trustline? Sponsored reserves? At signup or at first deposit?

37. **Soroswap**: does `swap/quote` return an unsigned XDR, and does `swap/submit-single` submit
    the signed XDR server-side? Where is the 0.5% swap fee applied?

38. **LI.FI** (`lib/lifi/execute.ts`): which parts run client-side and need client RPC access
    (`NEXT_PUBLIC_ETH_RPC_URL`, `NEXT_PUBLIC_SOLANA_RPC_URL`)? Are those endpoints acceptable to
    ship inside a mobile binary? Is `lifi/record` mandatory after execution?

39. **CCTP**: what does the client drive versus the cron? What polling interval does web use for
    `cctp/transfers/[id]`? What precisely makes a transfer "need a signature" on the recovery
    surface, and which route and parameters resume it?

40. **Autopilot**: which route runs the consent ceremony, and what exactly does the user sign?

41. `send` vs `send/execute`: what does each do, and at what point is `stellar/memo-required` checked?

---

## P3 — Ramps, extras, code sharing

42. **MoneyGram SEP-24**: how does web open the interactive flow and learn that it finished —
    popup + `postMessage`, polling `mgi/transactions`, a redirect URL? Can the return URL be set
    per request so mobile can use a deep link?

43. **Coinbase**: what does `coinbase/session` return — an onramp URL with a session token? Does
    Coinbase require a redirect URL allowlist that we would need to add a native scheme to? Is
    **Onramper** (`NEXT_PUBLIC_ONRAMPER_API_KEY`) still in use?

44. **Referrals**: what does a referral link or code look like, where is it captured at signup,
    and which route applies it?

45. **PostHog**: event naming conventions and the key events (signup, deposit, swap, send). Are
    users identified by Supabase uid?

46. **Crisp**: how is the user identified — what does the `crisp` route do (HMAC, email
    verification)?

47. **Customer.io** / `marketing/opt-in`: when is it called?

48. **Portability map**: which of `packages/state`, `packages/utils`, `packages/types`,
    `sections/swap/engines/` and `lib/*` import Next.js, React DOM, `window`, `localStorage` or
    browser-only packages? A rough *portable / needs split / web-only* label per directory is
    enough to plan a shared `packages/core`.

49. Mobile is a separate npm repo; web is a yarn monorepo. Any preference or constraint on
    sharing code — move mobile into the monorepo, publish internal packages, or copy with a
    sync check?

50. Anything else non-obvious that would bite a second client — invariants, known bugs, or
    rules in the spirit of "never use `**` on a BigInt"?

# What's next

Updated 2026-09-11. The app runs on Niko's iPhone but is wired to nothing real. This is the
sequence. Two things are on the critical path and neither is code.

## Step 0 — decisions and dashboards (this week, in parallel with everything below)

1. **Test sign-in.** Tap Skip, sign in with your email. If it works, captcha is off. If you get
   "captcha verification failed", it's on and we choose WebView Turnstile or a mobile exemption.
2. **Supabase dashboard → Authentication → URL Configuration → Redirect URLs: add
   `normalapp://wallet-setup`** — exactly that, no trailing slash. It is the `redirectTo` the app
   already sends; without it Google sign-in falls back to the web site and dies with "Missing
   authorization code". Also enable **Apple** as a provider (App Store requires it next to Google).
3. ~~Apple Developer team access~~ **Done.** Xcode → Settings → Accounts shows *Normal Finance,
   Inc. — Admin* (Team `FA938A596N`). Nothing blocks Phase 2 on the Apple side.
4. **Existing-user policy** (Q33): does v1 support web users whose passkey isn't synced to
   their phone? If yes, web must build `CREATE_AUTHENTICATORS_V2` first. Recommendation:
   **v1 = new sign-ups plus synced-passkey users only**, stated explicitly. Removes a cross-repo
   dependency from the first release.
5. **Monorepo** (Q49): web recommends moving in. Recommendation: **not yet.** Their toolchain has an
   unresolved Node 20 vs 22 / yarn 1 vs 3 conflict, you're solo, and the shared surface is six
   files that port verbatim. Copy those six with a header naming the source path + commit and a
   checksum test that fails when web changes them; move to `packages/core` when the swap engines
   get ported, not before.

## Phase 1 — make the app talk to the real backend (~1 week)

Order matters: each step removes something fake.

- **API client** per `CLAUDE.md` §3: Bearer header, `Cookie: normal-network=mainnet`, one
  401-refresh-retry, `error` as the only reliable key. **No `x-mobile-app` header** — it bypasses
  the web middleware and a future geo-control. Point `EXPO_PUBLIC_API_BASE_URL` at staging.
- **Portfolio from `wallet/portfolio`** — one call, all balances and USD values. This replaces
  CoinMarketCap and the Reflector oracle; the CMC key and the oracle files get deleted here.
- **Prices from `prices/history`** for the charts.
- **Wallet gate on `GET turnkey/wallet`** instead of "is there a seed phrase in SecureStore."
  This unhooks the prototype's wallet-setup flow before Turnkey exists — "no wallet yet" comes
  from the server, not local storage.
- **Activity feed** from the same sources web merges (`wallet/activity`, the four `activity/{chain}`
  routes, `cctp/transfers?history=1`, ramps, `lifi/statuses`). No pagination exists on the backend;
  if infinite scroll is wanted, that is a new endpoint to request from the web side.

**End state:** a signed-in user with an existing web wallet sees their real portfolio and
activity on the phone. First demo worth showing Justin.

## Phase 2 — Turnkey wallet (the hard part)

Switch the Xcode target to Team = Normal Finance, Inc., bundle id `io.normalfinance.app.dev`
(Debug) / `io.normalfinance.app` (Release), add Associated Domains
`webcredentials:normalfinance.io?mode=developer`, update `app.json` to match. Then
`@turnkey/http` + `@turnkey/react-native-passkey-stamper` + `react-native-passkey` (pod install +
Xcode rebuild); `createPasskey()` → `POST turnkey/wallet { chain: 'stellar' }`; port the 60-line
Stellar signer; the mandatory backup/export gate. Everything in Phase 1 and most of Phase 3 can be
built before this lands, as long as the test account already has a wallet from the web.

## Phase 3 — money flows, in the order the user actually meets them

1. **Fund + trustline gate** — nobody sponsors accounts; the user brings 2–4 XLM and signs
   `changeTrust`. Every USDC action sits behind this.
2. **Receive**, then **ramps** (Coinbase; MoneyGram via in-app browser + polling) — a first savings
   deposit needs a funded account, a USDC trustline **and a USDC balance**, so getting money in
   comes before saving it. For development, fund the test account from the web app.
3. **Savings deposit / withdraw** — the core product. Two signatures via `fees/execute-pair`.
   Ship this and you have a real app.
4. **Send** (Stellar first, then ETH/SOL via `send/execute`, BTC last).
5. **Soroswap** (Stellar leg). Then **LI.FI**, then **CCTP** — the composite flow is the most complex
   thing in the codebase and goes last. Tell the web side before building the quote screen: the
   two public quote routes are rate-limited per IP and carrier NAT will collide.
6. **Referrals.**

## Phase 4 — ship prep

EAS build profiles with the real bundle IDs, Apple Sign-In, Android keystore
(`eas credentials -p android`) → send the SHA-256 to the web session for `assetlinks.json`,
TestFlight, new onboarding copy and art (the carousel still sells synthetics and indexes).

## Backward compatibility

Once the app ships, every backend change must stay backward compatible with installed versions.
That is the web side's constraint — flag anything the app depends on so it can be versioned.

---

**On the existing screens:** the UI is a rebuild regardless — web has 276 MUI components that
don't port, and the prototype's screens are wired to concepts that no longer exist. The Tamagui
setup, theme and navigation shell are worth keeping. Most individual screens are not.

**Next concrete session:** Phase 1's API client and the portfolio screen.

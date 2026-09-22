// "Skip for now" on Get started: web records nothing (the account simply has
// no turnkey_wallets row) and lands the user on Get started again at the next
// sign-in. Mobile mirrors that with a process-scoped flag: skipped this
// launch → Home works wallet-less and every money entry point provisions the
// chain on demand; next cold start shows Get started again.

let skipped = false;

export const skipOnboarding = () => {
  skipped = true;
};
export const hasSkippedOnboarding = () => skipped;

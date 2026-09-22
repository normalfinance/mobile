# Supabase auth email templates (2026-09-22)

Code-only: the app and the web both verify the 6-digit code (`verifyOtp` type `email`);
neither flow needs the `{{ .ConfirmationURL }}` link (confirmed with the web agent).
Password reset keeps Supabase's own template.

Where: Supabase → Authentication → Emails (Notifications) → pick the template → Body → **Source** → paste → Save.

| Template | Subject | File |
|---|---|---|
| Confirm sign up | `Your Normal sign-up code: {{ .Token }}` | `confirm-signup.html` |
| Magic Link | `Your Normal sign-in code: {{ .Token }}` | `magic-link.html` |

Design: table layout with inline styles (email clients ignore stylesheets), 480px card, ink `#0A0A0F`,
muted `#6B6B76`, the logo from `https://cdn.normalapi.com/logo/logo-single.png` (PNG — email clients
do not render SVG/WebP reliably), the code in monospace with wide tracking.

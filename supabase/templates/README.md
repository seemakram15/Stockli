# Supabase email templates

These templates cover the current Stockli auth flows:

- `confirm-email.html`
- `reset-password.html`
- `password-changed-notification.html`

## Recommended subjects

- Confirm signup: `Confirm your Stockli account`
- Reset password: `Reset your Stockli password`
- Password changed notification: `Your Stockli password was changed`

## Supabase auth URL settings

- Production site URL: `https://mystockli.com`
- Local development URL: `http://localhost:3001`
- Additional Redirect URLs:
  - `https://mystockli.com/auth/callback`
  - `https://mystockli.com/auth/callback?next=/reset-password`
  - `https://www.mystockli.com/auth/callback`
  - `https://www.mystockli.com/auth/callback?next=/reset-password`
  - `https://mystockli.qzz.io/auth/callback` (legacy, temporary)
  - `https://mystockli.qzz.io/auth/callback?next=/reset-password` (legacy, temporary)
  - `http://localhost:3001/auth/callback`
  - `http://localhost:3001/auth/callback?next=/reset-password`

The app sends `emailRedirectTo` and recovery redirects from `lib/config.ts`, so
production returns to `mystockli.com` and local development returns to port `3001`.
The production `.vercel.app` hostname is intentionally not used for auth emails anymore.
Old `mystockli.qzz.io`, `www.mystockli.qzz.io`, and `www.mystockli.com` hosts permanently redirect to `https://mystockli.com`.

Logo note:

- The email templates intentionally use the production Stockli icon asset so email
  clients always load a public logo URL instead of a localhost-only image.

## Brevo SMTP settings

Use these values in Supabase Auth > SMTP Settings:

- Host: `smtp-relay.brevo.com`
- Port: `587`
- Username: your Brevo SMTP login
- Password: your Brevo SMTP key
- Sender name: `Stockli`
- Sender email: your verified Brevo sender email, ideally `no-reply@your-domain`

Important:

- Verify the sender email or domain in Brevo before enabling SMTP in Supabase.
- Disable Brevo click/open tracking for auth emails so Supabase links are not rewritten.
- Keep your SMTP key and Supabase access token out of git.

## Apply via dashboard

Paste the matching HTML file into:

- Auth > Email Templates > Confirm signup
- Auth > Email Templates > Reset password
- Auth > Email Templates > Password changed

Then set the matching subjects above.

## Apply via script

The repo includes:

- `npm run supabase:auth-email:check`
- `npm run supabase:auth-email:apply`

The apply script also pushes the hosted Supabase auth URL settings so:

- production auth emails return to `https://mystockli.com`
- local development auth emails can still return to `http://localhost:3001`

Required env vars:

- `SUPABASE_ACCESS_TOKEN`
- `SUPABASE_PROJECT_REF`
- `SUPABASE_AUTH_SMTP_USER`
- `SUPABASE_AUTH_SMTP_PASS`
- `SUPABASE_AUTH_SMTP_ADMIN_EMAIL`

Optional env vars:

- `SUPABASE_AUTH_SMTP_HOST` default: `smtp-relay.brevo.com`
- `SUPABASE_AUTH_SMTP_PORT` default: `587`
- `SUPABASE_AUTH_SMTP_SENDER_NAME` default: `Stockli`
- `SUPABASE_AUTH_RATE_LIMIT_EMAIL_SENT` default: `30`

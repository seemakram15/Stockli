# Supabase email templates

Paste `confirm-email.html` into:

Authentication > Emails > Confirm signup

Recommended subject:

Confirm your Stockli account

Auth URL settings:

- Site URL: `https://mystockli.vercel.app`
- Additional Redirect URLs:
  - `https://mystockli.vercel.app/auth/callback`
  - `http://localhost:3001/auth/callback`

The app sends `emailRedirectTo` from `lib/config.ts`, so production signups return
to `mystockli.vercel.app` and local development returns to port `3001`.

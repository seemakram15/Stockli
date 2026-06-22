# Security

This project is safe to push to GitHub when the repository contains only the
placeholder `.env.example`, not real `.env.local` values.

## Secrets

Never commit these values:

- `SUPABASE_SERVICE_ROLE_KEY`
- `DATABASE_URL`
- `UPSTASH_REDIS_REST_TOKEN`
- `CRON_SECRET`
- real `.env.local` files
- Supabase personal access tokens or account passwords

`NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` are public by
design, but they still belong in environment variables so deployments are easy
to manage per environment.

## Vercel

Store keys in **Vercel Project Settings -> Environment Variables**. Add them for
Production, Preview, and Development only where needed.

Required variables:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `DATABASE_URL`
- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`
- `CRON_SECRET`
- `NEXT_PUBLIC_SITE_URL`
- `PSX_DPS_BASE_URL`

The service-role key is server-only. It must never be prefixed with
`NEXT_PUBLIC_`.

`DATABASE_URL` is also server-only. Vercel uses it during `npm run build` to
apply SQL migrations before compiling the app. Never expose it to client code.

## Cron Routes

These routes require `Authorization: Bearer <CRON_SECRET>`:

- `/api/keep-alive`
- `/api/cron/refresh`

Use a long random value for `CRON_SECRET`, for example:

```bash
openssl rand -base64 32
```

## If A Secret Leaks

Rotate it immediately:

- Supabase service role key: Supabase Dashboard -> Project Settings -> API
- Upstash REST token: Upstash Console -> Redis DB -> REST API
- Cron secret: generate a new value and update Vercel plus external cron jobs
- User/admin passwords: reset from Supabase Auth or the app

After rotation, redeploy Vercel and verify cron jobs still return `200`.

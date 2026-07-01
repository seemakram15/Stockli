-- ─────────────────────────────────────────────────────────────
-- 0008_private_data_hardening.sql — bounds for browser/device inputs
--
-- Tightens DB-level validation around notification consent, notification
-- payloads, and push subscriptions so malformed or oversized browser input is
-- rejected even if an API route is bypassed or regresses later.
-- ─────────────────────────────────────────────────────────────

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'profiles_cookie_consent_version_len') then
    alter table public.profiles
      add constraint profiles_cookie_consent_version_len
      check (cookie_consent_version is null or char_length(cookie_consent_version) <= 40) not valid;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'notifications_title_len') then
    alter table public.notifications
      add constraint notifications_title_len
      check (char_length(title) between 1 and 120) not valid;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'notifications_body_len') then
    alter table public.notifications
      add constraint notifications_body_len
      check (body is null or char_length(body) <= 500) not valid;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'notifications_href_format') then
    alter table public.notifications
      add constraint notifications_href_format
      check (
        href is null or (
          char_length(href) <= 200 and
          left(href, 1) = '/' and
          href not like '//%' and
          href !~ '[[:cntrl:]]'
        )
      ) not valid;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'push_subscriptions_endpoint_len') then
    alter table public.push_subscriptions
      add constraint push_subscriptions_endpoint_len
      check (char_length(endpoint) between 1 and 2000) not valid;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'push_subscriptions_endpoint_https') then
    alter table public.push_subscriptions
      add constraint push_subscriptions_endpoint_https
      check (endpoint like 'https://%') not valid;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'push_subscriptions_p256dh_len') then
    alter table public.push_subscriptions
      add constraint push_subscriptions_p256dh_len
      check (char_length(p256dh) between 1 and 512) not valid;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'push_subscriptions_auth_len') then
    alter table public.push_subscriptions
      add constraint push_subscriptions_auth_len
      check (char_length(auth) between 1 and 256) not valid;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'push_subscriptions_user_agent_len') then
    alter table public.push_subscriptions
      add constraint push_subscriptions_user_agent_len
      check (user_agent is null or char_length(user_agent) <= 500) not valid;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'push_subscriptions_last_error_len') then
    alter table public.push_subscriptions
      add constraint push_subscriptions_last_error_len
      check (last_error is null or char_length(last_error) <= 500) not valid;
  end if;
end $$;

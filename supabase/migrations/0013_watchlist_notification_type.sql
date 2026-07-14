-- Allow WATCHLIST notifications (price moves on watched stocks).
do $$
begin
  if exists (
    select 1 from information_schema.table_constraints
    where constraint_name = 'notifications_type_check'
      and table_name = 'notifications'
  ) then
    alter table public.notifications drop constraint notifications_type_check;
  end if;

  alter table public.notifications
    add constraint notifications_type_check
    check (type in ('ALERT', 'MARKET', 'SYSTEM', 'PORTFOLIO', 'WATCHLIST')) not valid;
exception
  when duplicate_object then null;
end $$;

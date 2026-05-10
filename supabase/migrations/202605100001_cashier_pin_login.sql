-- ============================================================
-- Migration: Cashier PIN Login Support
-- ============================================================
-- Adds:
--   1. get_active_cashiers() — public RPC, returns id+name of
--      active cashiers that have a PIN set (no sensitive data)
--   2. Grant verify_cashier_pin to anon role so the Edge
--      Function can call it without a user session
-- ============================================================

-- 1. Public helper: list active cashiers with PIN set
--    Called by the login page BEFORE any auth session exists.
--    Returns minimal fields only — no pin_hash, no email.
create or replace function public.get_active_cashiers()
returns table (
  id   uuid,
  name text
)
language sql
security definer
stable
set search_path = public
as $$
  select id, name
  from public.profiles
  where role     = 'cashier'
    and is_active = true
    and pin_hash is not null
  order by name;
$$;

-- Grant to anon (unauthenticated) and authenticated
grant execute on function public.get_active_cashiers() to anon, authenticated;

-- 2. Grant verify_cashier_pin to anon so Edge Function
--    (which calls via service role) can invoke it.
--    NOTE: the function is security definer so it bypasses RLS.
grant execute on function public.verify_cashier_pin(uuid, text) to anon, authenticated;

-- 3. Add login_email column to profiles (denormalized for PIN login flow).
--    Populated when owner creates/updates a cashier account.
--    The Edge Function reads profiles.id ↔ auth.users.id directly
--    via admin API, so this column is optional metadata only.
--    Keeping it here for future admin UI display use.
alter table public.profiles
  add column if not exists login_email text;

comment on column public.profiles.login_email is
  'Supabase Auth email for this profile. Populated by owner when creating cashier. Used as display reference only — do not use for auth decisions on client.';

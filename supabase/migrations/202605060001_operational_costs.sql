-- SmartPOS: Tabel Biaya Operasional Toko
-- Migration: 202605060001_operational_costs.sql

-- Enum kategori biaya
create type public.cost_category as enum (
  'gaji',
  'sewa',
  'listrik',
  'air',
  'internet',
  'transportasi',
  'bahan_baku_non_produk',
  'perlengkapan',
  'pemasaran',
  'lainnya'
);

-- Enum periode biaya
create type public.cost_period as enum (
  'harian',
  'mingguan',
  'bulanan',
  'tahunan',
  'sekali'
);

-- Tabel biaya operasional
create table public.operational_costs (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  category     public.cost_category not null default 'lainnya',
  amount       numeric(14,2) not null,
  period       public.cost_period not null default 'bulanan',
  cost_date    date not null default current_date,
  description  text,
  is_recurring boolean not null default false,
  created_by   uuid references public.profiles(id),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint operational_costs_name_not_empty  check (length(trim(name)) > 0),
  constraint operational_costs_amount_positive check (amount > 0)
);

create index operational_costs_date_idx      on public.operational_costs (cost_date);
create index operational_costs_category_idx  on public.operational_costs (category);
create index operational_costs_created_by_idx on public.operational_costs (created_by);

-- Trigger updated_at
create trigger operational_costs_set_updated_at
  before update on public.operational_costs
  for each row execute function public.set_updated_at();

-- RLS
alter table public.operational_costs enable row level security;

-- Hanya manager/owner yang bisa baca & kelola
create policy "managers can read operational costs"
  on public.operational_costs for select
  to authenticated
  using (public.is_manager_or_owner());

create policy "managers can insert operational costs"
  on public.operational_costs for insert
  to authenticated
  with check (public.is_manager_or_owner());

create policy "managers can update operational costs"
  on public.operational_costs for update
  to authenticated
  using (public.is_manager_or_owner())
  with check (public.is_manager_or_owner());

create policy "managers can delete operational costs"
  on public.operational_costs for delete
  to authenticated
  using (public.is_manager_or_owner());

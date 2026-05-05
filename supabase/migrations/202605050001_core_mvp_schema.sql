-- SmartPOS Core MVP Schema
-- Run this migration before building application features.

create extension if not exists "pgcrypto";
create extension if not exists "uuid-ossp";

create type public.user_role as enum ('cashier', 'manager', 'owner');
create type public.customer_type as enum ('retail', 'wholesale');
create type public.transaction_status as enum ('draft', 'paid', 'voided', 'sync_failed');
create type public.payment_method as enum ('cash', 'transfer', 'mixed');
create type public.stock_movement_type as enum ('sale', 'purchase', 'return', 'adjustment_in', 'adjustment_out', 'void');
create type public.shift_status as enum ('open', 'closed');
create type public.notification_status as enum ('pending', 'sent', 'failed', 'skipped');

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role public.user_role not null default 'cashier',
  name text not null,
  pin_hash text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_name_not_empty check (length(trim(name)) > 0)
);

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint categories_name_not_empty check (length(trim(name)) > 0)
);

create unique index categories_name_unique_idx on public.categories (lower(name));

create table public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  sku text,
  barcode text,
  category_id uuid references public.categories(id) on delete set null,
  price_retail numeric(14,2) not null default 0,
  price_wholesale numeric(14,2) not null default 0,
  wholesale_min_qty numeric(14,3) not null default 1,
  cost_price numeric(14,2) not null default 0,
  stock_qty numeric(14,3) not null default 0,
  min_stock numeric(14,3) not null default 0,
  unit text not null default 'pcs',
  image_url text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint products_name_not_empty check (length(trim(name)) > 0),
  constraint products_price_non_negative check (
    price_retail >= 0
    and price_wholesale >= 0
    and wholesale_min_qty > 0
    and cost_price >= 0
    and stock_qty >= 0
    and min_stock >= 0
  )
);

create unique index products_sku_unique_idx on public.products (lower(sku)) where sku is not null and length(trim(sku)) > 0;
create unique index products_barcode_unique_idx on public.products (barcode) where barcode is not null and length(trim(barcode)) > 0;
create index products_category_id_idx on public.products (category_id);
create index products_name_idx on public.products using gin (to_tsvector('simple', name));

create table public.customers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text,
  type public.customer_type not null default 'retail',
  address text,
  credit_limit numeric(14,2) not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint customers_name_not_empty check (length(trim(name)) > 0),
  constraint customers_credit_limit_non_negative check (credit_limit >= 0)
);

create index customers_name_idx on public.customers using gin (to_tsvector('simple', name));
create index customers_phone_idx on public.customers (phone) where phone is not null;

create table public.suppliers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text,
  address text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint suppliers_name_not_empty check (length(trim(name)) > 0)
);

create index suppliers_name_idx on public.suppliers using gin (to_tsvector('simple', name));

create table public.product_suppliers (
  product_id uuid not null references public.products(id) on delete cascade,
  supplier_id uuid not null references public.suppliers(id) on delete cascade,
  is_default boolean not null default false,
  lead_time_days integer,
  last_cost_price numeric(14,2),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (product_id, supplier_id),
  constraint product_suppliers_lead_time_non_negative check (lead_time_days is null or lead_time_days >= 0),
  constraint product_suppliers_cost_non_negative check (last_cost_price is null or last_cost_price >= 0)
);

create unique index product_suppliers_one_default_idx on public.product_suppliers (product_id) where is_default = true;

create table public.shifts (
  id uuid primary key default gen_random_uuid(),
  cashier_id uuid not null references public.profiles(id),
  opened_at timestamptz not null default now(),
  closed_at timestamptz,
  opening_cash numeric(14,2) not null default 0,
  closing_cash numeric(14,2),
  expected_cash numeric(14,2),
  difference numeric(14,2),
  status public.shift_status not null default 'open',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint shifts_cash_non_negative check (
    opening_cash >= 0
    and (closing_cash is null or closing_cash >= 0)
    and (expected_cash is null or expected_cash >= 0)
  ),
  constraint shifts_closed_has_closed_at check (
    (status = 'open' and closed_at is null)
    or (status = 'closed' and closed_at is not null)
  )
);

create unique index shifts_one_open_per_cashier_idx on public.shifts (cashier_id) where status = 'open';
create index shifts_cashier_id_idx on public.shifts (cashier_id);
create index shifts_opened_at_idx on public.shifts (opened_at);

create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  client_transaction_id uuid not null,
  idempotency_key text not null,
  invoice_no text not null,
  cashier_id uuid not null references public.profiles(id),
  customer_id uuid references public.customers(id) on delete set null,
  type public.customer_type not null default 'retail',
  payment_method public.payment_method not null,
  subtotal numeric(14,2) not null,
  discount numeric(14,2) not null default 0,
  total numeric(14,2) not null,
  cash_paid numeric(14,2),
  change numeric(14,2),
  shift_id uuid not null references public.shifts(id),
  status public.transaction_status not null default 'paid',
  voided_at timestamptz,
  voided_by uuid references public.profiles(id),
  void_reason text,
  synced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint transactions_amounts_valid check (
    subtotal >= 0
    and discount >= 0
    and total >= 0
    and (cash_paid is null or cash_paid >= 0)
    and (change is null or change >= 0)
  ),
  constraint transactions_void_fields_valid check (
    (status <> 'voided' and voided_at is null)
    or (status = 'voided' and voided_at is not null and voided_by is not null and length(trim(coalesce(void_reason, ''))) > 0)
  )
);

create unique index transactions_invoice_no_unique_idx on public.transactions (invoice_no);
create unique index transactions_client_transaction_id_unique_idx on public.transactions (client_transaction_id);
create unique index transactions_idempotency_key_unique_idx on public.transactions (idempotency_key);
create index transactions_cashier_id_idx on public.transactions (cashier_id);
create index transactions_customer_id_idx on public.transactions (customer_id);
create index transactions_shift_id_idx on public.transactions (shift_id);
create index transactions_created_at_idx on public.transactions (created_at);
create index transactions_status_idx on public.transactions (status);

create table public.transaction_items (
  id uuid primary key default gen_random_uuid(),
  transaction_id uuid not null references public.transactions(id) on delete cascade,
  product_id uuid not null references public.products(id),
  qty numeric(14,3) not null,
  unit_price numeric(14,2) not null,
  master_price numeric(14,2) not null,
  discount numeric(14,2) not null default 0,
  subtotal numeric(14,2) not null,
  price_override_reason text,
  created_at timestamptz not null default now(),
  constraint transaction_items_amounts_valid check (
    qty > 0
    and unit_price >= 0
    and master_price >= 0
    and discount >= 0
    and subtotal >= 0
  )
);

create index transaction_items_transaction_id_idx on public.transaction_items (transaction_id);
create index transaction_items_product_id_idx on public.transaction_items (product_id);

create table public.stock_movements (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id),
  type public.stock_movement_type not null,
  qty numeric(14,3) not null,
  reference_type text,
  reference_id uuid,
  notes text,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  constraint stock_movements_qty_positive check (qty > 0)
);

create index stock_movements_product_created_idx on public.stock_movements (product_id, created_at);
create index stock_movements_reference_idx on public.stock_movements (reference_type, reference_id);

create table public.app_settings (
  id boolean primary key default true,
  store_name text not null default 'SmartPOS',
  store_address text,
  telegram_chat_id text,
  notification_preferences jsonb not null default '{}'::jsonb,
  daily_report_time time,
  dnd_start time,
  dnd_end time,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint app_settings_single_row check (id = true),
  constraint app_settings_store_name_not_empty check (length(trim(store_name)) > 0)
);

insert into public.app_settings (id) values (true);

create table public.notification_log (
  id uuid primary key default gen_random_uuid(),
  type text not null,
  dedupe_key text,
  message text not null,
  status public.notification_status not null default 'pending',
  error_message text,
  sent_at timestamptz,
  created_at timestamptz not null default now()
);

create index notification_log_dedupe_created_idx on public.notification_log (dedupe_key, created_at);
create index notification_log_status_created_idx on public.notification_log (status, created_at);

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.profiles(id),
  action text not null,
  entity_type text not null,
  entity_id uuid,
  before_data jsonb,
  after_data jsonb,
  created_at timestamptz not null default now()
);

create index audit_logs_actor_created_idx on public.audit_logs (actor_id, created_at);
create index audit_logs_entity_idx on public.audit_logs (entity_type, entity_id);

create trigger profiles_set_updated_at before update on public.profiles for each row execute function public.set_updated_at();
create trigger categories_set_updated_at before update on public.categories for each row execute function public.set_updated_at();
create trigger products_set_updated_at before update on public.products for each row execute function public.set_updated_at();
create trigger customers_set_updated_at before update on public.customers for each row execute function public.set_updated_at();
create trigger suppliers_set_updated_at before update on public.suppliers for each row execute function public.set_updated_at();
create trigger product_suppliers_set_updated_at before update on public.product_suppliers for each row execute function public.set_updated_at();
create trigger shifts_set_updated_at before update on public.shifts for each row execute function public.set_updated_at();
create trigger transactions_set_updated_at before update on public.transactions for each row execute function public.set_updated_at();
create trigger app_settings_set_updated_at before update on public.app_settings for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, role, name)
  values (
    new.id,
    coalesce((new.raw_user_meta_data ->> 'role')::public.user_role, 'cashier'),
    coalesce(nullif(trim(new.raw_user_meta_data ->> 'name'), ''), split_part(new.email, '@', 1), 'User')
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

create or replace function public.current_user_role()
returns public.user_role
language sql
stable
security definer
set search_path = public
as $$
  select role
  from public.profiles
  where id = auth.uid()
    and is_active = true
$$;

create or replace function public.is_manager_or_owner()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_user_role() in ('manager', 'owner')
$$;

create or replace function public.is_owner()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_user_role() = 'owner'
$$;

create or replace function public.apply_stock_movement()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  delta numeric(14,3);
begin
  delta := case
    when new.type in ('purchase', 'return', 'adjustment_in', 'void') then new.qty
    when new.type in ('sale', 'adjustment_out') then -new.qty
    else 0
  end;

  update public.products
  set stock_qty = stock_qty + delta
  where id = new.product_id;

  if not found then
    raise exception 'Product % not found', new.product_id;
  end if;

  if exists (select 1 from public.products where id = new.product_id and stock_qty < 0) then
    raise exception 'Insufficient stock for product %', new.product_id;
  end if;

  return new;
end;
$$;

create trigger stock_movements_apply_stock
after insert on public.stock_movements
for each row execute function public.apply_stock_movement();

create or replace function public.create_paid_transaction(
  p_client_transaction_id uuid,
  p_idempotency_key text,
  p_invoice_no text,
  p_customer_id uuid,
  p_type public.customer_type,
  p_payment_method public.payment_method,
  p_subtotal numeric,
  p_discount numeric,
  p_total numeric,
  p_cash_paid numeric,
  p_change numeric,
  p_shift_id uuid,
  p_items jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_transaction_id uuid;
  v_cashier_id uuid := auth.uid();
  v_item jsonb;
  v_product public.products%rowtype;
begin
  if v_cashier_id is null then
    raise exception 'Authentication required';
  end if;

  if public.current_user_role() is null then
    raise exception 'Active profile required';
  end if;

  select id
  into v_transaction_id
  from public.transactions
  where idempotency_key = p_idempotency_key;

  if v_transaction_id is not null then
    return v_transaction_id;
  end if;

  if not exists (
    select 1
    from public.shifts
    where id = p_shift_id
      and cashier_id = v_cashier_id
      and status = 'open'
  ) then
    raise exception 'Open shift is required';
  end if;

  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Transaction items are required';
  end if;

  insert into public.transactions (
    client_transaction_id,
    idempotency_key,
    invoice_no,
    cashier_id,
    customer_id,
    type,
    payment_method,
    subtotal,
    discount,
    total,
    cash_paid,
    change,
    shift_id,
    status,
    synced_at
  )
  values (
    p_client_transaction_id,
    p_idempotency_key,
    p_invoice_no,
    v_cashier_id,
    p_customer_id,
    p_type,
    p_payment_method,
    p_subtotal,
    coalesce(p_discount, 0),
    p_total,
    p_cash_paid,
    p_change,
    p_shift_id,
    'paid',
    now()
  )
  returning id into v_transaction_id;

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    select *
    into v_product
    from public.products
    where id = (v_item ->> 'product_id')::uuid
      and is_active = true
    for update;

    if not found then
      raise exception 'Product % not found or inactive', v_item ->> 'product_id';
    end if;

    insert into public.transaction_items (
      transaction_id,
      product_id,
      qty,
      unit_price,
      master_price,
      discount,
      subtotal,
      price_override_reason
    )
    values (
      v_transaction_id,
      v_product.id,
      (v_item ->> 'qty')::numeric,
      (v_item ->> 'unit_price')::numeric,
      coalesce((v_item ->> 'master_price')::numeric, v_product.price_retail),
      coalesce((v_item ->> 'discount')::numeric, 0),
      (v_item ->> 'subtotal')::numeric,
      nullif(v_item ->> 'price_override_reason', '')
    );

    insert into public.stock_movements (
      product_id,
      type,
      qty,
      reference_type,
      reference_id,
      notes,
      created_by
    )
    values (
      v_product.id,
      'sale',
      (v_item ->> 'qty')::numeric,
      'transaction',
      v_transaction_id,
      'Sale transaction',
      v_cashier_id
    );
  end loop;

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, after_data)
  values (v_cashier_id, 'transaction.created', 'transactions', v_transaction_id, jsonb_build_object('id', v_transaction_id));

  return v_transaction_id;
end;
$$;

create or replace function public.sync_transaction(
  p_client_transaction_id uuid,
  p_idempotency_key text,
  p_invoice_no text,
  p_customer_id uuid,
  p_type public.customer_type,
  p_payment_method public.payment_method,
  p_subtotal numeric,
  p_discount numeric,
  p_total numeric,
  p_cash_paid numeric,
  p_change numeric,
  p_shift_id uuid,
  p_items jsonb
)
returns uuid
language sql
security definer
set search_path = public
as $$
  select public.create_paid_transaction(
    p_client_transaction_id,
    p_idempotency_key,
    p_invoice_no,
    p_customer_id,
    p_type,
    p_payment_method,
    p_subtotal,
    p_discount,
    p_total,
    p_cash_paid,
    p_change,
    p_shift_id,
    p_items
  )
$$;

create or replace function public.void_transaction(
  p_transaction_id uuid,
  p_reason text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_id uuid := auth.uid();
  v_transaction public.transactions%rowtype;
  v_item public.transaction_items%rowtype;
begin
  if v_actor_id is null then
    raise exception 'Authentication required';
  end if;

  if length(trim(coalesce(p_reason, ''))) = 0 then
    raise exception 'Void reason is required';
  end if;

  select *
  into v_transaction
  from public.transactions
  where id = p_transaction_id
  for update;

  if not found then
    raise exception 'Transaction not found';
  end if;

  if v_transaction.status = 'voided' then
    return;
  end if;

  if public.current_user_role() = 'cashier' and v_transaction.cashier_id <> v_actor_id then
    raise exception 'Cashier can only void own transaction';
  end if;

  if public.current_user_role() is null then
    raise exception 'Active profile required';
  end if;

  update public.transactions
  set status = 'voided',
      voided_at = now(),
      voided_by = v_actor_id,
      void_reason = p_reason
  where id = p_transaction_id;

  for v_item in
    select * from public.transaction_items where transaction_id = p_transaction_id
  loop
    insert into public.stock_movements (
      product_id,
      type,
      qty,
      reference_type,
      reference_id,
      notes,
      created_by
    )
    values (
      v_item.product_id,
      'void',
      v_item.qty,
      'transaction',
      p_transaction_id,
      p_reason,
      v_actor_id
    );
  end loop;

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, before_data, after_data)
  values (
    v_actor_id,
    'transaction.voided',
    'transactions',
    p_transaction_id,
    to_jsonb(v_transaction),
    jsonb_build_object('status', 'voided', 'void_reason', p_reason)
  );
end;
$$;

create or replace function public.verify_cashier_pin(
  p_cashier_id uuid,
  p_pin text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pin_hash text;
begin
  select pin_hash
  into v_pin_hash
  from public.profiles
  where id = p_cashier_id
    and role = 'cashier'
    and is_active = true;

  if v_pin_hash is null then
    return false;
  end if;

  return crypt(p_pin, v_pin_hash) = v_pin_hash;
end;
$$;

alter table public.profiles enable row level security;
alter table public.categories enable row level security;
alter table public.products enable row level security;
alter table public.customers enable row level security;
alter table public.suppliers enable row level security;
alter table public.product_suppliers enable row level security;
alter table public.shifts enable row level security;
alter table public.transactions enable row level security;
alter table public.transaction_items enable row level security;
alter table public.stock_movements enable row level security;
alter table public.app_settings enable row level security;
alter table public.notification_log enable row level security;
alter table public.audit_logs enable row level security;

create policy "profiles can read own profile"
on public.profiles for select
to authenticated
using (id = auth.uid() or public.is_manager_or_owner());

create policy "owners can manage profiles"
on public.profiles for all
to authenticated
using (public.is_owner())
with check (public.is_owner());

create policy "authenticated can read active categories"
on public.categories for select
to authenticated
using (is_active = true or public.is_manager_or_owner());

create policy "managers can manage categories"
on public.categories for all
to authenticated
using (public.is_manager_or_owner())
with check (public.is_manager_or_owner());

create policy "authenticated can read active products"
on public.products for select
to authenticated
using (is_active = true or public.is_manager_or_owner());

create policy "managers can manage products"
on public.products for all
to authenticated
using (public.is_manager_or_owner())
with check (public.is_manager_or_owner());

create policy "authenticated can read active customers"
on public.customers for select
to authenticated
using (is_active = true or public.is_manager_or_owner());

create policy "managers can manage customers"
on public.customers for all
to authenticated
using (public.is_manager_or_owner())
with check (public.is_manager_or_owner());

create policy "managers can manage suppliers"
on public.suppliers for all
to authenticated
using (public.is_manager_or_owner())
with check (public.is_manager_or_owner());

create policy "managers can manage product suppliers"
on public.product_suppliers for all
to authenticated
using (public.is_manager_or_owner())
with check (public.is_manager_or_owner());

create policy "cashiers can read own shifts"
on public.shifts for select
to authenticated
using (cashier_id = auth.uid() or public.is_manager_or_owner());

create policy "cashiers can insert own shifts"
on public.shifts for insert
to authenticated
with check (cashier_id = auth.uid() and public.current_user_role() is not null);

create policy "cashiers can update own open shifts"
on public.shifts for update
to authenticated
using ((cashier_id = auth.uid() and status = 'open') or public.is_manager_or_owner())
with check ((cashier_id = auth.uid()) or public.is_manager_or_owner());

create policy "users can read relevant transactions"
on public.transactions for select
to authenticated
using (cashier_id = auth.uid() or public.is_manager_or_owner());

create policy "users can read relevant transaction items"
on public.transaction_items for select
to authenticated
using (
  exists (
    select 1 from public.transactions t
    where t.id = transaction_id
      and (t.cashier_id = auth.uid() or public.is_manager_or_owner())
  )
);

create policy "users can read relevant stock movements"
on public.stock_movements for select
to authenticated
using (created_by = auth.uid() or public.is_manager_or_owner());

create policy "managers can insert stock movements"
on public.stock_movements for insert
to authenticated
with check (public.is_manager_or_owner());

create policy "owners can manage app settings"
on public.app_settings for all
to authenticated
using (public.is_owner())
with check (public.is_owner());

create policy "managers can read notification log"
on public.notification_log for select
to authenticated
using (public.is_manager_or_owner());

create policy "owners can manage notification log"
on public.notification_log for all
to authenticated
using (public.is_owner())
with check (public.is_owner());

create policy "owners can read audit logs"
on public.audit_logs for select
to authenticated
using (public.is_owner());

revoke all on function public.create_paid_transaction(
  uuid,
  text,
  text,
  uuid,
  public.customer_type,
  public.payment_method,
  numeric,
  numeric,
  numeric,
  numeric,
  numeric,
  uuid,
  jsonb
) from public;

revoke all on function public.sync_transaction(
  uuid,
  text,
  text,
  uuid,
  public.customer_type,
  public.payment_method,
  numeric,
  numeric,
  numeric,
  numeric,
  numeric,
  uuid,
  jsonb
) from public;

revoke all on function public.void_transaction(uuid, text) from public;
revoke all on function public.verify_cashier_pin(uuid, text) from public;

grant execute on function public.create_paid_transaction(
  uuid,
  text,
  text,
  uuid,
  public.customer_type,
  public.payment_method,
  numeric,
  numeric,
  numeric,
  numeric,
  numeric,
  uuid,
  jsonb
) to authenticated;

grant execute on function public.sync_transaction(
  uuid,
  text,
  text,
  uuid,
  public.customer_type,
  public.payment_method,
  numeric,
  numeric,
  numeric,
  numeric,
  numeric,
  uuid,
  jsonb
) to authenticated;

grant execute on function public.void_transaction(uuid, text) to authenticated;
grant execute on function public.verify_cashier_pin(uuid, text) to authenticated;

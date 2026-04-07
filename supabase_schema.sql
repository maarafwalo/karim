-- ══════════════════════════════════════════════════════════════
-- JOUD POS — Supabase PostgreSQL Schema
-- Run this in: Supabase Dashboard → SQL Editor → New Query
-- ══════════════════════════════════════════════════════════════

-- EXTENSIONS
create extension if not exists "uuid-ossp";

-- ── TYPES ──────────────────────────────────────────────────────
create type user_role      as enum ('admin','cashier','vendor','stock_manager');
create type invoice_status as enum ('pending','confirmed','delivered','cancelled','returned');
create type payment_method as enum ('cash','card','credit','check','debt');
create type order_status   as enum ('new','processing','shipped','delivered','cancelled');

-- ── PROFILES ────────────────────────────────────────────────────
create table profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  full_name    text not null default '',
  role         user_role not null default 'vendor',
  phone        text,
  vendor_code  text unique,
  commission   numeric(5,2) default 0,
  is_active    boolean default true,
  created_at   timestamptz default now(),
  updated_at   timestamptz default now()
);

create or replace function handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into profiles (id, full_name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    coalesce((new.raw_user_meta_data->>'role')::user_role, 'vendor')
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- ── STORE SETTINGS ──────────────────────────────────────────────
create table store_settings (
  id           integer primary key default 1 check (id = 1),
  store_name   text not null default 'joud',
  phone        text not null default '212761568529',
  currency     text not null default 'درهم',
  tva_rate     numeric(5,2) not null default 0,
  cashier_name text default '',
  logo_url     text,
  updated_at   timestamptz default now(),
  updated_by   uuid references profiles(id)
);
insert into store_settings (id) values (1) on conflict do nothing;

-- ── CATEGORIES ──────────────────────────────────────────────────
create table categories (
  id         serial primary key,
  name       text not null unique,
  emoji      text not null default '📦',
  sort_order integer not null default 0,
  is_active  boolean not null default true,
  created_at timestamptz default now()
);

-- ── PRODUCTS ────────────────────────────────────────────────────
create table products (
  id           serial primary key,
  legacy_id    integer unique,
  name         text not null,
  category_id  integer references categories(id) on delete set null,
  size         text default '',
  sell_price   numeric(10,2) not null,
  cost_price   numeric(10,2) default 0,
  barcode      text,
  emoji        text default '📦',
  image_url    text,
  stock        integer,
  is_active    boolean not null default true,
  is_hidden    boolean not null default false,
  created_at   timestamptz default now(),
  updated_at   timestamptz default now()
);

create index idx_products_category on products(category_id);
create index idx_products_barcode  on products(barcode);
create index idx_products_active   on products(is_active, is_hidden);

-- Margin view
create view products_with_margin as
select *,
  case when sell_price > 0 and cost_price > 0
    then round((sell_price - cost_price) / sell_price * 100, 1)
    else null
  end as margin_pct
from products;

-- ── STOCK LOG ────────────────────────────────────────────────────
create table stock_log (
  id         bigserial primary key,
  product_id integer references products(id) on delete cascade,
  old_stock  integer,
  new_stock  integer,
  reason     text default 'manual',
  changed_by uuid references profiles(id),
  created_at timestamptz default now()
);

-- ── CUSTOMERS ────────────────────────────────────────────────────
create table customers (
  id         bigserial primary key,
  name       text not null,
  phone      text,
  address    text,
  notes      text,
  created_by uuid references profiles(id),
  created_at timestamptz default now()
);

-- ── POS INVOICES ─────────────────────────────────────────────────
create table pos_invoices (
  id              bigserial primary key,
  order_number    text not null unique default 'INV-'||to_char(now(),'YYYYMMDD-HH24MISS'),
  customer_id     integer references customers(id),
  cashier_id      uuid references profiles(id),
  status          invoice_status not null default 'confirmed',
  payment_method  payment_method not null default 'cash',
  subtotal        numeric(10,2) not null default 0,
  discount_type   text check (discount_type in ('fixed','pct')) default 'fixed',
  discount_value  numeric(10,2) default 0,
  discount_amt    numeric(10,2) default 0,
  tva_rate        numeric(5,2) default 0,
  tva_amt         numeric(10,2) default 0,
  total           numeric(10,2) not null default 0,
  amount_paid     numeric(10,2) default 0,
  change_given    numeric(10,2) default 0,
  notes           text,
  printed_at      timestamptz,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

create table pos_invoice_items (
  id           bigserial primary key,
  invoice_id   bigint not null references pos_invoices(id) on delete cascade,
  product_id   integer references products(id),
  product_name text not null,
  unit_price   numeric(10,2) not null,
  cost_price   numeric(10,2) default 0,
  quantity     integer not null check (quantity > 0),
  total        numeric(10,2) not null,
  is_return    boolean default false
);

-- ── CATALOG ORDERS ───────────────────────────────────────────────
create table catalog_orders (
  id                bigserial primary key,
  order_number      text not null unique default 'ORD-'||to_char(now(),'YYYYMMDD-HH24MISS'),
  vendor_id         uuid references profiles(id),
  customer_name     text,
  customer_phone    text,
  customer_address  text,
  status            order_status not null default 'new',
  subtotal          numeric(10,2) not null default 0,
  total             numeric(10,2) not null default 0,
  notes             text,
  wa_sent           boolean default false,
  created_at        timestamptz default now(),
  updated_at        timestamptz default now()
);

create table catalog_order_items (
  id           bigserial primary key,
  order_id     bigint not null references catalog_orders(id) on delete cascade,
  product_id   integer references products(id),
  product_name text not null,
  unit_price   numeric(10,2) not null,
  quantity     integer not null check (quantity > 0),
  total        numeric(10,2) not null
);

-- ══════════════════════════════════════════════════════════════
-- ROW LEVEL SECURITY
-- ══════════════════════════════════════════════════════════════
alter table profiles           enable row level security;
alter table store_settings     enable row level security;
alter table categories         enable row level security;
alter table products           enable row level security;
alter table stock_log          enable row level security;
alter table customers          enable row level security;
alter table pos_invoices       enable row level security;
alter table pos_invoice_items  enable row level security;
alter table catalog_orders     enable row level security;
alter table catalog_order_items enable row level security;

create or replace function get_my_role()
returns user_role language sql security definer stable as $$
  select role from profiles where id = auth.uid()
$$;

-- Profiles: each user sees own; admin sees all
create policy "profiles_self"  on profiles for select using (id = auth.uid());
create policy "profiles_admin" on profiles for all    using (get_my_role() = 'admin');

-- Settings: admin only
create policy "settings_admin" on store_settings for all using (get_my_role() = 'admin');

-- Categories: everyone reads; admin writes
create policy "cats_read"  on categories for select using (is_active = true);
create policy "cats_write" on categories for all    using (get_my_role() = 'admin');

-- Products: everyone reads active; admin+stock write
create policy "prods_read"  on products for select using (is_active = true);
create policy "prods_write" on products for all    using (get_my_role() in ('admin','stock_manager'));

-- POS invoices: cashier+admin
create policy "inv_read"   on pos_invoices for select using (get_my_role() in ('admin','cashier'));
create policy "inv_insert" on pos_invoices for insert with check (get_my_role() in ('admin','cashier'));
create policy "inv_update" on pos_invoices for update using (get_my_role() in ('admin','cashier'));

create policy "inv_items_read"   on pos_invoice_items for select using (get_my_role() in ('admin','cashier'));
create policy "inv_items_insert" on pos_invoice_items for insert with check (get_my_role() in ('admin','cashier'));

-- Catalog orders: public insert; vendor sees own; admin sees all
create policy "cord_insert"  on catalog_orders for insert with check (true);
create policy "cord_vendor"  on catalog_orders for select using (vendor_id = auth.uid() or get_my_role() = 'admin');
create policy "cord_items_insert" on catalog_order_items for insert with check (true);
create policy "cord_items_read"   on catalog_order_items for select using (
  exists (select 1 from catalog_orders o where o.id = order_id and (o.vendor_id = auth.uid() or get_my_role() = 'admin'))
);

-- Customers: cashier+admin
create policy "cust_all" on customers for all using (get_my_role() in ('admin','cashier'));

-- Stock log: stock+admin
create policy "stocklog_all" on stock_log for all using (get_my_role() in ('admin','stock_manager'));

-- ══════════════════════════════════════════════════════════════
-- REALTIME
-- ══════════════════════════════════════════════════════════════
alter publication supabase_realtime add table products;
alter publication supabase_realtime add table pos_invoices;
alter publication supabase_realtime add table catalog_orders;

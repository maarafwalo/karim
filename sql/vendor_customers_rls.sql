-- ══════════════════════════════════════════════════════════════
-- Allow vendors (and admins) to manage customers + debt payments
-- so the workspace's customer picker and pay-debt buttons work.
-- ══════════════════════════════════════════════════════════════

-- Helper: current user's profile role
create or replace function public.current_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid()
$$;

-- ── customers table ───────────────────────────────────────────
alter table public.customers enable row level security;

drop policy if exists customers_select_all     on public.customers;
drop policy if exists customers_insert_vendor  on public.customers;
drop policy if exists customers_update_vendor  on public.customers;
drop policy if exists customers_delete_admin   on public.customers;

create policy customers_select_all
  on public.customers
  for select
  using (
    auth.uid() is not null
  );

create policy customers_insert_vendor
  on public.customers
  for insert
  to authenticated
  with check (
    public.current_role() in ('admin','vendor','cashier','store_manager','delivery')
  );

create policy customers_update_vendor
  on public.customers
  for update
  to authenticated
  using (
    public.current_role() in ('admin','vendor','cashier','store_manager','delivery')
  )
  with check (
    public.current_role() in ('admin','vendor','cashier','store_manager','delivery')
  );

create policy customers_delete_admin
  on public.customers
  for delete
  to authenticated
  using (
    public.current_role() in ('admin','store_manager')
  );

-- ── debt_payments table ────────────────────────────────────────
alter table public.debt_payments enable row level security;

drop policy if exists debt_payments_select_all    on public.debt_payments;
drop policy if exists debt_payments_insert_vendor on public.debt_payments;

create policy debt_payments_select_all
  on public.debt_payments
  for select
  using (auth.uid() is not null);

create policy debt_payments_insert_vendor
  on public.debt_payments
  for insert
  to authenticated
  with check (
    public.current_role() in ('admin','vendor','cashier','store_manager','delivery')
  );

-- ══════════════════════════════════════════════════════════════
-- Admin / store_manager can read all catalog_orders
-- (Without this, the إدارة → 'طلبات الباعة' tab hangs because
--  RLS only lets each user see their own orders.)
-- Depends on the public.app_user_role() helper from
-- sql/vendor_customers_rls.sql — run that one first.
-- ══════════════════════════════════════════════════════════════

alter table public.catalog_orders enable row level security;

drop policy if exists catalog_orders_select_admin on public.catalog_orders;
drop policy if exists catalog_orders_select_own   on public.catalog_orders;
drop policy if exists catalog_orders_insert_self  on public.catalog_orders;
drop policy if exists catalog_orders_insert_any   on public.catalog_orders;
drop policy if exists catalog_orders_update_admin on public.catalog_orders;
drop policy if exists catalog_orders_update_own   on public.catalog_orders;
drop policy if exists catalog_orders_delete_admin on public.catalog_orders;

-- Owner / admin / store_manager / stock_manager can SELECT every order
create policy catalog_orders_select_admin
  on public.catalog_orders
  for select
  using (
    auth.uid() = vendor_id
    or public.app_user_role() in ('admin','store_manager','stock_manager')
  );

-- Vendors can INSERT their own orders. WITHOUT this policy, RLS silently
-- blocks every save from /workspace and orders never reach the admin tab.
create policy catalog_orders_insert_self
  on public.catalog_orders
  for insert
  to authenticated
  with check (auth.uid() = vendor_id);

-- Vendors can UPDATE / DELETE their own pending orders (re-save while editing).
create policy catalog_orders_update_own
  on public.catalog_orders
  for update
  to authenticated
  using (auth.uid() = vendor_id)
  with check (auth.uid() = vendor_id);

-- Admin + store_manager can update any order (mark invoiced, change status…)
create policy catalog_orders_update_admin
  on public.catalog_orders
  for update
  to authenticated
  using (public.app_user_role() in ('admin','store_manager'))
  with check (public.app_user_role() in ('admin','store_manager'));

-- Admin can delete any order (vendor cleanup, mistakes…)
create policy catalog_orders_delete_admin
  on public.catalog_orders
  for delete
  to authenticated
  using (public.app_user_role() in ('admin','store_manager'));

-- Same for catalog_order_items
alter table public.catalog_order_items enable row level security;

drop policy if exists catalog_order_items_select_admin on public.catalog_order_items;
drop policy if exists catalog_order_items_insert_self  on public.catalog_order_items;
drop policy if exists catalog_order_items_delete_own   on public.catalog_order_items;
drop policy if exists catalog_order_items_delete_admin on public.catalog_order_items;

create policy catalog_order_items_select_admin
  on public.catalog_order_items
  for select
  using (
    public.app_user_role() in ('admin','store_manager','stock_manager')
    or order_id in (select id from public.catalog_orders where vendor_id = auth.uid())
  );

-- Vendors can INSERT items only into their own orders.
create policy catalog_order_items_insert_self
  on public.catalog_order_items
  for insert
  to authenticated
  with check (
    order_id in (select id from public.catalog_orders where vendor_id = auth.uid())
  );

-- Vendors can DELETE items from their own orders (the edit-order flow
-- deletes + re-inserts items as a unit).
create policy catalog_order_items_delete_own
  on public.catalog_order_items
  for delete
  to authenticated
  using (
    order_id in (select id from public.catalog_orders where vendor_id = auth.uid())
  );

create policy catalog_order_items_delete_admin
  on public.catalog_order_items
  for delete
  to authenticated
  using (public.app_user_role() in ('admin','store_manager'));

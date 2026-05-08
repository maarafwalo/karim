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
drop policy if exists catalog_orders_update_admin on public.catalog_orders;
drop policy if exists catalog_orders_delete_admin on public.catalog_orders;

-- Owner / admin / store_manager / stock_manager can SELECT every order
create policy catalog_orders_select_admin
  on public.catalog_orders
  for select
  using (
    auth.uid() = vendor_id
    or public.app_user_role() in ('admin','store_manager','stock_manager')
  );

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
drop policy if exists catalog_order_items_delete_admin on public.catalog_order_items;

create policy catalog_order_items_select_admin
  on public.catalog_order_items
  for select
  using (
    public.app_user_role() in ('admin','store_manager','stock_manager')
    or order_id in (select id from public.catalog_orders where vendor_id = auth.uid())
  );

create policy catalog_order_items_delete_admin
  on public.catalog_order_items
  for delete
  to authenticated
  using (public.app_user_role() in ('admin','store_manager'));

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
-- Hardened: vendors can't forge partner requests or skip the cash-out step
-- by self-marking 'invoiced'/'paid'.
create policy catalog_orders_insert_self
  on public.catalog_orders
  for insert
  to authenticated
  with check (
    auth.uid() = vendor_id
    and is_partner_request = false
    and status in ('new','draft')
  );

-- Vendors can UPDATE their own PENDING orders only (edit flow). Once the
-- POS has invoiced an order, vendors can no longer mutate it — the receipt
-- is the source of truth from that point. Status transitions (new → invoiced)
-- are reserved for admin/store_manager (policy below).
create policy catalog_orders_update_own
  on public.catalog_orders
  for update
  to authenticated
  using  (auth.uid() = vendor_id and status in ('new','draft'))
  with check (auth.uid() = vendor_id and status in ('new','draft'));

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

-- Vendors can INSERT items only into their own PENDING orders. After cash-out
-- (status='invoiced'), the line items are frozen as the receipt of record.
create policy catalog_order_items_insert_self
  on public.catalog_order_items
  for insert
  to authenticated
  with check (
    order_id in (
      select id from public.catalog_orders
      where vendor_id = auth.uid() and status in ('new','draft')
    )
  );

-- Vendors can DELETE items only from their own PENDING orders (edit-order
-- flow does delete + re-insert as a unit). Cashed-out orders are immutable.
create policy catalog_order_items_delete_own
  on public.catalog_order_items
  for delete
  to authenticated
  using (
    order_id in (
      select id from public.catalog_orders
      where vendor_id = auth.uid() and status in ('new','draft')
    )
  );

create policy catalog_order_items_delete_admin
  on public.catalog_order_items
  for delete
  to authenticated
  using (public.app_user_role() in ('admin','store_manager'));

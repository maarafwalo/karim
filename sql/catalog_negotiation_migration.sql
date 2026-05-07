-- ══════════════════════════════════════════════════════════════
-- Catalog price negotiation tracking
-- Add columns so the admin can see when a vendor changed a price
-- ══════════════════════════════════════════════════════════════

alter table catalog_order_items
  add column if not exists original_price numeric(10,2),
  add column if not exists negotiated     boolean default false,
  add column if not exists price_diff     numeric(10,2) default 0;

-- Helpful index for admin dashboard filters
create index if not exists catalog_order_items_negotiated_idx
  on catalog_order_items (negotiated)
  where negotiated = true;

comment on column catalog_order_items.original_price is 'Catalog reference price at time of order (for vendor negotiation audit)';
comment on column catalog_order_items.negotiated     is 'true if vendor changed unit_price away from original_price';
comment on column catalog_order_items.price_diff     is 'unit_price - original_price (positive = markup, negative = discount)';

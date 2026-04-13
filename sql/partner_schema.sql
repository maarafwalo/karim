-- ============================================================
-- Partner Orders Schema
-- Run this in: Supabase Dashboard → SQL Editor
-- ============================================================

-- 1. Partner orders table
CREATE TABLE IF NOT EXISTS partner_orders (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  partner_id    UUID REFERENCES auth.users(id),
  partner_name  TEXT,
  order_number  TEXT UNIQUE,
  total_amount  NUMERIC(10,2) DEFAULT 0,
  is_verified   BOOLEAN DEFAULT FALSE,
  verified_at   TIMESTAMPTZ,
  verified_by   UUID,
  notes         TEXT
);

-- 2. Partner order items table
CREATE TABLE IF NOT EXISTS partner_order_items (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  order_id          UUID REFERENCES partner_orders(id) ON DELETE CASCADE,
  product_id        UUID,
  product_name      TEXT,
  quantity          INT NOT NULL DEFAULT 1,
  custom_unit_price NUMERIC(10,2) DEFAULT 0,
  total             NUMERIC(10,2) DEFAULT 0
);

-- 3. Enable RLS
ALTER TABLE partner_orders      ENABLE ROW LEVEL SECURITY;
ALTER TABLE partner_order_items ENABLE ROW LEVEL SECURITY;

-- 4. RLS Policies — partner_orders
CREATE POLICY "partner_orders_insert" ON partner_orders
  FOR INSERT WITH CHECK (auth.uid() = partner_id);

CREATE POLICY "partner_orders_select_own" ON partner_orders
  FOR SELECT USING (
    auth.uid() = partner_id
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role IN ('admin', 'stock_manager')
    )
  );

CREATE POLICY "partner_orders_update_admin" ON partner_orders
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- 5. RLS Policies — partner_order_items
CREATE POLICY "partner_order_items_insert" ON partner_order_items
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM partner_orders
      WHERE id = order_id AND partner_id = auth.uid()
    )
  );

CREATE POLICY "partner_order_items_select" ON partner_order_items
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM partner_orders po
      WHERE po.id = order_id AND (
        po.partner_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM profiles
          WHERE id = auth.uid() AND role IN ('admin', 'stock_manager')
        )
      )
    )
  );

-- 6. Atomic submit RPC
-- Inserts order + items, decrements stock — all in one transaction
CREATE OR REPLACE FUNCTION submit_partner_order(
  p_partner_id    UUID,
  p_partner_name  TEXT,
  p_order_number  TEXT,
  p_items         JSONB,   -- [{product_id, product_name, quantity, custom_unit_price}]
  p_notes         TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_total    NUMERIC := 0;
  v_order_id UUID;
  v_item     JSONB;
BEGIN
  -- Calculate total
  SELECT COALESCE(
    SUM((item->>'quantity')::INT * (item->>'custom_unit_price')::NUMERIC), 0
  )
  INTO v_total
  FROM jsonb_array_elements(p_items) item;

  -- Insert order (is_verified = false by default)
  INSERT INTO partner_orders (
    partner_id, partner_name, order_number, total_amount, is_verified, notes
  ) VALUES (
    p_partner_id, p_partner_name, p_order_number, v_total, FALSE, p_notes
  ) RETURNING id INTO v_order_id;

  -- Process each item atomically
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    -- Insert item record
    INSERT INTO partner_order_items (
      order_id,
      product_id,
      product_name,
      quantity,
      custom_unit_price,
      total
    ) VALUES (
      v_order_id,
      (v_item->>'product_id')::UUID,
      v_item->>'product_name',
      (v_item->>'quantity')::INT,
      (v_item->>'custom_unit_price')::NUMERIC,
      (v_item->>'quantity')::INT * (v_item->>'custom_unit_price')::NUMERIC
    );

    -- Atomic stock decrement (floor at 0, skip if stock is NULL)
    UPDATE products
    SET   stock      = GREATEST(0, COALESCE(stock, 0) - (v_item->>'quantity')::INT),
          updated_at = NOW()
    WHERE id = (v_item->>'product_id')::UUID
      AND stock IS NOT NULL;
  END LOOP;

  RETURN jsonb_build_object(
    'order_id',     v_order_id,
    'order_number', p_order_number,
    'total',        v_total
  );
END;
$$;

-- 7. Admin verify RPC
CREATE OR REPLACE FUNCTION verify_partner_order(
  p_order_id UUID,
  p_admin_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Only admins can verify
  IF NOT EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Unauthorized: admin only';
  END IF;

  UPDATE partner_orders
  SET   is_verified = TRUE,
        verified_at = NOW(),
        verified_by = p_admin_id
  WHERE id = p_order_id
    AND is_verified = FALSE;
END;
$$;

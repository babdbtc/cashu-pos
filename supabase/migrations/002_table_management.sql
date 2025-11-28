-- CashuPay POS System - Table Management
-- Migration 002: Add table/floor management for restaurant service

-- ============================================
-- TABLE AREAS (Sections/Zones)
-- ============================================
CREATE TABLE table_areas (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  color TEXT,  -- For visual identification
  sort_order INTEGER NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_table_areas_store ON table_areas(store_id);
CREATE INDEX idx_table_areas_sort ON table_areas(store_id, sort_order);

-- ============================================
-- TABLES
-- ============================================
CREATE TABLE tables (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  area_id UUID REFERENCES table_areas(id) ON DELETE SET NULL,
  number TEXT NOT NULL,  -- Table number/name (e.g., "A1", "Patio 5")
  capacity INTEGER NOT NULL DEFAULT 4,
  status TEXT NOT NULL DEFAULT 'available' CHECK (status IN ('available', 'occupied', 'reserved', 'cleaning', 'unavailable')),
  position JSONB,  -- Optional: {x: 100, y: 200} for floor plan visualization
  shape TEXT DEFAULT 'square' CHECK (shape IN ('square', 'round', 'rectangle', 'custom')),
  metadata JSONB NOT NULL DEFAULT '{}',  -- Additional info (min_party_size, notes, etc.)
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(store_id, number)
);

CREATE INDEX idx_tables_store ON tables(store_id);
CREATE INDEX idx_tables_area ON tables(area_id) WHERE area_id IS NOT NULL;
CREATE INDEX idx_tables_status ON tables(store_id, status);
CREATE INDEX idx_tables_number ON tables(store_id, number);

-- ============================================
-- TABLE ASSIGNMENTS (Waiter → Table)
-- ============================================
CREATE TABLE table_assignments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  table_id UUID NOT NULL REFERENCES tables(id) ON DELETE CASCADE,
  staff_id UUID NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  assigned_by UUID REFERENCES staff(id) ON DELETE SET NULL,
  active BOOLEAN NOT NULL DEFAULT true,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_table_assignments_table ON table_assignments(table_id);
CREATE INDEX idx_table_assignments_staff ON table_assignments(staff_id);
CREATE INDEX idx_table_assignments_active ON table_assignments(table_id, active) WHERE active = true;

-- ============================================
-- UPDATE ORDERS TABLE
-- Add table_id and area_id to link orders to tables
-- ============================================
ALTER TABLE orders ADD COLUMN table_id UUID REFERENCES tables(id) ON DELETE SET NULL;
ALTER TABLE orders ADD COLUMN area_id UUID REFERENCES table_areas(id) ON DELETE SET NULL;

CREATE INDEX idx_orders_table ON orders(table_id) WHERE table_id IS NOT NULL;
CREATE INDEX idx_orders_area ON orders(area_id) WHERE area_id IS NOT NULL;

-- ============================================
-- UPDATE STAFF TABLE
-- Add waiter role
-- ============================================
-- Drop the existing CHECK constraint on role
ALTER TABLE staff DROP CONSTRAINT IF EXISTS staff_role_check;

-- Add new constraint with 'waiter' role
ALTER TABLE staff ADD CONSTRAINT staff_role_check
  CHECK (role IN ('owner', 'manager', 'cashier', 'kitchen', 'waiter'));

-- ============================================
-- FUNCTIONS
-- ============================================

-- Auto-update table status based on orders
CREATE OR REPLACE FUNCTION update_table_status()
RETURNS TRIGGER AS $$
BEGIN
  -- When order is created or updated to non-completed status for a table
  IF NEW.table_id IS NOT NULL THEN
    IF NEW.status IN ('pending', 'preparing') THEN
      UPDATE tables
      SET status = 'occupied', updated_at = NOW()
      WHERE id = NEW.table_id AND status != 'occupied';
    ELSIF NEW.status IN ('completed', 'cancelled') THEN
      -- Check if there are any other active orders for this table
      IF NOT EXISTS (
        SELECT 1 FROM orders
        WHERE table_id = NEW.table_id
          AND id != NEW.id
          AND status IN ('pending', 'preparing', 'ready')
      ) THEN
        UPDATE tables
        SET status = 'available', updated_at = NOW()
        WHERE id = NEW.table_id AND status = 'occupied';
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- TRIGGERS
-- ============================================

-- Update updated_at timestamps
CREATE TRIGGER update_table_areas_updated_at BEFORE UPDATE ON table_areas
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_tables_updated_at BEFORE UPDATE ON tables
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_table_assignments_updated_at BEFORE UPDATE ON table_assignments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Auto-update table status based on orders
CREATE TRIGGER on_order_status_change
  AFTER INSERT OR UPDATE ON orders
  FOR EACH ROW
  WHEN (NEW.table_id IS NOT NULL)
  EXECUTE FUNCTION update_table_status();

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

ALTER TABLE table_areas ENABLE ROW LEVEL SECURITY;
ALTER TABLE tables ENABLE ROW LEVEL SECURITY;
ALTER TABLE table_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all for authenticated users" ON table_areas
  FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Allow all for authenticated users" ON tables
  FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Allow all for authenticated users" ON table_assignments
  FOR ALL USING (auth.role() = 'authenticated');

-- ============================================
-- ENABLE REALTIME
-- ============================================

ALTER PUBLICATION supabase_realtime ADD TABLE tables;
ALTER PUBLICATION supabase_realtime ADD TABLE table_assignments;

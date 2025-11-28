/**
 * Sample Data Generator
 *
 * Generates realistic test data for table management, staff, and products.
 * Useful for testing and development.
 */

import type { TableAreaRow, TableRow, StaffRow } from '@/types/database';
import type { Product } from '@/types/product';
import { useTableStore } from '@/store/table.store';
import { useStaffStore } from '@/store/staff.store';

// Sample table areas with realistic restaurant sections
export const sampleAreas: Omit<TableAreaRow, 'id' | 'created_at' | 'updated_at'>[] = [
  {
    store_id: 'local',
    name: 'Main Dining',
    description: 'Indoor main dining area',
    color: '#3b82f6', // Blue
    sort_order: 1,
    active: true,
  },
  {
    store_id: 'local',
    name: 'Patio',
    description: 'Outdoor seating area',
    color: '#10b981', // Green
    sort_order: 2,
    active: true,
  },
  {
    store_id: 'local',
    name: 'Bar',
    description: 'Bar and lounge area',
    color: '#f59e0b', // Amber
    sort_order: 3,
    active: true,
  },
  {
    store_id: 'local',
    name: 'Private Room',
    description: 'Private dining for events',
    color: '#8b5cf6', // Purple
    sort_order: 4,
    active: true,
  },
];

// Generate sample tables for each area
export function generateSampleTables(areaIds: string[]): Omit<TableRow, 'id' | 'created_at' | 'updated_at'>[] {
  const tables: Omit<TableRow, 'id' | 'created_at' | 'updated_at'>[] = [];

  // Main Dining - Tables 1-10 (larger capacity)
  if (areaIds[0]) {
    for (let i = 1; i <= 10; i++) {
      tables.push({
        store_id: 'local',
        area_id: areaIds[0],
        number: `${i}`,
        capacity: i <= 3 ? 2 : i <= 7 ? 4 : 6,
        status: 'available',
        shape: i % 3 === 0 ? 'round' : 'square',
        position: null,
        metadata: {},
        active: true,
      });
    }
  }

  // Patio - Tables P1-P6 (mixed capacity)
  if (areaIds[1]) {
    for (let i = 1; i <= 6; i++) {
      tables.push({
        store_id: 'local',
        area_id: areaIds[1],
        number: `P${i}`,
        capacity: i <= 2 ? 2 : i <= 4 ? 4 : 6,
        status: 'available',
        shape: i % 2 === 0 ? 'round' : 'rectangle',
        position: null,
        metadata: {},
        active: true,
      });
    }
  }

  // Bar - Tables B1-B4 (smaller capacity)
  if (areaIds[2]) {
    for (let i = 1; i <= 4; i++) {
      tables.push({
        store_id: 'local',
        area_id: areaIds[2],
        number: `B${i}`,
        capacity: 2,
        status: 'available',
        shape: 'square',
        position: null,
        metadata: {},
        active: true,
      });
    }
  }

  // Private Room - Tables VIP1-VIP2 (large capacity)
  if (areaIds[3]) {
    for (let i = 1; i <= 2; i++) {
      tables.push({
        store_id: 'local',
        area_id: areaIds[3],
        number: `VIP${i}`,
        capacity: i === 1 ? 8 : 12,
        status: 'available',
        shape: 'rectangle',
        position: null,
        metadata: {},
        active: true,
      });
    }
  }

  return tables;
}

// Sample staff members with various roles
export const sampleStaff: Omit<StaffRow, 'id' | 'created_at' | 'updated_at'>[] = [
  {
    store_id: 'local',
    name: 'Sarah Manager',
    role: 'manager',
    pin: '1234',
    active: true,
    metadata: {},
  },
  {
    store_id: 'local',
    name: 'Mike Cashier',
    role: 'cashier',
    pin: '2345',
    active: true,
    metadata: {},
  },
  {
    store_id: 'local',
    name: 'Emma Waiter',
    role: 'waiter',
    pin: '3456',
    active: true,
    metadata: {},
  },
  {
    store_id: 'local',
    name: 'James Waiter',
    role: 'waiter',
    pin: '4567',
    active: true,
    metadata: {},
  },
  {
    store_id: 'local',
    name: 'Olivia Waiter',
    role: 'waiter',
    pin: '5678',
    active: true,
    metadata: {},
  },
  {
    store_id: 'local',
    name: 'Tom Chef',
    role: 'kitchen',
    pin: '6789',
    active: true,
    metadata: {},
  },
];

// Sample menu items for testing orders
export const sampleProducts: Omit<Product, 'id' | 'created_at' | 'updated_at'>[] = [
  // Appetizers
  {
    name: 'Caesar Salad',
    description: 'Fresh romaine lettuce with parmesan and croutons',
    price: 8.99,
    category: 'Appetizers',
    image: null,
    active: true,
    store_id: 'local',
    sku: 'APP-001',
    barcode: null,
    inventory_tracking: false,
    stock_quantity: null,
    low_stock_threshold: null,
    cost_price: 3.50,
    tax_rate: 0.08,
    variants: [],
    modifiers: [],
  },
  {
    name: 'Buffalo Wings',
    description: 'Spicy chicken wings with blue cheese dip',
    price: 12.99,
    category: 'Appetizers',
    image: null,
    active: true,
    store_id: 'local',
    sku: 'APP-002',
    barcode: null,
    inventory_tracking: false,
    stock_quantity: null,
    low_stock_threshold: null,
    cost_price: 5.50,
    tax_rate: 0.08,
    variants: [],
    modifiers: [],
  },

  // Main Courses
  {
    name: 'Grilled Salmon',
    description: 'Fresh Atlantic salmon with seasonal vegetables',
    price: 24.99,
    category: 'Main Courses',
    image: null,
    active: true,
    store_id: 'local',
    sku: 'MAIN-001',
    barcode: null,
    inventory_tracking: false,
    stock_quantity: null,
    low_stock_threshold: null,
    cost_price: 12.00,
    tax_rate: 0.08,
    variants: [],
    modifiers: [],
  },
  {
    name: 'Classic Burger',
    description: 'Angus beef patty with lettuce, tomato, and fries',
    price: 16.99,
    category: 'Main Courses',
    image: null,
    active: true,
    store_id: 'local',
    sku: 'MAIN-002',
    barcode: null,
    inventory_tracking: false,
    stock_quantity: null,
    low_stock_threshold: null,
    cost_price: 7.50,
    tax_rate: 0.08,
    variants: [],
    modifiers: [],
  },
  {
    name: 'Margherita Pizza',
    description: 'Fresh mozzarella, tomato sauce, and basil',
    price: 14.99,
    category: 'Main Courses',
    image: null,
    active: true,
    store_id: 'local',
    sku: 'MAIN-003',
    barcode: null,
    inventory_tracking: false,
    stock_quantity: null,
    low_stock_threshold: null,
    cost_price: 6.00,
    tax_rate: 0.08,
    variants: [],
    modifiers: [],
  },
  {
    name: 'Ribeye Steak',
    description: '12oz premium ribeye with garlic butter',
    price: 32.99,
    category: 'Main Courses',
    image: null,
    active: true,
    store_id: 'local',
    sku: 'MAIN-004',
    barcode: null,
    inventory_tracking: false,
    stock_quantity: null,
    low_stock_threshold: null,
    cost_price: 16.00,
    tax_rate: 0.08,
    variants: [],
    modifiers: [],
  },

  // Desserts
  {
    name: 'Chocolate Lava Cake',
    description: 'Warm chocolate cake with molten center',
    price: 8.99,
    category: 'Desserts',
    image: null,
    active: true,
    store_id: 'local',
    sku: 'DESS-001',
    barcode: null,
    inventory_tracking: false,
    stock_quantity: null,
    low_stock_threshold: null,
    cost_price: 3.00,
    tax_rate: 0.08,
    variants: [],
    modifiers: [],
  },
  {
    name: 'Tiramisu',
    description: 'Classic Italian coffee-flavored dessert',
    price: 7.99,
    category: 'Desserts',
    image: null,
    active: true,
    store_id: 'local',
    sku: 'DESS-002',
    barcode: null,
    inventory_tracking: false,
    stock_quantity: null,
    low_stock_threshold: null,
    cost_price: 2.75,
    tax_rate: 0.08,
    variants: [],
    modifiers: [],
  },

  // Beverages
  {
    name: 'Craft Beer',
    description: 'Local IPA on tap',
    price: 6.99,
    category: 'Beverages',
    image: null,
    active: true,
    store_id: 'local',
    sku: 'BEV-001',
    barcode: null,
    inventory_tracking: false,
    stock_quantity: null,
    low_stock_threshold: null,
    cost_price: 2.50,
    tax_rate: 0.08,
    variants: [],
    modifiers: [],
  },
  {
    name: 'House Wine',
    description: 'Red or white wine by the glass',
    price: 8.99,
    category: 'Beverages',
    image: null,
    active: true,
    store_id: 'local',
    sku: 'BEV-002',
    barcode: null,
    inventory_tracking: false,
    stock_quantity: null,
    low_stock_threshold: null,
    cost_price: 3.00,
    tax_rate: 0.08,
    variants: [],
    modifiers: [],
  },
  {
    name: 'Soft Drink',
    description: 'Coke, Sprite, or Fanta',
    price: 2.99,
    category: 'Beverages',
    image: null,
    active: true,
    store_id: 'local',
    sku: 'BEV-003',
    barcode: null,
    inventory_tracking: false,
    stock_quantity: null,
    low_stock_threshold: null,
    cost_price: 0.75,
    tax_rate: 0.08,
    variants: [],
    modifiers: [],
  },
  {
    name: 'Coffee',
    description: 'Freshly brewed coffee',
    price: 3.99,
    category: 'Beverages',
    image: null,
    active: true,
    store_id: 'local',
    sku: 'BEV-004',
    barcode: null,
    inventory_tracking: false,
    stock_quantity: null,
    low_stock_threshold: null,
    cost_price: 0.50,
    tax_rate: 0.08,
    variants: [],
    modifiers: [],
  },
];

/**
 * Load sample data into stores
 */
export async function loadSampleData() {
  try {
    console.log('[SampleData] Starting to load sample data...');

    const tableStore = useTableStore.getState();
    const staffStore = useStaffStore.getState();

    console.log('[SampleData] Store states retrieved');

    // Store initial counts
    const initialAreaCount = tableStore.areas.length;
    const initialTableCount = tableStore.tables.length;
    const initialStaffCount = staffStore.staff.length;

    console.log(`[SampleData] Initial counts - Areas: ${initialAreaCount}, Tables: ${initialTableCount}, Staff: ${initialStaffCount}`);

    console.log('[SampleData] Loading sample areas...');

    // Add areas (store will auto-generate IDs)
    for (const area of sampleAreas) {
      console.log(`[SampleData] Adding area: ${area.name}`);
      tableStore.addArea(area);
      await new Promise(resolve => setTimeout(resolve, 50)); // Longer delay for state updates
    }

    // Force fresh state read
    await new Promise(resolve => setTimeout(resolve, 100));
    const freshTableStore = useTableStore.getState();
    const currentAreas = freshTableStore.areas;
    console.log(`[SampleData] Total areas in store: ${currentAreas.length}`);

    const newAreas = currentAreas.slice(initialAreaCount);
    const areaIds = newAreas.map(a => a.id);

    console.log(`[SampleData] Created ${areaIds.length} new areas`);

    console.log('[SampleData] Loading sample tables...');
    const tables = generateSampleTables(areaIds);
    console.log(`[SampleData] Generated ${tables.length} table definitions`);

    // Add tables (store will auto-generate IDs)
    for (let i = 0; i < tables.length; i++) {
      console.log(`[SampleData] Adding table ${i + 1}/${tables.length}: ${tables[i].number}`);
      freshTableStore.addTable(tables[i]);
      await new Promise(resolve => setTimeout(resolve, 50));
    }

    // Force fresh state read
    await new Promise(resolve => setTimeout(resolve, 100));
    const freshTableStore2 = useTableStore.getState();
    const currentTables = freshTableStore2.tables;
    console.log(`[SampleData] Total tables in store: ${currentTables.length}`);

    const newTables = currentTables.slice(initialTableCount);
    const tableIds = newTables.map(t => t.id);

    console.log(`[SampleData] Created ${tableIds.length} new tables`);

    console.log('[SampleData] Loading sample staff...');

    // Add staff (store will auto-generate IDs)
    for (let i = 0; i < sampleStaff.length; i++) {
      console.log(`[SampleData] Adding staff ${i + 1}/${sampleStaff.length}: ${sampleStaff[i].name} (${sampleStaff[i].role})`);
      staffStore.addStaff(sampleStaff[i]);
      await new Promise(resolve => setTimeout(resolve, 50));
    }

    // Force fresh state read
    await new Promise(resolve => setTimeout(resolve, 100));
    const freshStaffStore = useStaffStore.getState();
    const currentStaff = freshStaffStore.staff;
    console.log(`[SampleData] Total staff in store: ${currentStaff.length}`);

    const newStaff = currentStaff.slice(initialStaffCount);
    const staffIds = newStaff.map(s => s.id);

    console.log(`[SampleData] Created ${staffIds.length} new staff members`);

    console.log('[SampleData] Assigning waiters to tables...');

    // Get waiter IDs (positions 2, 3, 4 in sampleStaff array)
    const waiterStaffIds = newStaff
      .filter(s => s.role === 'waiter')
      .map(s => s.id);

    console.log(`[SampleData] Found ${waiterStaffIds.length} waiters to assign`);

    // Emma - Main Dining (first 10 tables)
    if (waiterStaffIds[0]) {
      for (let i = 0; i < Math.min(10, tableIds.length); i++) {
        console.log(`[SampleData] Assigning table ${tableIds[i]} to Emma`);
        freshTableStore2.assignWaiter(tableIds[i], waiterStaffIds[0], 'system', 'Auto-assigned sample data');
        await new Promise(resolve => setTimeout(resolve, 50));
      }
      console.log(`[SampleData] Assigned ${Math.min(10, tableIds.length)} tables to Emma`);
    }

    // James - Patio (next 6 tables)
    if (waiterStaffIds[1]) {
      for (let i = 10; i < Math.min(16, tableIds.length); i++) {
        console.log(`[SampleData] Assigning table ${tableIds[i]} to James`);
        freshTableStore2.assignWaiter(tableIds[i], waiterStaffIds[1], 'system', 'Auto-assigned sample data');
        await new Promise(resolve => setTimeout(resolve, 50));
      }
      console.log(`[SampleData] Assigned ${Math.min(6, Math.max(0, tableIds.length - 10))} tables to James`);
    }

    // Olivia - Bar (next 4 tables)
    if (waiterStaffIds[2]) {
      for (let i = 16; i < Math.min(20, tableIds.length); i++) {
        console.log(`[SampleData] Assigning table ${tableIds[i]} to Olivia`);
        freshTableStore2.assignWaiter(tableIds[i], waiterStaffIds[2], 'system', 'Auto-assigned sample data');
        await new Promise(resolve => setTimeout(resolve, 50));
      }
      console.log(`[SampleData] Assigned ${Math.min(4, Math.max(0, tableIds.length - 16))} tables to Olivia`);
    }

    // Set a few tables to different statuses for visual variety
    console.log('[SampleData] Setting varied table statuses...');
    if (tableIds.length >= 3) {
      freshTableStore2.updateTableStatus(tableIds[1], 'occupied');
      await new Promise(resolve => setTimeout(resolve, 50));
      freshTableStore2.updateTableStatus(tableIds[5], 'occupied');
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    if (tableIds.length >= 12) {
      freshTableStore2.updateTableStatus(tableIds[11], 'reserved');
      await new Promise(resolve => setTimeout(resolve, 50));
    }

    // Recompute filtered data
    console.log('[SampleData] Recomputing filtered data...');
    const finalTableStore = useTableStore.getState();
    finalTableStore.recomputeFiltered();

    console.log('[SampleData] Sample data loaded successfully!');
    console.log(`  - ${areaIds.length} areas`);
    console.log(`  - ${tableIds.length} tables`);
    console.log(`  - ${staffIds.length} staff members`);
    console.log(`  - ${waiterStaffIds.length} waiters assigned`);

    return {
      areaIds,
      tableIds,
      staffIds,
      waiterStaffIds,
    };
  } catch (error) {
    console.error('[SampleData] Error loading sample data:', error);
    console.error('[SampleData] Error details:', JSON.stringify(error, null, 2));
    if (error instanceof Error) {
      console.error('[SampleData] Error message:', error.message);
      console.error('[SampleData] Error stack:', error.stack);
    }
    throw error;
  }
}

/**
 * Clear all sample data
 */
export async function clearSampleData() {
  const tableStore = useTableStore.getState();
  const staffStore = useStaffStore.getState();

  console.log('[SampleData] Clearing all sample data...');

  // Clear tables
  const tables = tableStore.tables;
  for (const table of tables) {
    tableStore.deleteTable(table.id);
  }

  // Clear areas
  const areas = tableStore.areas;
  for (const area of areas) {
    tableStore.deleteArea(area.id);
  }

  // Clear staff (except owner)
  const staff = staffStore.staff;
  for (const member of staff) {
    if (member.role !== 'owner') {
      staffStore.deleteStaff(member.id);
    }
  }

  tableStore.recomputeFiltered();

  console.log('[SampleData] All sample data cleared!');
}

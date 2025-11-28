// Database types for Supabase
// Generated from docs/12-database-schema.md

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      stores: {
        Row: {
          id: string;
          name: string;
          business_type: 'retail' | 'food_beverage' | 'service' | 'other';
          currency: string;
          timezone: string;
          settings: StoreSettings;
          owner_id: string;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['stores']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['stores']['Insert']>;
      };
      terminals: {
        Row: {
          id: string;
          store_id: string;
          name: string;
          type: 'pos' | 'kitchen' | 'customer_display' | 'self_service';
          device_id: string;
          device_name: string | null;
          platform: 'ios' | 'android' | 'web';
          status: 'online' | 'offline' | 'maintenance';
          settings: TerminalSettings;
          last_seen_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['terminals']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['terminals']['Insert']>;
      };
      staff: {
        Row: {
          id: string;
          store_id: string;
          name: string;
          email: string | null;
          pin_hash: string | null;
          role: 'owner' | 'manager' | 'cashier' | 'kitchen' | 'waiter';
          permissions: string[];
          active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['staff']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['staff']['Insert']>;
      };
      categories: {
        Row: {
          id: string;
          store_id: string;
          name: string;
          description: string | null;
          color: string | null;
          icon: string | null;
          sort_order: number;
          active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['categories']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['categories']['Insert']>;
      };
      products: {
        Row: {
          id: string;
          store_id: string;
          category_id: string | null;
          name: string;
          description: string | null;
          sku: string | null;
          barcode: string | null;
          price: number;
          cost: number | null;
          tax_rate: number;
          image_url: string | null;
          track_inventory: boolean;
          allow_backorder: boolean;
          has_variants: boolean;
          sort_order: number;
          active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['products']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['products']['Insert']>;
      };
      product_variants: {
        Row: {
          id: string;
          product_id: string;
          name: string;
          sku: string | null;
          barcode: string | null;
          price_adjustment: number;
          attributes: Record<string, string>;
          sort_order: number;
          active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['product_variants']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['product_variants']['Insert']>;
      };
      modifier_groups: {
        Row: {
          id: string;
          store_id: string;
          name: string;
          selection_type: 'single' | 'multiple';
          min_selections: number;
          max_selections: number | null;
          required: boolean;
          active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['modifier_groups']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['modifier_groups']['Insert']>;
      };
      modifiers: {
        Row: {
          id: string;
          modifier_group_id: string;
          name: string;
          price_adjustment: number;
          sort_order: number;
          active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['modifiers']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['modifiers']['Insert']>;
      };
      product_modifier_groups: {
        Row: {
          id: string;
          product_id: string;
          modifier_group_id: string;
          sort_order: number;
        };
        Insert: Omit<Database['public']['Tables']['product_modifier_groups']['Row'], 'id'>;
        Update: Partial<Database['public']['Tables']['product_modifier_groups']['Insert']>;
      };
      inventory: {
        Row: {
          id: string;
          store_id: string;
          product_id: string | null;
          variant_id: string | null;
          quantity: number;
          reserved_quantity: number;
          low_stock_threshold: number;
          reorder_point: number | null;
          reorder_quantity: number | null;
          last_counted_at: string | null;
          last_restocked_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['inventory']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['inventory']['Insert']>;
      };
      inventory_movements: {
        Row: {
          id: string;
          inventory_id: string;
          quantity_change: number;
          quantity_before: number;
          quantity_after: number;
          movement_type: 'sale' | 'refund' | 'adjustment' | 'restock' | 'transfer' | 'damage' | 'count' | 'void';
          reference_id: string | null;
          notes: string | null;
          staff_id: string | null;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['inventory_movements']['Row'], 'id' | 'created_at'>;
        Update: Partial<Database['public']['Tables']['inventory_movements']['Insert']>;
      };
      orders: {
        Row: {
          id: string;
          store_id: string;
          terminal_id: string | null;
          staff_id: string | null;
          customer_id: string | null;
          table_id: string | null;
          area_id: string | null;
          order_number: string;
          status: 'draft' | 'pending' | 'preparing' | 'ready' | 'completed' | 'cancelled';
          order_type: 'dine_in' | 'takeout' | 'delivery';
          subtotal: number;
          discount_total: number;
          tax_total: number;
          tip_amount: number;
          total: number;
          notes: string | null;
          metadata: Json;
          created_at: string;
          updated_at: string;
          completed_at: string | null;
        };
        Insert: Omit<Database['public']['Tables']['orders']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['orders']['Insert']>;
      };
      order_items: {
        Row: {
          id: string;
          order_id: string;
          product_id: string | null;
          variant_id: string | null;
          name: string;
          quantity: number;
          unit_price: number;
          subtotal: number;
          discount_amount: number;
          tax_amount: number;
          total: number;
          notes: string | null;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['order_items']['Row'], 'id' | 'created_at'>;
        Update: Partial<Database['public']['Tables']['order_items']['Insert']>;
      };
      order_item_modifiers: {
        Row: {
          id: string;
          order_item_id: string;
          modifier_id: string;
          name: string;
          price_adjustment: number;
        };
        Insert: Omit<Database['public']['Tables']['order_item_modifiers']['Row'], 'id'>;
        Update: Partial<Database['public']['Tables']['order_item_modifiers']['Insert']>;
      };
      payments: {
        Row: {
          id: string;
          order_id: string;
          method: 'cashu_nfc' | 'cashu_qr' | 'lightning' | 'cash' | 'other';
          status: 'pending' | 'completed' | 'failed' | 'refunded';
          amount: number;
          currency: string;
          sats_amount: number | null;
          exchange_rate: number | null;
          cashu_token: string | null;
          lightning_invoice: string | null;
          metadata: Json;
          created_at: string;
          completed_at: string | null;
        };
        Insert: Omit<Database['public']['Tables']['payments']['Row'], 'id' | 'created_at'>;
        Update: Partial<Database['public']['Tables']['payments']['Insert']>;
      };
      refunds: {
        Row: {
          id: string;
          order_id: string;
          payment_id: string;
          refund_type: 'full' | 'partial';
          amount: number;
          sats_amount: number | null;
          reason: string;
          status: 'pending' | 'completed' | 'failed';
          initiated_by: string;
          approved_by: string | null;
          cashu_token: string | null;
          created_at: string;
          completed_at: string | null;
        };
        Insert: Omit<Database['public']['Tables']['refunds']['Row'], 'id' | 'created_at'>;
        Update: Partial<Database['public']['Tables']['refunds']['Insert']>;
      };
      customers: {
        Row: {
          id: string;
          store_id: string;
          name: string | null;
          email: string | null;
          phone: string | null;
          notes: string | null;
          tags: string[];
          total_orders: number;
          total_spent: number;
          average_order_value: number;
          loyalty_points: number;
          loyalty_tier: 'bronze' | 'silver' | 'gold' | 'platinum' | null;
          first_order_at: string | null;
          last_order_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['customers']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['customers']['Insert']>;
      };
      discounts: {
        Row: {
          id: string;
          store_id: string;
          name: string;
          discount_type: 'percentage' | 'fixed';
          value: number;
          min_order_amount: number | null;
          max_discount: number | null;
          applies_to: 'order' | 'item';
          active: boolean;
          valid_from: string | null;
          valid_until: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['discounts']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['discounts']['Insert']>;
      };
      table_areas: {
        Row: {
          id: string;
          store_id: string;
          name: string;
          description: string | null;
          color: string | null;
          sort_order: number;
          active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['table_areas']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['table_areas']['Insert']>;
      };
      tables: {
        Row: {
          id: string;
          store_id: string;
          area_id: string | null;
          number: string;
          capacity: number;
          status: 'available' | 'occupied' | 'reserved' | 'cleaning' | 'unavailable';
          position: Json | null;
          shape: 'square' | 'round' | 'rectangle' | 'custom';
          metadata: Json;
          active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['tables']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['tables']['Insert']>;
      };
      table_assignments: {
        Row: {
          id: string;
          table_id: string;
          staff_id: string;
          assigned_at: string;
          assigned_by: string | null;
          active: boolean;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['table_assignments']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['table_assignments']['Insert']>;
      };
    };
    Views: {};
    Functions: {};
    Enums: {};
  };
}

// Store settings interface
export interface StoreSettings {
  tax: {
    enabled: boolean;
    inclusive: boolean;
    default_rate: number;
  };
  tips: {
    enabled: boolean;
    presets: number[];
    allow_custom: boolean;
  };
  receipts: {
    show_logo: boolean;
    footer_text: string | null;
  };
  payments: {
    cashu_enabled: boolean;
    lightning_enabled: boolean;
    cash_enabled: boolean;
    default_mint_url: string | null;
  };
}

// Terminal settings interface
export interface TerminalSettings {
  capabilities: {
    take_orders: boolean;
    process_payments: boolean;
    view_kitchen_queue: boolean;
    manage_inventory: boolean;
    access_reports: boolean;
  };
  display: {
    show_prices: boolean;
    show_inventory: boolean;
    font_size: 'small' | 'medium' | 'large';
  };
  hardware: {
    has_nfc: boolean;
    has_printer: boolean;
    printer_address: string | null;
  };
}

// Helper types for easier access
export type Tables = Database['public']['Tables'];
export type StoreRow = Tables['stores']['Row'];
export type TerminalRow = Tables['terminals']['Row'];
export type StaffRow = Tables['staff']['Row'];
export type CategoryRow = Tables['categories']['Row'];
export type ProductRow = Tables['products']['Row'];
export type ProductVariantRow = Tables['product_variants']['Row'];
export type ModifierGroupRow = Tables['modifier_groups']['Row'];
export type ModifierRow = Tables['modifiers']['Row'];
export type InventoryRow = Tables['inventory']['Row'];
export type OrderRow = Tables['orders']['Row'];
export type OrderItemRow = Tables['order_items']['Row'];
export type PaymentRow = Tables['payments']['Row'];
export type CustomerRow = Tables['customers']['Row'];
export type DiscountRow = Tables['discounts']['Row'];
export type TableAreaRow = Tables['table_areas']['Row'];
export type TableRow = Tables['tables']['Row'];
export type TableAssignmentRow = Tables['table_assignments']['Row'];

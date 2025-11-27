/**
 * Catalog Store
 *
 * Manages product catalog state including categories, products, and modifiers.
 * Supports both offline-first local data and Supabase sync.
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type {
  Category,
  Product,
  ModifierGroup,
  ProductFilters,
  CategoryFilters,
  InventoryInfo,
} from '@/types/catalog';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';

interface CatalogState {
  // Data
  categories: Category[];
  products: Product[];
  modifierGroups: ModifierGroup[];

  // Loading states
  isLoading: boolean;
  isSyncing: boolean;
  error: string | null;

  // Filters
  activeFilters: ProductFilters;
  activeCategoryId: string | null;

  // Last sync timestamp
  lastSyncAt: Date | null;

  // Store ID (set after store setup)
  storeId: string | null;

  // Actions - Data fetching
  setStoreId: (storeId: string) => void;
  fetchCategories: () => Promise<void>;
  fetchProducts: () => Promise<void>;
  fetchModifierGroups: () => Promise<void>;
  syncAll: () => Promise<void>;

  // Actions - Category CRUD
  addCategory: (category: Omit<Category, 'id' | 'created_at' | 'updated_at'>) => Promise<Category>;
  updateCategory: (id: string, updates: Partial<Category>) => Promise<void>;
  deleteCategory: (id: string) => Promise<void>;
  reorderCategories: (orderedIds: string[]) => Promise<void>;

  // Actions - Product CRUD
  addProduct: (product: Omit<Product, 'id' | 'created_at' | 'updated_at'>) => Promise<Product>;
  updateProduct: (id: string, updates: Partial<Product>) => Promise<void>;
  deleteProduct: (id: string) => Promise<void>;
  reorderProducts: (categoryId: string | null, orderedIds: string[]) => Promise<void>;

  // Actions - Filters
  setActiveCategory: (categoryId: string | null) => void;
  setFilters: (filters: ProductFilters) => void;
  clearFilters: () => void;

  // Selectors
  getProductsByCategory: (categoryId: string | null) => Product[];
  getFilteredProducts: () => Product[];
  getProduct: (id: string) => Product | undefined;
  getCategory: (id: string) => Category | undefined;
  getModifierGroupsForProduct: (productId: string) => ModifierGroup[];

  // Actions - Local offline support
  addLocalProduct: (product: Product) => void;
  addLocalCategory: (category: Category) => void;
  setModifierGroups: (groups: ModifierGroup[]) => void;
  clearLocalData: () => void;
}

// Generate a UUID for local-only items
function generateLocalId(): string {
  return `local_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// Compute inventory status
function computeInventoryStatus(inventory: InventoryInfo | null | undefined): InventoryInfo['status'] {
  if (!inventory) return 'in_stock';
  const available = inventory.quantity - inventory.reserved_quantity;
  if (available <= 0) return 'out_of_stock';
  if (available <= inventory.low_stock_threshold) return 'low_stock';
  return 'in_stock';
}

export const useCatalogStore = create<CatalogState>()(
  persist(
    (set, get) => ({
      // Initial state
      categories: [],
      products: [],
      modifierGroups: [],
      isLoading: false,
      isSyncing: false,
      error: null,
      activeFilters: {},
      activeCategoryId: null,
      lastSyncAt: null,
      storeId: null,

      // Set store ID
      setStoreId: (storeId) => {
        set({ storeId });
      },

      // Fetch categories from Supabase
      fetchCategories: async () => {
        const { storeId } = get();
        if (!storeId || !isSupabaseConfigured()) return;

        set({ isLoading: true, error: null });

        try {
          const { data, error } = await supabase
            .from('categories')
            .select('*')
            .eq('store_id', storeId)
            .eq('active', true)
            .order('sort_order');

          if (error) throw error;

          set({ categories: data || [], isLoading: false });
        } catch (err) {
          set({ error: (err as Error).message, isLoading: false });
        }
      },

      // Fetch products from Supabase
      fetchProducts: async () => {
        const { storeId } = get();
        if (!storeId || !isSupabaseConfigured()) return;

        set({ isLoading: true, error: null });

        try {
          const { data, error } = await supabase
            .from('products')
            .select(`
              *,
              category:categories(id, name, color, icon),
              variants:product_variants(*),
              inventory:inventory(quantity, reserved_quantity, low_stock_threshold)
            `)
            .eq('store_id', storeId)
            .eq('active', true)
            .order('sort_order');

          if (error) throw error;

          // Transform data and compute inventory status
          const products = (data || []).map((p: any) => ({
            ...p,
            inventory: p.inventory?.[0]
              ? {
                  ...p.inventory[0],
                  status: computeInventoryStatus(p.inventory[0]),
                }
              : null,
          }));

          set({ products, isLoading: false });
        } catch (err) {
          set({ error: (err as Error).message, isLoading: false });
        }
      },

      // Fetch modifier groups from Supabase
      fetchModifierGroups: async () => {
        const { storeId } = get();
        if (!storeId || !isSupabaseConfigured()) return;

        set({ isLoading: true, error: null });

        try {
          const { data, error } = await supabase
            .from('modifier_groups')
            .select(`
              *,
              modifiers(*)
            `)
            .eq('store_id', storeId)
            .eq('active', true)
            .order('name');

          if (error) throw error;

          set({ modifierGroups: data || [], isLoading: false });
        } catch (err) {
          set({ error: (err as Error).message, isLoading: false });
        }
      },

      // Sync all data
      syncAll: async () => {
        set({ isSyncing: true });

        try {
          await Promise.all([
            get().fetchCategories(),
            get().fetchProducts(),
            get().fetchModifierGroups(),
          ]);

          set({ lastSyncAt: new Date(), isSyncing: false });
        } catch (err) {
          set({ isSyncing: false });
        }
      },

      // Add category
      addCategory: async (categoryData) => {
        const { storeId } = get();

        // If no Supabase, add locally
        if (!storeId || !isSupabaseConfigured()) {
          const newCategory: Category = {
            ...categoryData,
            id: generateLocalId(),
            store_id: storeId || 'local',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          } as Category;

          set((state) => ({
            categories: [...state.categories, newCategory],
          }));

          return newCategory;
        }

        const { data, error } = await (supabase as any)
          .from('categories')
          .insert({
            ...categoryData,
            store_id: storeId,
          })
          .select()
          .single();

        if (error) throw error;

        set((state) => ({
          categories: [...state.categories, data],
        }));

        return data;
      },

      // Update category
      updateCategory: async (id, updates) => {
        if (!isSupabaseConfigured() || id.startsWith('local_')) {
          set((state) => ({
            categories: state.categories.map((c) =>
              c.id === id ? { ...c, ...updates, updated_at: new Date().toISOString() } : c
            ),
          }));
          return;
        }

        const { error } = await (supabase as any)
          .from('categories')
          .update(updates)
          .eq('id', id);

        if (error) throw error;

        set((state) => ({
          categories: state.categories.map((c) =>
            c.id === id ? { ...c, ...updates } : c
          ),
        }));
      },

      // Delete category
      deleteCategory: async (id) => {
        if (!isSupabaseConfigured() || id.startsWith('local_')) {
          set((state) => ({
            categories: state.categories.filter((c) => c.id !== id),
          }));
          return;
        }

        const { error } = await (supabase as any)
          .from('categories')
          .update({ active: false })
          .eq('id', id);

        if (error) throw error;

        set((state) => ({
          categories: state.categories.filter((c) => c.id !== id),
        }));
      },

      // Reorder categories
      reorderCategories: async (orderedIds) => {
        const updates = orderedIds.map((id, index) => ({
          id,
          sort_order: index,
        }));

        // Update local state immediately
        set((state) => ({
          categories: state.categories
            .map((c) => {
              const update = updates.find((u) => u.id === c.id);
              return update ? { ...c, sort_order: update.sort_order } : c;
            })
            .sort((a, b) => a.sort_order - b.sort_order),
        }));

        // Sync to Supabase if configured
        if (isSupabaseConfigured()) {
          for (const update of updates) {
            if (!update.id.startsWith('local_')) {
              await (supabase as any)
                .from('categories')
                .update({ sort_order: update.sort_order })
                .eq('id', update.id);
            }
          }
        }
      },

      // Add product
      addProduct: async (productData) => {
        const { storeId } = get();

        if (!storeId || !isSupabaseConfigured()) {
          const newProduct: Product = {
            ...productData,
            id: generateLocalId(),
            store_id: storeId || 'local',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          } as Product;

          set((state) => ({
            products: [...state.products, newProduct],
          }));

          return newProduct;
        }

        const { data, error } = await (supabase as any)
          .from('products')
          .insert({
            ...productData,
            store_id: storeId,
          })
          .select(`
            *,
            category:categories(id, name, color, icon)
          `)
          .single();

        if (error) throw error;

        set((state) => ({
          products: [...state.products, data],
        }));

        return data;
      },

      // Update product
      updateProduct: async (id, updates) => {
        if (!isSupabaseConfigured() || id.startsWith('local_')) {
          set((state) => ({
            products: state.products.map((p) =>
              p.id === id ? { ...p, ...updates, updated_at: new Date().toISOString() } : p
            ),
          }));
          return;
        }

        const { error } = await (supabase as any)
          .from('products')
          .update(updates)
          .eq('id', id);

        if (error) throw error;

        set((state) => ({
          products: state.products.map((p) =>
            p.id === id ? { ...p, ...updates } : p
          ),
        }));
      },

      // Delete product
      deleteProduct: async (id) => {
        if (!isSupabaseConfigured() || id.startsWith('local_')) {
          set((state) => ({
            products: state.products.filter((p) => p.id !== id),
          }));
          return;
        }

        const { error } = await (supabase as any)
          .from('products')
          .update({ active: false })
          .eq('id', id);

        if (error) throw error;

        set((state) => ({
          products: state.products.filter((p) => p.id !== id),
        }));
      },

      // Reorder products
      reorderProducts: async (categoryId, orderedIds) => {
        const updates = orderedIds.map((id, index) => ({
          id,
          sort_order: index,
        }));

        set((state) => ({
          products: state.products
            .map((p) => {
              const update = updates.find((u) => u.id === p.id);
              return update ? { ...p, sort_order: update.sort_order } : p;
            })
            .sort((a, b) => a.sort_order - b.sort_order),
        }));

        if (isSupabaseConfigured()) {
          for (const update of updates) {
            if (!update.id.startsWith('local_')) {
              await (supabase as any)
                .from('products')
                .update({ sort_order: update.sort_order })
                .eq('id', update.id);
            }
          }
        }
      },

      // Set active category filter
      setActiveCategory: (categoryId) => {
        set({ activeCategoryId: categoryId });
      },

      // Set filters
      setFilters: (filters) => {
        set({ activeFilters: filters });
      },

      // Clear filters
      clearFilters: () => {
        set({ activeFilters: {}, activeCategoryId: null });
      },

      // Get products by category
      getProductsByCategory: (categoryId) => {
        const { products } = get();
        if (!categoryId) {
          return products.filter((p) => !p.category_id);
        }
        return products.filter((p) => p.category_id === categoryId);
      },

      // Get filtered products
      getFilteredProducts: () => {
        const { products, activeFilters, activeCategoryId } = get();

        return products.filter((p) => {
          // Category filter
          if (activeCategoryId && p.category_id !== activeCategoryId) {
            return false;
          }

          // Search filter
          if (activeFilters.search) {
            const search = activeFilters.search.toLowerCase();
            const matchesName = p.name.toLowerCase().includes(search);
            const matchesSku = p.sku?.toLowerCase().includes(search);
            const matchesBarcode = p.barcode?.toLowerCase().includes(search);
            if (!matchesName && !matchesSku && !matchesBarcode) {
              return false;
            }
          }

          // Active only filter
          if (activeFilters.active_only && !p.active) {
            return false;
          }

          // In stock only filter
          if (activeFilters.in_stock_only && p.inventory?.status === 'out_of_stock') {
            return false;
          }

          return true;
        });
      },

      // Get single product
      getProduct: (id) => {
        return get().products.find((p) => p.id === id);
      },

      // Get single category
      getCategory: (id) => {
        return get().categories.find((c) => c.id === id);
      },

      // Get modifier groups for product
      getModifierGroupsForProduct: (productId) => {
        // In a full implementation, this would look up product_modifier_groups
        // For now, return all modifier groups
        return get().modifierGroups;
      },

      // Local data management
      addLocalProduct: (product) => {
        set((state) => ({
          products: [...state.products, product],
        }));
      },

      addLocalCategory: (category) => {
        set((state) => ({
          categories: [...state.categories, category],
        }));
      },

      setModifierGroups: (groups) => {
        set({ modifierGroups: groups });
      },

      clearLocalData: () => {
        set({
          categories: [],
          products: [],
          modifierGroups: [],
          lastSyncAt: null,
        });
      },
    }),
    {
      name: 'cashupay-catalog',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        categories: state.categories,
        products: state.products,
        modifierGroups: state.modifierGroups,
        lastSyncAt: state.lastSyncAt,
        storeId: state.storeId,
      }),
    }
  )
);

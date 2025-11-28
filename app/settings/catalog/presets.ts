import { Category, Product, ModifierGroup } from '@/types/catalog';

export interface CatalogPreset {
    id: string;
    name: string;
    description: string;
    icon: string;
    categories: Partial<Category>[];
    products: Partial<Product>[];
    modifierGroups: ModifierGroup[];
}

export const PRESETS: Record<string, CatalogPreset> = {
    coffee_shop: {
        id: 'coffee_shop',
        name: 'Coffee Shop',
        description: 'Espresso drinks, pastries, with milk & size options',
        icon: '☕',
        categories: [
            { name: 'Hot Drinks', icon: '☕', color: '#f97316', sort_order: 0 },
            { name: 'Cold Drinks', icon: '🧃', color: '#06b6d4', sort_order: 1 },
            { name: 'Pastries', icon: '🥐', color: '#eab308', sort_order: 2 },
            { name: 'Sandwiches', icon: '🥪', color: '#22c55e', sort_order: 3 },
        ],
        modifierGroups: [
            {
                id: 'mod_milk',
                store_id: 'local',
                name: 'Milk Options',
                selection_type: 'single',
                min_selections: 0,
                max_selections: 1,
                required: false,
                active: true,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
                modifiers: [
                    { id: 'm1', modifier_group_id: 'mod_milk', name: 'Whole Milk', price_adjustment: 0, sort_order: 0, active: true, created_at: '', updated_at: '' },
                    { id: 'm2', modifier_group_id: 'mod_milk', name: 'Skim Milk', price_adjustment: 0, sort_order: 1, active: true, created_at: '', updated_at: '' },
                    { id: 'm3', modifier_group_id: 'mod_milk', name: 'Oat Milk', price_adjustment: 50, sort_order: 2, active: true, created_at: '', updated_at: '' },
                    { id: 'm4', modifier_group_id: 'mod_milk', name: 'Almond Milk', price_adjustment: 50, sort_order: 3, active: true, created_at: '', updated_at: '' },
                ],
            },
            {
                id: 'mod_size',
                store_id: 'local',
                name: 'Size',
                selection_type: 'single',
                min_selections: 1,
                max_selections: 1,
                required: true,
                active: true,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
                modifiers: [
                    { id: 's1', modifier_group_id: 'mod_size', name: 'Small', price_adjustment: 0, sort_order: 0, active: true, created_at: '', updated_at: '' },
                    { id: 's2', modifier_group_id: 'mod_size', name: 'Medium', price_adjustment: 50, sort_order: 1, active: true, created_at: '', updated_at: '' },
                    { id: 's3', modifier_group_id: 'mod_size', name: 'Large', price_adjustment: 100, sort_order: 2, active: true, created_at: '', updated_at: '' },
                ],
            },
        ],
        products: [
            { name: 'Espresso', price: 250, category_id: 'Hot Drinks' }, // category_id will be mapped by name
            { name: 'Latte', price: 400, category_id: 'Hot Drinks' },
            { name: 'Cappuccino', price: 400, category_id: 'Hot Drinks' },
            { name: 'Iced Coffee', price: 350, category_id: 'Cold Drinks' },
            { name: 'Croissant', price: 300, category_id: 'Pastries' },
            { name: 'Blueberry Muffin', price: 350, category_id: 'Pastries' },
            { name: 'Ham & Cheese', price: 650, category_id: 'Sandwiches' },
        ],
    },
    restaurant: {
        id: 'restaurant',
        name: 'Restaurant',
        description: 'Meals, sides, drinks with customizations',
        icon: '🍽️',
        categories: [
            { name: 'Starters', icon: '🥗', color: '#22c55e', sort_order: 0 },
            { name: 'Mains', icon: '🍖', color: '#ef4444', sort_order: 1 },
            { name: 'Desserts', icon: '🍰', color: '#ec4899', sort_order: 2 },
            { name: 'Drinks', icon: '🍷', color: '#8b5cf6', sort_order: 3 },
        ],
        modifierGroups: [
            {
                id: 'mod_cooking',
                store_id: 'local',
                name: 'Cooking Preference',
                selection_type: 'single',
                min_selections: 1,
                max_selections: 1,
                required: true,
                active: true,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
                modifiers: [
                    { id: 'c1', modifier_group_id: 'mod_cooking', name: 'Rare', price_adjustment: 0, sort_order: 0, active: true, created_at: '', updated_at: '' },
                    { id: 'c2', modifier_group_id: 'mod_cooking', name: 'Medium', price_adjustment: 0, sort_order: 1, active: true, created_at: '', updated_at: '' },
                    { id: 'c3', modifier_group_id: 'mod_cooking', name: 'Well Done', price_adjustment: 0, sort_order: 2, active: true, created_at: '', updated_at: '' },
                ],
            },
        ],
        products: [
            { name: 'Caesar Salad', price: 800, category_id: 'Starters' },
            { name: 'Cheeseburger', price: 1200, category_id: 'Mains' },
            { name: 'Steak Frites', price: 2400, category_id: 'Mains' },
            { name: 'Chocolate Cake', price: 600, category_id: 'Desserts' },
            { name: 'House Wine', price: 700, category_id: 'Drinks' },
        ],
    },
    retail: {
        id: 'retail',
        name: 'Retail Store',
        description: 'General products, no modifiers needed',
        icon: '🛒',
        categories: [
            { name: 'Clothing', icon: '👕', color: '#3b82f6', sort_order: 0 },
            { name: 'Accessories', icon: '👜', color: '#ec4899', sort_order: 1 },
            { name: 'Home', icon: '🏠', color: '#14b8a6', sort_order: 2 },
        ],
        modifierGroups: [],
        products: [
            { name: 'Cotton T-Shirt', price: 2000, category_id: 'Clothing' },
            { name: 'Denim Jeans', price: 4500, category_id: 'Clothing' },
            { name: 'Baseball Cap', price: 1500, category_id: 'Accessories' },
            { name: 'Ceramic Mug', price: 1200, category_id: 'Home' },
        ],
    },
    bar: {
        id: 'bar',
        name: 'Bar / Pub',
        description: 'Drinks, cocktails, snacks',
        icon: '🍺',
        categories: [
            { name: 'Beer', icon: '🍺', color: '#eab308', sort_order: 0 },
            { name: 'Wine', icon: '🍷', color: '#ef4444', sort_order: 1 },
            { name: 'Cocktails', icon: '🍸', color: '#8b5cf6', sort_order: 2 },
            { name: 'Snacks', icon: '🥜', color: '#f97316', sort_order: 3 },
        ],
        modifierGroups: [],
        products: [
            { name: 'Lager Pint', price: 500, category_id: 'Beer' },
            { name: 'IPA Pint', price: 600, category_id: 'Beer' },
            { name: 'House Red', price: 700, category_id: 'Wine' },
            { name: 'Margarita', price: 900, category_id: 'Cocktails' },
            { name: 'Old Fashioned', price: 1000, category_id: 'Cocktails' },
            { name: 'Peanuts', price: 300, category_id: 'Snacks' },
        ],
    },
};

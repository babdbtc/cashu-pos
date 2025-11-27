/**
 * POS Main Screen
 *
 * Displays product catalog with categories and cart sidebar.
 * Optimized for tablet use.
 */

import { useState, useCallback, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  FlatList,
  TextInput,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, Link } from 'expo-router';

import { useCatalogStore, useCartStore, useConfigStore } from '@/store';
import type { Product, Category } from '@/types/catalog';
import { sampleCategories, sampleProducts, sampleModifierGroups } from '@/data/sample-catalog';

// Format price from cents to display string
function formatPrice(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

// Category Tab Component
function CategoryTab({
  category,
  isActive,
  onPress,
}: {
  category: Category | null;
  isActive: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={[styles.categoryTab, isActive && styles.categoryTabActive]}
      onPress={onPress}
    >
      {category?.icon && <Text style={styles.categoryIcon}>{category.icon}</Text>}
      <Text
        style={[styles.categoryTabText, isActive && styles.categoryTabTextActive]}
        numberOfLines={1}
      >
        {category?.name || 'All'}
      </Text>
    </Pressable>
  );
}

// Product Card Component
function ProductCard({
  product,
  onPress,
}: {
  product: Product;
  onPress: () => void;
}) {
  const isOutOfStock = product.inventory?.status === 'out_of_stock';
  const isLowStock = product.inventory?.status === 'low_stock';

  return (
    <Pressable
      style={[styles.productCard, isOutOfStock && styles.productCardDisabled]}
      onPress={onPress}
      disabled={isOutOfStock && !product.allow_backorder}
    >
      {product.image_url ? (
        <View style={styles.productImage}>
          <Text style={styles.productImagePlaceholder}>
            {product.name.charAt(0).toUpperCase()}
          </Text>
        </View>
      ) : (
        <View style={[styles.productImage, { backgroundColor: product.category?.color || '#2a2a3e' }]}>
          <Text style={styles.productImagePlaceholder}>
            {product.name.charAt(0).toUpperCase()}
          </Text>
        </View>
      )}

      <View style={styles.productInfo}>
        <Text style={styles.productName} numberOfLines={2}>
          {product.name}
        </Text>
        <Text style={styles.productPrice}>{formatPrice(product.price)}</Text>
      </View>

      {isOutOfStock && (
        <View style={styles.stockBadge}>
          <Text style={styles.stockBadgeText}>Out of Stock</Text>
        </View>
      )}
      {isLowStock && !isOutOfStock && (
        <View style={[styles.stockBadge, styles.stockBadgeLow]}>
          <Text style={styles.stockBadgeText}>Low Stock</Text>
        </View>
      )}
    </Pressable>
  );
}

// Cart Item Component
function CartItemRow({
  item,
  onIncrement,
  onDecrement,
  onRemove,
}: {
  item: ReturnType<typeof useCartStore.getState>['cart']['items'][0];
  onIncrement: () => void;
  onDecrement: () => void;
  onRemove: () => void;
}) {
  return (
    <View style={styles.cartItem}>
      <View style={styles.cartItemInfo}>
        <Text style={styles.cartItemName} numberOfLines={1}>
          {item.product.name}
          {item.variant && ` (${item.variant.name})`}
        </Text>
        {item.selectedModifiers.length > 0 && (
          <Text style={styles.cartItemModifiers} numberOfLines={1}>
            {item.selectedModifiers.map((m) => m.modifier.name).join(', ')}
          </Text>
        )}
        <Text style={styles.cartItemPrice}>{formatPrice(item.unitPrice)}</Text>
      </View>

      <View style={styles.cartItemActions}>
        <Pressable style={styles.qtyButton} onPress={onDecrement}>
          <Text style={styles.qtyButtonText}>-</Text>
        </Pressable>
        <Text style={styles.qtyText}>{item.quantity}</Text>
        <Pressable style={styles.qtyButton} onPress={onIncrement}>
          <Text style={styles.qtyButtonText}>+</Text>
        </Pressable>
      </View>

      <Text style={styles.cartItemTotal}>{formatPrice(item.subtotal)}</Text>

      <Pressable style={styles.removeButton} onPress={onRemove}>
        <Text style={styles.removeButtonText}>x</Text>
      </Pressable>
    </View>
  );
}

export default function POSScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isTablet = width >= 768;

  // Store data
  const categories = useCatalogStore((s) => s.categories);
  const products = useCatalogStore((s) => s.products);
  const activeCategoryId = useCatalogStore((s) => s.activeCategoryId);
  const setActiveCategory = useCatalogStore((s) => s.setActiveCategory);
  const getFilteredProducts = useCatalogStore((s) => s.getFilteredProducts);

  // Cart data
  const cart = useCartStore((s) => s.cart);
  const addToCart = useCartStore((s) => s.addToCart);
  const incrementQuantity = useCartStore((s) => s.incrementQuantity);
  const decrementQuantity = useCartStore((s) => s.decrementQuantity);
  const removeFromCart = useCartStore((s) => s.removeFromCart);
  const clearCart = useCartStore((s) => s.clearCart);

  // Config
  const merchantName = useConfigStore((s) => s.merchantName);

  // Load sample data if store is empty
  useEffect(() => {
    if (categories.length === 0 && products.length === 0) {
      // Load sample data for demo
      sampleCategories.forEach((cat) => {
        useCatalogStore.getState().addLocalCategory(cat);
      });
      sampleProducts.forEach((prod) => {
        useCatalogStore.getState().addLocalProduct(prod);
      });
      useCatalogStore.getState().setModifierGroups(sampleModifierGroups);
    }
  }, [categories.length, products.length]);

  // Local state
  const [searchQuery, setSearchQuery] = useState('');
  const [showCart, setShowCart] = useState(isTablet);

  // Filter products by search and category
  const filteredProducts = useMemo(() => {
    let result = activeCategoryId
      ? products.filter((p) => p.category_id === activeCategoryId)
      : products;

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (p) =>
          p.name.toLowerCase().includes(query) ||
          p.sku?.toLowerCase().includes(query) ||
          p.barcode?.toLowerCase().includes(query)
      );
    }

    return result;
  }, [products, activeCategoryId, searchQuery]);

  // Handle product press
  const handleProductPress = useCallback(
    (product: Product) => {
      // If product has variants or modifiers, open detail screen
      if (product.has_variants || product.modifier_groups?.length) {
        router.push(`/pos/product/${product.id}` as any);
      } else {
        // Quick add to cart
        addToCart({ product, quantity: 1 });
      }
    },
    [router, addToCart]
  );

  // Handle checkout
  const handleCheckout = useCallback(() => {
    if (cart.items.length === 0) return;
    router.push('/pos/checkout');
  }, [router, cart.items.length]);

  // Calculate cart totals
  const cartTotals = cart.totals;

  // Number of columns based on screen width
  const numColumns = isTablet ? (showCart ? 3 : 4) : 2;

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Link href="/" asChild>
            <Pressable style={styles.backButton}>
              <Text style={styles.backButtonText}>{'<'}</Text>
            </Pressable>
          </Link>
          <Text style={styles.headerTitle}>{merchantName}</Text>
        </View>

        <View style={styles.headerRight}>
          <View style={styles.searchContainer}>
            <TextInput
              style={styles.searchInput}
              placeholder="Search products..."
              placeholderTextColor="#666"
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
          </View>

          {!isTablet && (
            <Pressable
              style={styles.cartToggle}
              onPress={() => setShowCart(!showCart)}
            >
              <Text style={styles.cartToggleText}>Cart</Text>
              {cart.items.length > 0 && (
                <View style={styles.cartBadge}>
                  <Text style={styles.cartBadgeText}>{cartTotals.itemCount}</Text>
                </View>
              )}
            </Pressable>
          )}
        </View>
      </View>

      <View style={styles.mainContent}>
        {/* Left side: Categories + Products */}
        <View style={[styles.catalogSection, showCart && isTablet && styles.catalogSectionWithCart]}>
          {/* Categories */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.categoriesContainer}
            contentContainerStyle={styles.categoriesContent}
          >
            <CategoryTab
              category={null}
              isActive={!activeCategoryId}
              onPress={() => setActiveCategory(null)}
            />
            {categories.map((category) => (
              <CategoryTab
                key={category.id}
                category={category}
                isActive={activeCategoryId === category.id}
                onPress={() => setActiveCategory(category.id)}
              />
            ))}
          </ScrollView>

          {/* Products Grid */}
          <ScrollView style={styles.productsScrollView}>
            <View style={styles.productsRow}>
              {filteredProducts.map((item) => {
                const cardWidth = isTablet ? (showCart ? (width - 320) / 3 - 12 : width / 4 - 12) : width / 2 - 12;
                return (
                  <View key={item.id} style={[styles.productCardWrapper, { width: cardWidth }]}>
                    <ProductCard product={item} onPress={() => handleProductPress(item)} />
                  </View>
                );
              })}
            </View>
            {filteredProducts.length === 0 && (
              <View style={styles.emptyState}>
                <Text style={styles.emptyStateText}>
                  {searchQuery ? 'No products found' : 'No products in this category'}
                </Text>
              </View>
            )}
          </ScrollView>
        </View>

        {/* Right side: Cart (visible on tablet or toggled on phone) */}
        {(showCart || isTablet) && (
          <View style={[styles.cartSection, !isTablet && styles.cartSectionMobile]}>
            <View style={styles.cartHeader}>
              <Text style={styles.cartTitle}>Current Order</Text>
              {cart.items.length > 0 && (
                <Pressable onPress={clearCart}>
                  <Text style={styles.clearCartText}>Clear</Text>
                </Pressable>
              )}
            </View>

            {/* Cart Items */}
            <ScrollView style={styles.cartItems}>
              {cart.items.length === 0 ? (
                <View style={styles.cartEmpty}>
                  <Text style={styles.cartEmptyText}>Cart is empty</Text>
                  <Text style={styles.cartEmptySubtext}>
                    Tap products to add them
                  </Text>
                </View>
              ) : (
                cart.items.map((item) => (
                  <CartItemRow
                    key={item.id}
                    item={item}
                    onIncrement={() => incrementQuantity(item.id)}
                    onDecrement={() => decrementQuantity(item.id)}
                    onRemove={() => removeFromCart(item.id)}
                  />
                ))
              )}
            </ScrollView>

            {/* Cart Totals */}
            {cart.items.length > 0 && (
              <View style={styles.cartTotals}>
                <View style={styles.totalRow}>
                  <Text style={styles.totalLabel}>Subtotal</Text>
                  <Text style={styles.totalValue}>{formatPrice(cartTotals.subtotal)}</Text>
                </View>
                {cartTotals.discountTotal > 0 && (
                  <View style={styles.totalRow}>
                    <Text style={styles.totalLabel}>Discount</Text>
                    <Text style={[styles.totalValue, styles.discountValue]}>
                      -{formatPrice(cartTotals.discountTotal)}
                    </Text>
                  </View>
                )}
                {cartTotals.taxTotal > 0 && (
                  <View style={styles.totalRow}>
                    <Text style={styles.totalLabel}>Tax</Text>
                    <Text style={styles.totalValue}>{formatPrice(cartTotals.taxTotal)}</Text>
                  </View>
                )}
                <View style={[styles.totalRow, styles.grandTotalRow]}>
                  <Text style={styles.grandTotalLabel}>Total</Text>
                  <Text style={styles.grandTotalValue}>{formatPrice(cartTotals.total)}</Text>
                </View>
              </View>
            )}

            {/* Checkout Button */}
            <Pressable
              style={[styles.checkoutButton, cart.items.length === 0 && styles.checkoutButtonDisabled]}
              onPress={handleCheckout}
              disabled={cart.items.length === 0}
            >
              <Text style={styles.checkoutButtonText}>
                Charge {formatPrice(cartTotals.total)}
              </Text>
            </Pressable>

            {!isTablet && (
              <Pressable style={styles.closeCartButton} onPress={() => setShowCart(false)}>
                <Text style={styles.closeCartText}>Close</Text>
              </Pressable>
            )}
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f0f1a',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#2a2a3e',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: '#1a1a2e',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  backButtonText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '600',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  searchContainer: {
    width: 200,
  },
  searchInput: {
    backgroundColor: '#1a1a2e',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    color: '#fff',
    fontSize: 14,
  },
  cartToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#4ade80',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
  },
  cartToggleText: {
    color: '#0f0f1a',
    fontWeight: '600',
    fontSize: 14,
  },
  cartBadge: {
    backgroundColor: '#0f0f1a',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  cartBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  mainContent: {
    flex: 1,
    flexDirection: 'row',
  },
  catalogSection: {
    flex: 1,
  },
  catalogSectionWithCart: {
    flex: 2,
  },
  categoriesContainer: {
    height: 56,
    flexGrow: 0,
    flexShrink: 0,
    borderBottomWidth: 1,
    borderBottomColor: '#2a2a3e',
  },
  categoriesContent: {
    paddingHorizontal: 12,
    alignItems: 'center',
    height: 56,
  },
  categoryTab: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a2e',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    marginRight: 8,
  },
  categoryTabActive: {
    backgroundColor: '#4ade80',
  },
  categoryIcon: {
    fontSize: 16,
    marginRight: 6,
  },
  categoryTabText: {
    color: '#888',
    fontSize: 14,
    fontWeight: '500',
  },
  categoryTabTextActive: {
    color: '#0f0f1a',
  },
  productsScrollView: {
    flex: 1,
  },
  productsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 6,
  },
  productCardWrapper: {
    margin: 6,
    height: 180,
  },
  productCard: {
    flex: 1,
    backgroundColor: '#1a1a2e',
    borderRadius: 12,
    overflow: 'hidden',
  },
  productCardDisabled: {
    opacity: 0.5,
  },
  productImage: {
    height: 100,
    backgroundColor: '#2a2a3e',
    justifyContent: 'center',
    alignItems: 'center',
  },
  productImagePlaceholder: {
    fontSize: 32,
    color: '#666',
    fontWeight: '700',
  },
  productInfo: {
    padding: 12,
  },
  productName: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  productPrice: {
    color: '#4ade80',
    fontSize: 16,
    fontWeight: '700',
  },
  stockBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: '#ef4444',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  stockBadgeLow: {
    backgroundColor: '#f59e0b',
  },
  stockBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '600',
  },
  emptyState: {
    padding: 40,
    alignItems: 'center',
  },
  emptyStateText: {
    color: '#666',
    fontSize: 16,
  },
  cartSection: {
    width: 320,
    backgroundColor: '#1a1a2e',
    borderLeftWidth: 1,
    borderLeftColor: '#2a2a3e',
  },
  cartSectionMobile: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: '80%',
    maxWidth: 400,
    zIndex: 100,
  },
  cartHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#2a2a3e',
  },
  cartTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
  },
  clearCartText: {
    color: '#ef4444',
    fontSize: 14,
    fontWeight: '500',
  },
  cartItems: {
    flex: 1,
  },
  cartEmpty: {
    padding: 40,
    alignItems: 'center',
  },
  cartEmptyText: {
    color: '#666',
    fontSize: 16,
    fontWeight: '600',
  },
  cartEmptySubtext: {
    color: '#444',
    fontSize: 14,
    marginTop: 4,
  },
  cartItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#2a2a3e',
  },
  cartItemInfo: {
    flex: 1,
  },
  cartItemName: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },
  cartItemModifiers: {
    color: '#666',
    fontSize: 12,
    marginTop: 2,
  },
  cartItemPrice: {
    color: '#888',
    fontSize: 12,
    marginTop: 2,
  },
  cartItemActions: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 8,
  },
  qtyButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#2a2a3e',
    justifyContent: 'center',
    alignItems: 'center',
  },
  qtyButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  qtyText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    marginHorizontal: 12,
    minWidth: 20,
    textAlign: 'center',
  },
  cartItemTotal: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    minWidth: 60,
    textAlign: 'right',
  },
  removeButton: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#3a3a4e',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  removeButtonText: {
    color: '#888',
    fontSize: 14,
  },
  cartTotals: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#2a2a3e',
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  totalLabel: {
    color: '#888',
    fontSize: 14,
  },
  totalValue: {
    color: '#fff',
    fontSize: 14,
  },
  discountValue: {
    color: '#4ade80',
  },
  grandTotalRow: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#2a2a3e',
  },
  grandTotalLabel: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  grandTotalValue: {
    color: '#4ade80',
    fontSize: 20,
    fontWeight: '700',
  },
  checkoutButton: {
    backgroundColor: '#4ade80',
    margin: 16,
    marginTop: 0,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  checkoutButtonDisabled: {
    backgroundColor: '#2a2a3e',
  },
  checkoutButtonText: {
    color: '#0f0f1a',
    fontSize: 18,
    fontWeight: '700',
  },
  closeCartButton: {
    padding: 16,
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#2a2a3e',
  },
  closeCartText: {
    color: '#888',
    fontSize: 14,
  },
});

/**
 * POS Main Screen
 *
 * Displays product catalog with categories and cart sidebar.
 * Optimized for tablet use.
 */

import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  FlatList,
  TextInput,
  useWindowDimensions,
  Image,
  PanResponder,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, Link } from 'expo-router';

import { useCatalogStore, useCartStore } from '@/store';
import type { Product, Category } from '@/types/catalog';
import { sampleCategories, sampleProducts, sampleModifierGroups } from '@/data/sample-catalog';

import { PriceDisplay } from '@/components/common/PriceDisplay';
import { getCurrencySymbol } from '@/constants/currencies';
import { useConfigStore } from '@/store/config.store';
import { fiatToSatsSync, getExchangeRate } from '@/services/exchange-rate.service';

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
  const { currency } = useConfigStore();

  const satsAmount = currency.exchangeRate
    ? fiatToSatsSync(product.price / 100, currency.displayCurrency) ?? 0
    : 0;

  const isSatsMain = currency.priceDisplayMode === 'sats_fiat' || currency.priceDisplayMode === 'sats_only';

  return (
    <Pressable
      style={[styles.productCard, isOutOfStock && styles.productCardDisabled]}
      onPress={onPress}
      disabled={isOutOfStock && !product.allow_backorder}
    >
      {product.image_url ? (
        <Image
          source={typeof product.image_url === 'string' ? { uri: product.image_url } : product.image_url}
          style={styles.productImage}
          resizeMode="cover"
        />
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
        <PriceDisplay
          fiatAmount={product.price / 100}
          satsAmount={satsAmount}
          currencySymbol={getCurrencySymbol(currency.displayCurrency)}
          fiatStyle={isSatsMain ? styles.productPriceSats : styles.productPrice}
          satsStyle={isSatsMain ? styles.productPrice : styles.productPriceSats}
          style={styles.productPriceContainer}
          showSats={true}
        />
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
  const { currency } = useConfigStore();
  const isSatsMain = currency.priceDisplayMode === 'sats_fiat' || currency.priceDisplayMode === 'sats_only';

  return (
    <View style={styles.cartItem}>
      <View style={styles.cartItemHeader}>
        <Text style={styles.cartItemName}>
          {item.product.name}
          {item.variant && ` (${item.variant.name})`}
        </Text>
        {item.selectedModifiers.length > 0 && (
          <Text style={styles.cartItemModifiers} numberOfLines={1}>
            {item.selectedModifiers.map((m) => m.modifier.name).join(', ')}
          </Text>
        )}
      </View>

      <View style={styles.cartItemFooter}>
        <View style={styles.cartItemActions}>
          <Pressable style={styles.qtyButton} onPress={onDecrement}>
            <Text style={styles.qtyButtonText}>-</Text>
          </Pressable>
          <Text style={styles.qtyText}>{item.quantity}</Text>
          <Pressable style={styles.qtyButton} onPress={onIncrement}>
            <Text style={styles.qtyButtonText}>+</Text>
          </Pressable>
        </View>

        <View style={styles.cartItemRight}>
          <PriceDisplay
            fiatAmount={item.subtotal / 100}
            satsAmount={currency.exchangeRate ? (fiatToSatsSync(item.subtotal / 100, currency.displayCurrency) ?? 0) : 0}
            currencySymbol={getCurrencySymbol(currency.displayCurrency)}
            fiatStyle={isSatsMain ? styles.cartItemTotalSatsText : styles.cartItemTotalText}
            satsStyle={isSatsMain ? styles.cartItemTotalText : styles.cartItemTotalSatsText}
            style={styles.cartItemTotalContainer}
            showSats={true}
          />

          <Pressable style={styles.removeButton} onPress={onRemove}>
            <Text style={styles.removeButtonText}>x</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

export default function POSScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isTablet = width >= 768;

  // Store data
  const rawCategories = useCatalogStore((s) => s.categories);
  const rawProducts = useCatalogStore((s) => s.products);

  // Deduplicate data to prevent key errors if store is corrupted
  const categories = useMemo(() => {
    const seen = new Set();
    return rawCategories.filter(c => {
      if (seen.has(c.id)) return false;
      seen.add(c.id);
      return true;
    });
  }, [rawCategories]);

  const products = useMemo(() => {
    const seen = new Set();
    return rawProducts.filter(p => {
      if (seen.has(p.id)) return false;
      seen.add(p.id);
      return true;
    });
  }, [rawProducts]);

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
  const currency = useConfigStore((s) => s.currency);

  // Fetch exchange rate on mount
  useEffect(() => {
    getExchangeRate(currency.displayCurrency).catch(console.error);
  }, [currency.displayCurrency]);

  const isSatsMain = currency.priceDisplayMode === 'sats_fiat' || currency.priceDisplayMode === 'sats_only';

  // Load sample data if store is empty
  // Load sample data if store is empty or has stale images
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
    } else {
      // Check for stale images in sample products (e.g. after code update)
      const hasStaleImages = products.some(p => {
        const sample = sampleProducts.find(sp => sp.id === p.id);
        return sample && sample.image_url && !p.image_url;
      });

      if (hasStaleImages) {
        console.log('Updating stale product images...');
        sampleProducts.forEach((sp) => {
          if (sp.image_url) {
            useCatalogStore.getState().updateProduct(sp.id, { image_url: sp.image_url });
          }
        });
      }
    }
  }, [categories.length, products.length, products]);

  // Local state
  const [searchQuery, setSearchQuery] = useState('');
  const [showCart, setShowCart] = useState(isTablet);
  const [isCartVisible, setIsCartVisible] = useState(isTablet); // Separate render state

  // Animation for cart swipe gesture (mobile only)
  const cartTranslateX = useRef(new Animated.Value(0)).current;
  const cartOpacity = useRef(new Animated.Value(isTablet ? 1 : 0)).current;

  // Animate cart in when opened via button
  useEffect(() => {
    if (!isTablet) {
      if (showCart && !isCartVisible) {
        // Open cart
        setIsCartVisible(true);
        cartTranslateX.setValue(400);
        cartOpacity.setValue(0);
        Animated.parallel([
          Animated.spring(cartTranslateX, {
            toValue: 0,
            damping: 20,
            stiffness: 90,
            useNativeDriver: true,
          }),
          Animated.timing(cartOpacity, {
            toValue: 1,
            duration: 200,
            useNativeDriver: true,
          }),
        ]).start();
      } else if (!showCart && isCartVisible) {
        // Close cart (triggered externally)
        Animated.parallel([
          Animated.timing(cartTranslateX, {
            toValue: 400,
            duration: 250,
            useNativeDriver: true,
          }),
          Animated.timing(cartOpacity, {
            toValue: 0,
            duration: 250,
            useNativeDriver: true,
          }),
        ]).start(() => {
          setIsCartVisible(false);
          cartTranslateX.setValue(0);
        });
      }
    }
  }, [showCart, isTablet, isCartVisible, cartTranslateX, cartOpacity]);

  // Pan responder for cart swipe to close (mobile only)
  const cartPanResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (evt, gestureState) => {
        // Only respond to horizontal swipes on mobile
        if (isTablet) return false;
        return Math.abs(gestureState.dx) > Math.abs(gestureState.dy) && Math.abs(gestureState.dx) > 10;
      },
      onPanResponderMove: (evt, gestureState) => {
        // Only allow swiping to the right (closing)
        if (gestureState.dx > 0) {
          cartTranslateX.setValue(gestureState.dx);
          // Fade out as user drags
          const opacity = Math.max(0, 1 - gestureState.dx / 400);
          cartOpacity.setValue(opacity);
        }
      },
      onPanResponderRelease: (evt, gestureState) => {
        if (gestureState.dx > 100 || gestureState.vx > 0.5) {
          // Swipe threshold reached - close cart with smooth animation
          Animated.parallel([
            Animated.timing(cartTranslateX, {
              toValue: 400,
              duration: 250,
              useNativeDriver: true,
            }),
            Animated.timing(cartOpacity, {
              toValue: 0,
              duration: 250,
              useNativeDriver: true,
            }),
          ]).start(() => {
            setIsCartVisible(false);
            setShowCart(false);
            cartTranslateX.setValue(0);
          });
        } else {
          // Snap back
          Animated.parallel([
            Animated.spring(cartTranslateX, {
              toValue: 0,
              damping: 20,
              stiffness: 90,
              useNativeDriver: true,
            }),
            Animated.timing(cartOpacity, {
              toValue: 1,
              duration: 200,
              useNativeDriver: true,
            }),
          ]).start();
        }
      },
    })
  ).current;

  // Pan responder for edge swipe to open cart (mobile only)
  const edgePanResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (evt, gestureState) => {
        // Only respond on mobile, when cart is closed, and swipe starts from right edge
        if (isTablet || showCart) return false;
        // Larger edge zone (100px from right edge)
        const isFromRightEdge = evt.nativeEvent.pageX > width - 100;
        return isFromRightEdge && gestureState.dx < -5;
      },
      onPanResponderGrant: () => {
        // Show cart immediately when gesture starts
        setIsCartVisible(true);
        cartTranslateX.setValue(400);
        cartOpacity.setValue(0);
      },
      onPanResponderMove: (evt, gestureState) => {
        // Follow finger - show cart sliding in from right
        const translateValue = Math.max(0, 400 + gestureState.dx);
        cartTranslateX.setValue(translateValue);
        // Fade in as user drags
        const opacity = Math.min(1, Math.max(0, -gestureState.dx / 200));
        cartOpacity.setValue(opacity);
      },
      onPanResponderRelease: (evt, gestureState) => {
        if (gestureState.dx < -80 || gestureState.vx < -0.3) {
          // Swipe threshold reached - open cart fully
          setShowCart(true);
          Animated.parallel([
            Animated.spring(cartTranslateX, {
              toValue: 0,
              damping: 20,
              stiffness: 90,
              useNativeDriver: true,
            }),
            Animated.timing(cartOpacity, {
              toValue: 1,
              duration: 200,
              useNativeDriver: true,
            }),
          ]).start();
        } else {
          // Snap back - close cart
          Animated.parallel([
            Animated.timing(cartTranslateX, {
              toValue: 400,
              duration: 200,
              useNativeDriver: true,
            }),
            Animated.timing(cartOpacity, {
              toValue: 0,
              duration: 200,
              useNativeDriver: true,
            }),
          ]).start(() => {
            setIsCartVisible(false);
            cartTranslateX.setValue(0);
          });
        }
      },
    })
  ).current;

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
  // Tablet vertical (portrait) usually has width < height, but isTablet is based on screen size
  // We want 3 columns on tablet when cart is shown, even in vertical mode if space permits
  // On phone, cart is an overlay so always use full width
  const cartWidth = 340; // Width of cart section + borders
  const availableWidth = isTablet && showCart
    ? width - cartWidth
    : width;

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
          {isTablet && <Text style={styles.headerTitle}>{merchantName}</Text>}
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

          {isTablet && (
            <Pressable
              style={[styles.cartToggle, { backgroundColor: '#ef4444', marginLeft: 8 }]}
              onPress={() => {
                // Clear data and reload
                useCatalogStore.getState().clearLocalData();
                setTimeout(() => {
                  sampleCategories.forEach((cat) => {
                    useCatalogStore.getState().addLocalCategory(cat);
                  });
                  sampleProducts.forEach((prod) => {
                    useCatalogStore.getState().addLocalProduct(prod);
                  });
                  useCatalogStore.getState().setModifierGroups(sampleModifierGroups);
                }, 50);
              }}
            >
              <Text style={styles.cartToggleText}>Reset</Text>
            </Pressable>
          )}
        </View>
      </View>

      <View style={styles.mainContent} {...(!isTablet ? edgePanResponder.panHandlers : {})}>
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
                // Calculate width dynamically based on available space
                // Account for: row padding (12px total), card margins (12px per card)
                const rowPadding = 12; // 6px on each side
                const cardMargin = 12; // 6px on each side
                const cols = numColumns;
                const cardWidth = (availableWidth - rowPadding - (cols * cardMargin)) / cols;

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
        {(isCartVisible || isTablet) && (
          <Animated.View
            style={[
              styles.cartSection,
              !isTablet && styles.cartSectionMobile,
              !isTablet && {
                transform: [{ translateX: cartTranslateX }],
                opacity: cartOpacity,
              },
            ]}
            {...(!isTablet ? cartPanResponder.panHandlers : {})}
          >
            <View style={styles.cartHeader}>
              <Text style={styles.cartTitle} numberOfLines={1}>
                Current Order
              </Text>
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
                  <PriceDisplay
                    fiatAmount={cartTotals.subtotal / 100}
                    satsAmount={currency.exchangeRate ? (fiatToSatsSync(cartTotals.subtotal / 100, currency.displayCurrency) ?? 0) : 0}
                    currencySymbol={getCurrencySymbol(currency.displayCurrency)}
                    fiatStyle={isSatsMain ? styles.totalValueSats : styles.totalValue}
                    satsStyle={isSatsMain ? styles.totalValue : styles.totalValueSats}
                    showSats={true}
                  />
                </View>
                {cartTotals.discountTotal > 0 && (
                  <View style={styles.totalRow}>
                    <Text style={styles.totalLabel}>Discount</Text>
                    <PriceDisplay
                      fiatAmount={cartTotals.discountTotal / 100}
                      satsAmount={currency.exchangeRate ? (fiatToSatsSync(cartTotals.discountTotal / 100, currency.displayCurrency) ?? 0) : 0}
                      currencySymbol={getCurrencySymbol(currency.displayCurrency)}
                      fiatStyle={isSatsMain ? [styles.totalValueSats, styles.discountValue] : [styles.totalValue, styles.discountValue]}
                      satsStyle={isSatsMain ? [styles.totalValue, styles.discountValue] : [styles.totalValueSats, styles.discountValue]}
                      showSats={true}
                    />
                  </View>
                )}
                {cartTotals.taxTotal > 0 && (
                  <View style={styles.totalRow}>
                    <Text style={styles.totalLabel}>Tax</Text>
                    <PriceDisplay
                      fiatAmount={cartTotals.taxTotal / 100}
                      satsAmount={currency.exchangeRate ? (fiatToSatsSync(cartTotals.taxTotal / 100, currency.displayCurrency) ?? 0) : 0}
                      currencySymbol={getCurrencySymbol(currency.displayCurrency)}
                      fiatStyle={isSatsMain ? styles.totalValueSats : styles.totalValue}
                      satsStyle={isSatsMain ? styles.totalValue : styles.totalValueSats}
                      showSats={true}
                    />
                  </View>
                )}
                <View style={[styles.totalRow, styles.grandTotalRow]}>
                  <Text style={styles.grandTotalLabel}>Total</Text>
                  <PriceDisplay
                    fiatAmount={cartTotals.total / 100}
                    satsAmount={currency.exchangeRate ? (fiatToSatsSync(cartTotals.total / 100, currency.displayCurrency) ?? 0) : 0}
                    currencySymbol={getCurrencySymbol(currency.displayCurrency)}
                    fiatStyle={isSatsMain ? styles.grandTotalSats : styles.grandTotalValue}
                    satsStyle={isSatsMain ? styles.grandTotalValue : styles.grandTotalSats}
                    showSats={true}
                  />
                </View>
              </View>
            )}

            {/* Checkout Button */}
            <Pressable
              style={[styles.checkoutButton, cart.items.length === 0 && styles.checkoutButtonDisabled]}
              onPress={handleCheckout}
              disabled={cart.items.length === 0}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Text style={styles.checkoutButtonText}>
                  Charge
                </Text>
                <PriceDisplay
                  fiatAmount={cartTotals.total / 100}
                  satsAmount={currency.exchangeRate ? (fiatToSatsSync(cartTotals.total / 100, currency.displayCurrency) ?? 0) : 0}
                  currencySymbol={getCurrencySymbol(currency.displayCurrency)}
                  fiatStyle={isSatsMain ? styles.checkoutButtonSats : styles.checkoutButtonText}
                  satsStyle={isSatsMain ? styles.checkoutButtonText : styles.checkoutButtonSats}
                  showSats={true}
                />
              </View>
            </Pressable>

            {!isTablet && (
              <Pressable style={styles.closeCartButton} onPress={() => setShowCart(false)}>
                <Text style={styles.closeCartText}>Close</Text>
              </Pressable>
            )}
          </Animated.View>
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
    flex: 1, // Allow right side to take available space
    justifyContent: 'flex-end',
  },
  searchContainer: {
    width: '100%', // Take available space
    maxWidth: 200, // But not more than 200
    flex: 1, // Allow shrinking
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
    height: 180, // Reduced from 210
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
    height: 110,
    width: '100%',
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
    padding: 8,
    paddingBottom: 12, // Increased to lift price up
    flex: 1,
    justifyContent: 'space-between',
  },
  productName: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 4,
  },
  productPriceContainer: {
    alignItems: 'flex-end',
    flexDirection: 'column-reverse',
    marginBottom: 4, // Increased slightly
  },
  productPrice: {
    color: '#4ade80',
    fontSize: 16,
    fontWeight: '700',
  },
  productPriceSats: {
    color: '#4ade80',
    fontSize: 14,
    fontWeight: '500',
    opacity: 0.8,
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
    flexDirection: 'column',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#2a2a3e',
  },
  cartItemHeader: {
    marginBottom: 8,
  },
  cartItemFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cartItemRight: {
    flexDirection: 'row',
    alignItems: 'center',
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
  cartItemPriceSats: {
    color: '#888',
    fontSize: 10,
    marginTop: 2,
    opacity: 0.8,
  },
  cartItemActions: {
    flexDirection: 'row',
    alignItems: 'center',
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
  cartItemTotalContainer: {
    minWidth: 60,
    alignItems: 'flex-end',
  },
  cartItemTotalText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  cartItemTotalSatsText: {
    color: '#4ade80',
    fontSize: 12,
    fontWeight: '500',
    opacity: 0.8,
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
  totalValueSats: {
    color: '#4ade80',
    fontSize: 12,
    fontWeight: '500',
    opacity: 0.8,
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
  grandTotalSats: {
    color: '#4ade80',
    fontSize: 16,
    fontWeight: '600',
    opacity: 0.8,
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
  checkoutButtonSats: {
    color: '#0f0f1a',
    fontSize: 14,
    fontWeight: '600',
    opacity: 0.8,
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

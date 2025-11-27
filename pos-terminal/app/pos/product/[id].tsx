/**
 * Product Detail Screen
 *
 * Allows selecting variants, modifiers, quantity, and notes before adding to cart.
 */

import { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';

import { useCatalogStore, useCartStore } from '@/store';
import type { ProductVariant, ModifierGroup, Modifier } from '@/types/catalog';
import type { SelectedModifier } from '@/types/cart';

// Format price from cents to display string
function formatPrice(cents: number): string {
  if (cents === 0) return 'Free';
  const sign = cents > 0 ? '+' : '';
  return `${sign}$${(Math.abs(cents) / 100).toFixed(2)}`;
}

function formatTotalPrice(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

// Variant Selection Component
function VariantSelector({
  variants,
  selectedVariant,
  onSelect,
}: {
  variants: ProductVariant[];
  selectedVariant: ProductVariant | undefined;
  onSelect: (variant: ProductVariant) => void;
}) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Select Option</Text>
      <View style={styles.optionsGrid}>
        {variants.map((variant) => (
          <Pressable
            key={variant.id}
            style={[
              styles.optionButton,
              selectedVariant?.id === variant.id && styles.optionButtonSelected,
            ]}
            onPress={() => onSelect(variant)}
          >
            <Text
              style={[
                styles.optionText,
                selectedVariant?.id === variant.id && styles.optionTextSelected,
              ]}
            >
              {variant.name}
            </Text>
            {variant.price_adjustment !== 0 && (
              <Text
                style={[
                  styles.optionPrice,
                  selectedVariant?.id === variant.id && styles.optionPriceSelected,
                ]}
              >
                {formatPrice(variant.price_adjustment)}
              </Text>
            )}
          </Pressable>
        ))}
      </View>
    </View>
  );
}

// Modifier Group Component
function ModifierGroupSelector({
  group,
  selectedModifiers,
  onToggle,
}: {
  group: ModifierGroup;
  selectedModifiers: SelectedModifier[];
  onToggle: (modifier: Modifier) => void;
}) {
  const selectedInGroup = selectedModifiers.filter(
    (m) => m.modifierGroupId === group.id
  );

  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>{group.name}</Text>
        {group.required && (
          <Text style={styles.requiredBadge}>Required</Text>
        )}
        {group.max_selections && (
          <Text style={styles.selectionHint}>
            {group.selection_type === 'single'
              ? 'Select one'
              : `Select up to ${group.max_selections}`}
          </Text>
        )}
      </View>
      <View style={styles.optionsGrid}>
        {group.modifiers.map((modifier) => {
          const isSelected = selectedModifiers.some(
            (m) => m.modifier.id === modifier.id
          );
          return (
            <Pressable
              key={modifier.id}
              style={[
                styles.optionButton,
                isSelected && styles.optionButtonSelected,
              ]}
              onPress={() => onToggle(modifier)}
            >
              <Text
                style={[
                  styles.optionText,
                  isSelected && styles.optionTextSelected,
                ]}
              >
                {modifier.name}
              </Text>
              {modifier.price_adjustment !== 0 && (
                <Text
                  style={[
                    styles.optionPrice,
                    isSelected && styles.optionPriceSelected,
                  ]}
                >
                  {formatPrice(modifier.price_adjustment)}
                </Text>
              )}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

// Quantity Selector Component
function QuantitySelector({
  quantity,
  onIncrement,
  onDecrement,
}: {
  quantity: number;
  onIncrement: () => void;
  onDecrement: () => void;
}) {
  return (
    <View style={styles.quantitySection}>
      <Text style={styles.sectionTitle}>Quantity</Text>
      <View style={styles.quantityControls}>
        <Pressable
          style={[styles.qtyButton, quantity <= 1 && styles.qtyButtonDisabled]}
          onPress={onDecrement}
          disabled={quantity <= 1}
        >
          <Text style={styles.qtyButtonText}>-</Text>
        </Pressable>
        <Text style={styles.qtyValue}>{quantity}</Text>
        <Pressable style={styles.qtyButton} onPress={onIncrement}>
          <Text style={styles.qtyButtonText}>+</Text>
        </Pressable>
      </View>
    </View>
  );
}

export default function ProductDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();

  // Get product from store
  const product = useCatalogStore((s) => s.getProduct(id));
  const modifierGroups = useCatalogStore((s) => s.getModifierGroupsForProduct(id));
  const addToCart = useCartStore((s) => s.addToCart);

  // Local state
  const [selectedVariant, setSelectedVariant] = useState<ProductVariant | undefined>(
    product?.variants?.[0]
  );
  const [selectedModifiers, setSelectedModifiers] = useState<SelectedModifier[]>([]);
  const [quantity, setQuantity] = useState(1);
  const [notes, setNotes] = useState('');

  // Calculate total price
  const totalPrice = useMemo(() => {
    if (!product) return 0;

    let price = product.price;

    if (selectedVariant) {
      price += selectedVariant.price_adjustment;
    }

    for (const mod of selectedModifiers) {
      price += mod.modifier.price_adjustment;
    }

    return price * quantity;
  }, [product, selectedVariant, selectedModifiers, quantity]);

  // Handle modifier toggle
  const handleModifierToggle = (group: ModifierGroup, modifier: Modifier) => {
    setSelectedModifiers((prev) => {
      const isSelected = prev.some((m) => m.modifier.id === modifier.id);

      if (isSelected) {
        // Remove modifier
        return prev.filter((m) => m.modifier.id !== modifier.id);
      }

      if (group.selection_type === 'single') {
        // Replace any existing modifier from this group
        const withoutGroup = prev.filter((m) => m.modifierGroupId !== group.id);
        return [
          ...withoutGroup,
          {
            modifier,
            modifierGroupId: group.id,
            modifierGroupName: group.name,
          },
        ];
      }

      // Check max selections
      const currentInGroup = prev.filter((m) => m.modifierGroupId === group.id);
      if (group.max_selections && currentInGroup.length >= group.max_selections) {
        return prev;
      }

      // Add modifier
      return [
        ...prev,
        {
          modifier,
          modifierGroupId: group.id,
          modifierGroupName: group.name,
        },
      ];
    });
  };

  // Handle add to cart
  const handleAddToCart = () => {
    if (!product) return;

    // Validate required modifiers
    for (const group of modifierGroups) {
      if (group.required) {
        const hasSelection = selectedModifiers.some(
          (m) => m.modifierGroupId === group.id
        );
        if (!hasSelection) {
          // TODO: Show error toast
          return;
        }
      }
    }

    addToCart({
      product,
      variant: selectedVariant,
      modifiers: selectedModifiers,
      quantity,
      notes: notes || undefined,
    });

    router.back();
  };

  if (!product) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorState}>
          <Text style={styles.errorText}>Product not found</Text>
          <Pressable style={styles.backLink} onPress={() => router.back()}>
            <Text style={styles.backLinkText}>Go back</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView style={styles.scrollContent}>
        {/* Product Header */}
        <View style={styles.productHeader}>
          <View style={[styles.productImage, { backgroundColor: product.category?.color || '#2a2a3e' }]}>
            <Text style={styles.productImageText}>
              {product.name.charAt(0).toUpperCase()}
            </Text>
          </View>
          <View style={styles.productInfo}>
            <Text style={styles.productName}>{product.name}</Text>
            {product.description && (
              <Text style={styles.productDescription}>{product.description}</Text>
            )}
            <Text style={styles.basePrice}>
              Starting at {formatTotalPrice(product.price)}
            </Text>
          </View>
        </View>

        {/* Variants */}
        {product.has_variants && product.variants && product.variants.length > 0 && (
          <VariantSelector
            variants={product.variants}
            selectedVariant={selectedVariant}
            onSelect={setSelectedVariant}
          />
        )}

        {/* Modifier Groups */}
        {modifierGroups.map((group) => (
          <ModifierGroupSelector
            key={group.id}
            group={group}
            selectedModifiers={selectedModifiers}
            onToggle={(modifier) => handleModifierToggle(group, modifier)}
          />
        ))}

        {/* Quantity */}
        <QuantitySelector
          quantity={quantity}
          onIncrement={() => setQuantity((q) => q + 1)}
          onDecrement={() => setQuantity((q) => Math.max(1, q - 1))}
        />

        {/* Notes */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Special Instructions</Text>
          <TextInput
            style={styles.notesInput}
            placeholder="Add notes for kitchen..."
            placeholderTextColor="#666"
            value={notes}
            onChangeText={setNotes}
            multiline
            numberOfLines={3}
          />
        </View>
      </ScrollView>

      {/* Add to Cart Button */}
      <View style={styles.footer}>
        <Pressable style={styles.addButton} onPress={handleAddToCart}>
          <Text style={styles.addButtonText}>
            Add to Cart - {formatTotalPrice(totalPrice)}
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f0f1a',
  },
  scrollContent: {
    flex: 1,
  },
  errorState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    color: '#888',
    fontSize: 18,
    marginBottom: 16,
  },
  backLink: {
    padding: 12,
  },
  backLinkText: {
    color: '#4ade80',
    fontSize: 16,
  },
  productHeader: {
    flexDirection: 'row',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#2a2a3e',
  },
  productImage: {
    width: 100,
    height: 100,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  productImageText: {
    fontSize: 36,
    color: '#fff',
    fontWeight: '700',
    opacity: 0.5,
  },
  productInfo: {
    flex: 1,
    marginLeft: 16,
    justifyContent: 'center',
  },
  productName: {
    fontSize: 24,
    fontWeight: '700',
    color: '#fff',
  },
  productDescription: {
    fontSize: 14,
    color: '#888',
    marginTop: 4,
    lineHeight: 20,
  },
  basePrice: {
    fontSize: 18,
    color: '#4ade80',
    fontWeight: '600',
    marginTop: 8,
  },
  section: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#2a2a3e',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    flexWrap: 'wrap',
    gap: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 12,
  },
  requiredBadge: {
    backgroundColor: '#ef4444',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    color: '#fff',
    fontSize: 10,
    fontWeight: '600',
    overflow: 'hidden',
  },
  selectionHint: {
    color: '#666',
    fontSize: 12,
  },
  optionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  optionButton: {
    backgroundColor: '#1a1a2e',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#2a2a3e',
  },
  optionButtonSelected: {
    backgroundColor: '#4ade80',
    borderColor: '#4ade80',
  },
  optionText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },
  optionTextSelected: {
    color: '#0f0f1a',
  },
  optionPrice: {
    color: '#888',
    fontSize: 12,
    marginTop: 2,
  },
  optionPriceSelected: {
    color: '#0f0f1a',
    opacity: 0.7,
  },
  quantitySection: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#2a2a3e',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  quantityControls: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  qtyButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#2a2a3e',
    justifyContent: 'center',
    alignItems: 'center',
  },
  qtyButtonDisabled: {
    opacity: 0.5,
  },
  qtyButtonText: {
    color: '#fff',
    fontSize: 24,
    fontWeight: '600',
  },
  qtyValue: {
    color: '#fff',
    fontSize: 24,
    fontWeight: '700',
    marginHorizontal: 24,
    minWidth: 40,
    textAlign: 'center',
  },
  notesInput: {
    backgroundColor: '#1a1a2e',
    borderRadius: 8,
    padding: 16,
    color: '#fff',
    fontSize: 14,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  footer: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#2a2a3e',
  },
  addButton: {
    backgroundColor: '#4ade80',
    paddingVertical: 18,
    borderRadius: 12,
    alignItems: 'center',
  },
  addButtonText: {
    color: '#0f0f1a',
    fontSize: 18,
    fontWeight: '700',
  },
});

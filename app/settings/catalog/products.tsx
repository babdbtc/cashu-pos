/**
 * Products Management Screen
 *
 * List, add, edit, and delete products.
 */

import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  TextInput,
  Modal,
  Alert,
  Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useCatalogStore } from '@/store/catalog.store';
import { useConfigStore } from '@/store/config.store';
import type { Product, Category } from '@/types/catalog';

interface ProductFormData {
  name: string;
  description: string;
  price: string;
  category_id: string | null;
  image_url: string | null;
  sku: string;
  barcode: string;
  tax_rate: string;
}

export default function ProductsScreen() {
  const router = useRouter();
  const categories = useCatalogStore((state) => state.categories);
  const products = useCatalogStore((state) => state.products);
  const addProduct = useCatalogStore((state) => state.addProduct);
  const updateProduct = useCatalogStore((state) => state.updateProduct);
  const deleteProduct = useCatalogStore((state) => state.deleteProduct);
  const currency = useConfigStore((state) => state.currency);

  const [modalVisible, setModalVisible] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [filterCategoryId, setFilterCategoryId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [formData, setFormData] = useState<ProductFormData>({
    name: '',
    description: '',
    price: '',
    category_id: null,
    image_url: null,
    sku: '',
    barcode: '',
    tax_rate: '0',
  });

  const filteredProducts = products.filter((product) => {
    if (filterCategoryId && product.category_id !== filterCategoryId) {
      return false;
    }
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        product.name.toLowerCase().includes(query) ||
        product.sku?.toLowerCase().includes(query) ||
        product.barcode?.toLowerCase().includes(query)
      );
    }
    return true;
  });

  const getCategoryName = (categoryId: string | null) => {
    if (!categoryId) return 'Uncategorized';
    const category = categories.find((c) => c.id === categoryId);
    return category?.name || 'Unknown';
  };

  const getCategoryColor = (categoryId: string | null) => {
    if (!categoryId) return '#666';
    const category = categories.find((c) => c.id === categoryId);
    return category?.color || '#666';
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency.displayCurrency,
    }).format(price / 100);
  };

  const openNewProduct = () => {
    setEditingProduct(null);
    setFormData({
      name: '',
      description: '',
      price: '',
      category_id: filterCategoryId,
      image_url: null,
      sku: '',
      barcode: '',
      tax_rate: '0',
    });
    setModalVisible(true);
  };

  const openEditProduct = (product: Product) => {
    setEditingProduct(product);
    setFormData({
      name: product.name,
      description: product.description || '',
      price: (product.price / 100).toFixed(2),
      category_id: product.category_id || null,
      image_url: product.image_url || null,
      sku: product.sku || '',
      barcode: product.barcode || '',
      tax_rate: (product.tax_rate * 100).toString(),
    });
    setModalVisible(true);
  };

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      setFormData({ ...formData, image_url: result.assets[0].uri });
    }
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      Alert.alert('Error', 'Product name is required');
      return;
    }

    const priceNum = parseFloat(formData.price);
    if (isNaN(priceNum) || priceNum < 0) {
      Alert.alert('Error', 'Please enter a valid price');
      return;
    }

    const taxRate = parseFloat(formData.tax_rate) / 100;

    try {
      const productData = {
        name: formData.name.trim(),
        description: formData.description.trim() || null,
        price: Math.round(priceNum * 100), // Store in cents
        category_id: formData.category_id,
        image_url: formData.image_url,
        sku: formData.sku.trim() || null,
        barcode: formData.barcode.trim() || null,
        tax_rate: isNaN(taxRate) ? 0 : taxRate,
        active: true,
        track_inventory: false,
        allow_backorder: true,
        has_variants: false,
        sort_order: editingProduct?.sort_order || products.length,
        cost: null,
        store_id: 'local',
      };

      if (editingProduct) {
        await updateProduct(editingProduct.id, productData);
      } else {
        await addProduct(productData);
      }
      setModalVisible(false);
    } catch (error) {
      Alert.alert('Error', 'Failed to save product');
    }
  };

  const handleDelete = (product: Product) => {
    Alert.alert('Delete Product', `Are you sure you want to delete "${product.name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => deleteProduct(product.id),
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      {/* Back Button */}
      <Pressable onPress={() => router.back()} style={styles.backButton}>
        <Ionicons name="chevron-back" size={28} color="#fff" />
      </Pressable>

      {/* Search & Filter Bar */}
      <View style={styles.filterBar}>
        <TextInput
          style={styles.searchInput}
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="Search products..."
          placeholderTextColor="#666"
        />
      </View>

      {/* Category Filter */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.categoryFilter}
        contentContainerStyle={styles.categoryFilterContent}
      >
        <Pressable
          style={[
            styles.categoryChip,
            !filterCategoryId && styles.categoryChipActive,
          ]}
          onPress={() => setFilterCategoryId(null)}
        >
          <Text
            style={[
              styles.categoryChipText,
              !filterCategoryId && styles.categoryChipTextActive,
            ]}
          >
            All ({products.length})
          </Text>
        </Pressable>
        {categories.map((category) => {
          const count = products.filter((p) => p.category_id === category.id).length;
          return (
            <Pressable
              key={category.id}
              style={[
                styles.categoryChip,
                filterCategoryId === category.id && styles.categoryChipActive,
                { borderColor: category.color || '#666' },
              ]}
              onPress={() => setFilterCategoryId(category.id)}
            >
              <Text style={styles.categoryChipIcon}>{category.icon}</Text>
              <Text
                style={[
                  styles.categoryChipText,
                  filterCategoryId === category.id && styles.categoryChipTextActive,
                ]}
              >
                {category.name} ({count})
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {/* Products List */}
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {filteredProducts.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>📦</Text>
            <Text style={styles.emptyTitle}>No Products Found</Text>
            <Text style={styles.emptyText}>
              {searchQuery
                ? 'Try a different search term'
                : 'Add your first product to get started'}
            </Text>
          </View>
        ) : (
          <View style={styles.list}>
            {filteredProducts.map((product) => (
              <Pressable
                key={product.id}
                style={styles.productCard}
                onPress={() => openEditProduct(product)}
              >
                {product.image_url ? (
                  <Image source={{ uri: product.image_url }} style={styles.productImage} />
                ) : (
                  <View style={styles.productImagePlaceholder}>
                    <Text style={styles.productImagePlaceholderText}>📷</Text>
                  </View>
                )}
                <View style={styles.productInfo}>
                  <Text style={styles.productName}>{product.name}</Text>
                  <View style={styles.productMeta}>
                    <View
                      style={[
                        styles.categoryBadge,
                        { backgroundColor: getCategoryColor(product.category_id) },
                      ]}
                    >
                      <Text style={styles.categoryBadgeText}>
                        {getCategoryName(product.category_id)}
                      </Text>
                    </View>
                    {product.sku && (
                      <Text style={styles.productSku}>SKU: {product.sku}</Text>
                    )}
                  </View>
                </View>
                <View style={styles.productRight}>
                  <Text style={styles.productPrice}>{formatPrice(product.price)}</Text>
                  <Pressable
                    style={styles.deleteButton}
                    onPress={() => handleDelete(product)}
                  >
                    <Text style={styles.deleteButtonText}>×</Text>
                  </Pressable>
                </View>
              </Pressable>
            ))}
          </View>
        )}
      </ScrollView>

      {/* Add Button */}
      <Pressable style={styles.addButton} onPress={openNewProduct}>
        <Text style={styles.addButtonText}>+ Add Product</Text>
      </Pressable>

      {/* Product Editor Modal */}
      <Modal visible={modalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {editingProduct ? 'Edit Product' : 'New Product'}
              </Text>
              <Pressable onPress={() => setModalVisible(false)}>
                <Text style={styles.modalClose}>×</Text>
              </Pressable>
            </View>

            <ScrollView style={styles.modalBody}>
              {/* Image Picker */}
              <Pressable style={styles.imagePicker} onPress={pickImage}>
                {formData.image_url ? (
                  <Image source={{ uri: formData.image_url }} style={styles.imagePreview} />
                ) : (
                  <View style={styles.imagePlaceholder}>
                    <Text style={styles.imagePlaceholderIcon}>📷</Text>
                    <Text style={styles.imagePlaceholderText}>Add Image</Text>
                  </View>
                )}
              </Pressable>

              {/* Name Input */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Name *</Text>
                <TextInput
                  style={styles.textInput}
                  value={formData.name}
                  onChangeText={(text) => setFormData({ ...formData, name: text })}
                  placeholder="e.g., Cappuccino"
                  placeholderTextColor="#666"
                />
              </View>

              {/* Description Input */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Description</Text>
                <TextInput
                  style={[styles.textInput, styles.textArea]}
                  value={formData.description}
                  onChangeText={(text) => setFormData({ ...formData, description: text })}
                  placeholder="Optional description"
                  placeholderTextColor="#666"
                  multiline
                  numberOfLines={3}
                />
              </View>

              {/* Price Input */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Price ({currency.displayCurrency}) *</Text>
                <TextInput
                  style={styles.textInput}
                  value={formData.price}
                  onChangeText={(text) => setFormData({ ...formData, price: text })}
                  placeholder="0.00"
                  placeholderTextColor="#666"
                  keyboardType="decimal-pad"
                />
              </View>

              {/* Category Selector */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Category</Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={styles.categorySelector}
                >
                  <Pressable
                    style={[
                      styles.categorySelectorItem,
                      !formData.category_id && styles.categorySelectorItemActive,
                    ]}
                    onPress={() => setFormData({ ...formData, category_id: null })}
                  >
                    <Text style={styles.categorySelectorText}>None</Text>
                  </Pressable>
                  {categories.map((category) => (
                    <Pressable
                      key={category.id}
                      style={[
                        styles.categorySelectorItem,
                        formData.category_id === category.id && styles.categorySelectorItemActive,
                        { borderColor: category.color || '#666' },
                      ]}
                      onPress={() => setFormData({ ...formData, category_id: category.id })}
                    >
                      <Text style={styles.categorySelectorIcon}>{category.icon}</Text>
                      <Text style={styles.categorySelectorText}>{category.name}</Text>
                    </Pressable>
                  ))}
                </ScrollView>
              </View>

              {/* SKU & Barcode */}
              <View style={styles.rowInputs}>
                <View style={[styles.inputGroup, { flex: 1 }]}>
                  <Text style={styles.inputLabel}>SKU</Text>
                  <TextInput
                    style={styles.textInput}
                    value={formData.sku}
                    onChangeText={(text) => setFormData({ ...formData, sku: text })}
                    placeholder="Optional"
                    placeholderTextColor="#666"
                  />
                </View>
                <View style={[styles.inputGroup, { flex: 1 }]}>
                  <Text style={styles.inputLabel}>Barcode</Text>
                  <TextInput
                    style={styles.textInput}
                    value={formData.barcode}
                    onChangeText={(text) => setFormData({ ...formData, barcode: text })}
                    placeholder="Optional"
                    placeholderTextColor="#666"
                  />
                </View>
              </View>

              {/* Tax Rate */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Tax Rate (%)</Text>
                <TextInput
                  style={styles.textInput}
                  value={formData.tax_rate}
                  onChangeText={(text) => setFormData({ ...formData, tax_rate: text })}
                  placeholder="0"
                  placeholderTextColor="#666"
                  keyboardType="decimal-pad"
                />
              </View>
            </ScrollView>

            <View style={styles.modalFooter}>
              <Pressable
                style={styles.cancelButton}
                onPress={() => setModalVisible(false)}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </Pressable>
              <Pressable style={styles.saveButton} onPress={handleSave}>
                <Text style={styles.saveButtonText}>
                  {editingProduct ? 'Save Changes' : 'Create Product'}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f0f1a',
  },
  backButton: {
    padding: 12,
    paddingLeft: 8,
  },
  filterBar: {
    padding: 16,
    paddingBottom: 8,
  },
  searchInput: {
    backgroundColor: '#1a1a2e',
    borderRadius: 12,
    padding: 12,
    fontSize: 16,
    color: '#ffffff',
    borderWidth: 1,
    borderColor: '#2a2a3e',
  },
  categoryFilter: {
    maxHeight: 50,
  },
  categoryFilterContent: {
    paddingHorizontal: 16,
    gap: 8,
  },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a2e',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#2a2a3e',
    gap: 4,
  },
  categoryChipActive: {
    backgroundColor: '#00d4ff',
    borderColor: '#00d4ff',
  },
  categoryChipIcon: {
    fontSize: 14,
  },
  categoryChipText: {
    fontSize: 13,
    color: '#888',
  },
  categoryChipTextActive: {
    color: '#0f0f1a',
    fontWeight: '600',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 100,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: '#888',
    textAlign: 'center',
  },
  list: {
    gap: 8,
  },
  productCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a2e',
    padding: 12,
    borderRadius: 12,
  },
  productImage: {
    width: 56,
    height: 56,
    borderRadius: 8,
    marginRight: 12,
  },
  productImagePlaceholder: {
    width: 56,
    height: 56,
    borderRadius: 8,
    backgroundColor: '#2a2a3e',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  productImagePlaceholderText: {
    fontSize: 24,
  },
  productInfo: {
    flex: 1,
  },
  productName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 4,
  },
  productMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  categoryBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  categoryBadgeText: {
    fontSize: 11,
    color: '#ffffff',
    fontWeight: '500',
  },
  productSku: {
    fontSize: 11,
    color: '#666',
  },
  productRight: {
    alignItems: 'flex-end',
  },
  productPrice: {
    fontSize: 16,
    fontWeight: '700',
    color: '#00d4ff',
    marginBottom: 4,
  },
  deleteButton: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteButtonText: {
    fontSize: 20,
    color: '#666',
  },
  addButton: {
    position: 'absolute',
    bottom: 24,
    left: 16,
    right: 16,
    backgroundColor: '#00d4ff',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  addButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0f0f1a',
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#1a1a2e',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#2a2a3e',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#ffffff',
  },
  modalClose: {
    fontSize: 32,
    color: '#888',
  },
  modalBody: {
    padding: 20,
  },
  modalFooter: {
    flexDirection: 'row',
    padding: 20,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: '#2a2a3e',
  },
  imagePicker: {
    alignItems: 'center',
    marginBottom: 20,
  },
  imagePreview: {
    width: 120,
    height: 120,
    borderRadius: 12,
  },
  imagePlaceholder: {
    width: 120,
    height: 120,
    borderRadius: 12,
    backgroundColor: '#0f0f1a',
    borderWidth: 2,
    borderColor: '#2a2a3e',
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  imagePlaceholderIcon: {
    fontSize: 32,
    marginBottom: 4,
  },
  imagePlaceholderText: {
    fontSize: 12,
    color: '#888',
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#888',
    marginBottom: 8,
  },
  textInput: {
    backgroundColor: '#0f0f1a',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: '#ffffff',
    borderWidth: 1,
    borderColor: '#2a2a3e',
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  rowInputs: {
    flexDirection: 'row',
    gap: 12,
  },
  categorySelector: {
    maxHeight: 50,
  },
  categorySelectorItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0f0f1a',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#2a2a3e',
    marginRight: 8,
    gap: 4,
  },
  categorySelectorItemActive: {
    borderColor: '#00d4ff',
    backgroundColor: 'rgba(0, 212, 255, 0.1)',
  },
  categorySelectorIcon: {
    fontSize: 16,
  },
  categorySelectorText: {
    fontSize: 14,
    color: '#ffffff',
  },
  cancelButton: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#2a2a3e',
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
  },
  saveButton: {
    flex: 2,
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#00d4ff',
    alignItems: 'center',
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0f0f1a',
  },
});

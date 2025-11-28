/**
 * Categories Management Screen
 *
 * List, add, edit, and delete product categories.
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
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useCatalogStore } from '@/store/catalog.store';
import type { Category } from '@/types/catalog';

const CATEGORY_COLORS = [
  '#ef4444', '#f97316', '#eab308', '#22c55e', '#14b8a6',
  '#06b6d4', '#3b82f6', '#6366f1', '#8b5cf6', '#ec4899',
];

const CATEGORY_ICONS = [
  '☕', '🍔', '🍕', '🥗', '🍰', '🍺', '🧃', '🛒', '👕', '📱',
  '💄', '🎮', '📚', '🎁', '⭐', '🔥', '💎', '🌟', '🎨', '🍿',
];

interface CategoryFormData {
  name: string;
  description: string;
  color: string;
  icon: string;
}

export default function CategoriesScreen() {
  const router = useRouter();
  const categories = useCatalogStore((state) => state.categories);
  const products = useCatalogStore((state) => state.products);
  const addCategory = useCatalogStore((state) => state.addCategory);
  const updateCategory = useCatalogStore((state) => state.updateCategory);
  const deleteCategory = useCatalogStore((state) => state.deleteCategory);

  const [modalVisible, setModalVisible] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [formData, setFormData] = useState<CategoryFormData>({
    name: '',
    description: '',
    color: CATEGORY_COLORS[0],
    icon: CATEGORY_ICONS[0],
  });

  const getProductCount = (categoryId: string) => {
    return products.filter((p) => p.category_id === categoryId).length;
  };

  const openNewCategory = () => {
    setEditingCategory(null);
    setFormData({
      name: '',
      description: '',
      color: CATEGORY_COLORS[Math.floor(Math.random() * CATEGORY_COLORS.length)],
      icon: CATEGORY_ICONS[0],
    });
    setModalVisible(true);
  };

  const openEditCategory = (category: Category) => {
    setEditingCategory(category);
    setFormData({
      name: category.name,
      description: category.description || '',
      color: category.color || CATEGORY_COLORS[0],
      icon: category.icon || CATEGORY_ICONS[0],
    });
    setModalVisible(true);
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      Alert.alert('Error', 'Category name is required');
      return;
    }

    try {
      if (editingCategory) {
        await updateCategory(editingCategory.id, {
          name: formData.name.trim(),
          description: formData.description.trim() || null,
          color: formData.color,
          icon: formData.icon,
        });
      } else {
        await addCategory({
          name: formData.name.trim(),
          description: formData.description.trim() || null,
          color: formData.color,
          icon: formData.icon,
          sort_order: categories.length,
          active: true,
          store_id: 'local',
        });
      }
      setModalVisible(false);
    } catch (error) {
      Alert.alert('Error', 'Failed to save category');
    }
  };

  const handleDelete = (category: Category) => {
    const productCount = getProductCount(category.id);

    if (productCount > 0) {
      Alert.alert(
        'Cannot Delete',
        `This category has ${productCount} products. Please move or delete them first.`
      );
      return;
    }

    Alert.alert('Delete Category', `Are you sure you want to delete "${category.name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => deleteCategory(category.id),
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      {/* Back Button */}
      <Pressable onPress={() => router.back()} style={styles.backButton}>
        <Ionicons name="chevron-back" size={28} color="#fff" />
      </Pressable>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {categories.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>📁</Text>
            <Text style={styles.emptyTitle}>No Categories Yet</Text>
            <Text style={styles.emptyText}>
              Create categories to organize your products
            </Text>
          </View>
        ) : (
          <View style={styles.list}>
            {categories.map((category) => (
              <Pressable
                key={category.id}
                style={styles.categoryCard}
                onPress={() => openEditCategory(category)}
              >
                <View style={[styles.categoryIcon, { backgroundColor: category.color || '#3b82f6' }]}>
                  <Text style={styles.categoryIconText}>{category.icon || '📁'}</Text>
                </View>
                <View style={styles.categoryInfo}>
                  <Text style={styles.categoryName}>{category.name}</Text>
                  <Text style={styles.categoryCount}>
                    {getProductCount(category.id)} products
                  </Text>
                </View>
                <Pressable
                  style={styles.deleteButton}
                  onPress={() => handleDelete(category)}
                >
                  <Text style={styles.deleteButtonText}>×</Text>
                </Pressable>
              </Pressable>
            ))}
          </View>
        )}
      </ScrollView>

      {/* Add Button */}
      <Pressable style={styles.addButton} onPress={openNewCategory}>
        <Text style={styles.addButtonText}>+ Add Category</Text>
      </Pressable>

      {/* Category Editor Modal */}
      <Modal visible={modalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {editingCategory ? 'Edit Category' : 'New Category'}
              </Text>
              <Pressable onPress={() => setModalVisible(false)}>
                <Text style={styles.modalClose}>×</Text>
              </Pressable>
            </View>

            <ScrollView style={styles.modalBody}>
              {/* Name Input */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Name *</Text>
                <TextInput
                  style={styles.textInput}
                  value={formData.name}
                  onChangeText={(text) => setFormData({ ...formData, name: text })}
                  placeholder="e.g., Hot Drinks"
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

              {/* Icon Picker */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Icon</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <View style={styles.pickerRow}>
                    {CATEGORY_ICONS.map((icon) => (
                      <Pressable
                        key={icon}
                        style={[
                          styles.iconOption,
                          formData.icon === icon && styles.iconOptionSelected,
                        ]}
                        onPress={() => setFormData({ ...formData, icon })}
                      >
                        <Text style={styles.iconOptionText}>{icon}</Text>
                      </Pressable>
                    ))}
                  </View>
                </ScrollView>
              </View>

              {/* Color Picker */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Color</Text>
                <View style={styles.colorPickerRow}>
                  {CATEGORY_COLORS.map((color) => (
                    <Pressable
                      key={color}
                      style={[
                        styles.colorOption,
                        { backgroundColor: color },
                        formData.color === color && styles.colorOptionSelected,
                      ]}
                      onPress={() => setFormData({ ...formData, color })}
                    />
                  ))}
                </View>
              </View>

              {/* Preview */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Preview</Text>
                <View style={styles.previewCard}>
                  <View style={[styles.categoryIcon, { backgroundColor: formData.color }]}>
                    <Text style={styles.categoryIconText}>{formData.icon}</Text>
                  </View>
                  <Text style={styles.previewName}>
                    {formData.name || 'Category Name'}
                  </Text>
                </View>
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
                  {editingCategory ? 'Save Changes' : 'Create Category'}
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
  categoryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a2e',
    padding: 16,
    borderRadius: 12,
  },
  categoryIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  categoryIconText: {
    fontSize: 24,
  },
  categoryInfo: {
    flex: 1,
  },
  categoryName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 2,
  },
  categoryCount: {
    fontSize: 13,
    color: '#888',
  },
  deleteButton: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteButtonText: {
    fontSize: 24,
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
  inputGroup: {
    marginBottom: 20,
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
  pickerRow: {
    flexDirection: 'row',
    gap: 8,
  },
  iconOption: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#0f0f1a',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  iconOptionSelected: {
    borderColor: '#00d4ff',
  },
  iconOptionText: {
    fontSize: 24,
  },
  colorPickerRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  colorOption: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 3,
    borderColor: 'transparent',
  },
  colorOptionSelected: {
    borderColor: '#ffffff',
  },
  previewCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0f0f1a',
    padding: 16,
    borderRadius: 12,
  },
  previewName: {
    fontSize: 16,
    fontWeight: '600',
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

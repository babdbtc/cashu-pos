/**
 * Table Areas Management Screen
 *
 * Manage restaurant areas/sections (e.g., Main Dining, Patio, Bar).
 */

import { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  TextInput,
  Modal,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { useTableStore } from '../../../src/store/table.store';
import { useAlert } from '../../../src/hooks/useAlert';
import type { TableAreaRow } from '../../../src/types/database';

const PRESET_COLORS = [
  '#4ade80', '#3b82f6', '#f59e0b', '#8b5cf6',
  '#ef4444', '#06b6d4', '#ec4899', '#10b981',
];

export default function TableAreasScreen() {
  const router = useRouter();
  const { error: showError, confirm } = useAlert();

  const {
    areasWithStats,
    addArea,
    updateArea,
    deleteArea,
    recomputeAreaStats,
  } = useTableStore();

  const [showAddArea, setShowAddArea] = useState(false);
  const [editingArea, setEditingArea] = useState<TableAreaRow | null>(null);

  // Form state
  const [areaName, setAreaName] = useState('');
  const [areaDescription, setAreaDescription] = useState('');
  const [selectedColor, setSelectedColor] = useState(PRESET_COLORS[0]);

  // Recompute stats on mount
  useEffect(() => {
    recomputeAreaStats();
  }, [recomputeAreaStats]);

  const resetForm = useCallback(() => {
    setAreaName('');
    setAreaDescription('');
    setSelectedColor(PRESET_COLORS[0]);
    setEditingArea(null);
  }, []);

  const handleAddArea = useCallback(() => {
    if (!areaName.trim()) {
      showError('Error', 'Please enter an area name');
      return;
    }

    addArea({
      store_id: 'local', // Will be replaced on Supabase sync
      name: areaName.trim(),
      description: areaDescription.trim() || null,
      color: selectedColor,
      sort_order: areasWithStats.length,
      active: true,
    });

    resetForm();
    setShowAddArea(false);
  }, [areaName, areaDescription, selectedColor, areasWithStats.length, addArea, showError, resetForm]);

  const handleEditArea = useCallback((area: TableAreaRow) => {
    setEditingArea(area);
    setAreaName(area.name);
    setAreaDescription(area.description || '');
    setSelectedColor(area.color || PRESET_COLORS[0]);
    setShowAddArea(true);
  }, []);

  const handleSaveEdit = useCallback(() => {
    if (!editingArea) return;

    if (!areaName.trim()) {
      showError('Error', 'Please enter an area name');
      return;
    }

    updateArea(editingArea.id, {
      name: areaName.trim(),
      description: areaDescription.trim() || null,
      color: selectedColor,
    });

    resetForm();
    setShowAddArea(false);
  }, [editingArea, areaName, areaDescription, selectedColor, updateArea, showError, resetForm]);

  const handleDeleteArea = useCallback((area: TableAreaRow) => {
    const areaStats = areasWithStats.find((a) => a.id === area.id);
    const tableCount = areaStats?.table_count || 0;

    if (tableCount > 0) {
      confirm(
        'Delete Area',
        `This area has ${tableCount} table(s). Deleting it will unlink these tables. Continue?`,
        () => deleteArea(area.id)
      );
    } else {
      confirm(
        'Delete Area',
        `Are you sure you want to delete ${area.name}?`,
        () => deleteArea(area.id)
      );
    }
  }, [areasWithStats, confirm, deleteArea]);

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="chevron-back" size={28} color="#fff" />
        </Pressable>
        <Text style={styles.headerTitle}>Table Areas</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.scrollView}>
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Areas / Sections</Text>
            <Pressable
              style={styles.addButton}
              onPress={() => {
                resetForm();
                setShowAddArea(true);
              }}
            >
              <Text style={styles.addButtonText}>+ Add</Text>
            </Pressable>
          </View>

          {areasWithStats.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="grid-outline" size={48} color="#666" />
              <Text style={styles.emptyStateText}>No areas yet</Text>
              <Text style={styles.emptyStateSubtext}>
                Create areas to organize your tables by location
              </Text>
            </View>
          ) : (
            areasWithStats.map((area) => (
              <View key={area.id} style={styles.areaCard}>
                <View style={styles.areaHeader}>
                  <View style={styles.areaInfo}>
                    <View style={styles.areaNameRow}>
                      <View
                        style={[
                          styles.colorIndicator,
                          { backgroundColor: area.color || '#4ade80' },
                        ]}
                      />
                      <Text style={styles.areaName}>{area.name}</Text>
                    </View>
                    {area.description && (
                      <Text style={styles.areaDescription}>{area.description}</Text>
                    )}
                  </View>
                </View>

                <View style={styles.areaStats}>
                  <View style={styles.statItem}>
                    <Text style={styles.statValue}>{area.table_count}</Text>
                    <Text style={styles.statLabel}>Tables</Text>
                  </View>
                  <View style={styles.statDivider} />
                  <View style={styles.statItem}>
                    <Text style={[styles.statValue, { color: '#4ade80' }]}>
                      {area.available_count}
                    </Text>
                    <Text style={styles.statLabel}>Available</Text>
                  </View>
                  <View style={styles.statDivider} />
                  <View style={styles.statItem}>
                    <Text style={[styles.statValue, { color: '#f59e0b' }]}>
                      {area.occupied_count}
                    </Text>
                    <Text style={styles.statLabel}>Occupied</Text>
                  </View>
                </View>

                <View style={styles.areaActions}>
                  <Pressable
                    style={styles.editButton}
                    onPress={() => handleEditArea(area)}
                  >
                    <Ionicons name="pencil-outline" size={18} color="#4ade80" />
                    <Text style={styles.editButtonText}>Edit</Text>
                  </Pressable>
                  <Pressable
                    style={styles.deleteButton}
                    onPress={() => handleDeleteArea(area)}
                  >
                    <Ionicons name="trash-outline" size={18} color="#ef4444" />
                    <Text style={styles.deleteButtonText}>Delete</Text>
                  </Pressable>
                </View>
              </View>
            ))
          )}
        </View>
      </ScrollView>

      {/* Add/Edit Area Modal */}
      <Modal
        visible={showAddArea}
        animationType="slide"
        transparent
        onRequestClose={() => {
          setShowAddArea(false);
          resetForm();
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>
              {editingArea ? 'Edit Area' : 'Add Area'}
            </Text>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Area Name</Text>
              <TextInput
                style={styles.input}
                value={areaName}
                onChangeText={setAreaName}
                placeholder="e.g., Main Dining, Patio, Bar"
                placeholderTextColor="#666"
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Description (Optional)</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={areaDescription}
                onChangeText={setAreaDescription}
                placeholder="Brief description of this area"
                placeholderTextColor="#666"
                multiline
                numberOfLines={3}
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Color</Text>
              <View style={styles.colorGrid}>
                {PRESET_COLORS.map((color) => (
                  <Pressable
                    key={color}
                    style={[
                      styles.colorOption,
                      { backgroundColor: color },
                      selectedColor === color && styles.colorOptionSelected,
                    ]}
                    onPress={() => setSelectedColor(color)}
                  >
                    {selectedColor === color && (
                      <Ionicons name="checkmark" size={20} color="#000" />
                    )}
                  </Pressable>
                ))}
              </View>
            </View>

            <View style={styles.modalActions}>
              <Pressable
                style={styles.cancelButton}
                onPress={() => {
                  setShowAddArea(false);
                  resetForm();
                }}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={styles.saveButton}
                onPress={editingArea ? handleSaveEdit : handleAddArea}
              >
                <Text style={styles.saveButtonText}>
                  {editingArea ? 'Save' : 'Add'}
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1f1f2e',
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#fff',
    flex: 1,
    textAlign: 'center',
  },
  scrollView: {
    flex: 1,
  },
  section: {
    padding: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
  addButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#4ade80',
    borderRadius: 8,
  },
  addButtonText: {
    color: '#000',
    fontSize: 14,
    fontWeight: '600',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
  },
  emptyStateText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginTop: 12,
  },
  emptyStateSubtext: {
    color: '#888',
    fontSize: 14,
    marginTop: 4,
    textAlign: 'center',
    paddingHorizontal: 32,
  },
  areaCard: {
    backgroundColor: '#1f1f2e',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#2a2a3e',
  },
  areaHeader: {
    marginBottom: 16,
  },
  areaInfo: {
    gap: 6,
  },
  areaNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  colorIndicator: {
    width: 20,
    height: 20,
    borderRadius: 10,
  },
  areaName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
  },
  areaDescription: {
    fontSize: 14,
    color: '#888',
    marginLeft: 32,
  },
  areaStats: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0f0f1a',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
  },
  statLabel: {
    fontSize: 12,
    color: '#888',
    marginTop: 4,
  },
  statDivider: {
    width: 1,
    height: 40,
    backgroundColor: '#2a2a3e',
  },
  areaActions: {
    flexDirection: 'row',
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: '#2a2a3e',
    paddingTop: 12,
  },
  editButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    backgroundColor: '#4ade8020',
    borderRadius: 8,
  },
  editButtonText: {
    color: '#4ade80',
    fontSize: 14,
    fontWeight: '600',
  },
  deleteButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    backgroundColor: '#ef444420',
    borderRadius: 8,
  },
  deleteButtonText: {
    color: '#ef4444',
    fontSize: 14,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    padding: 24,
  },
  modalContent: {
    backgroundColor: '#1f1f2e',
    borderRadius: 16,
    padding: 24,
    maxHeight: '80%',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 24,
  },
  formGroup: {
    marginBottom: 20,
  },
  label: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#0f0f1a',
    borderWidth: 1,
    borderColor: '#2a2a3e',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    color: '#fff',
    fontSize: 16,
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  colorGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  colorOption: {
    width: 50,
    height: 50,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: 'transparent',
  },
  colorOptionSelected: {
    borderColor: '#fff',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 14,
    backgroundColor: '#2a2a3e',
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  saveButton: {
    flex: 1,
    paddingVertical: 14,
    backgroundColor: '#4ade80',
    borderRadius: 8,
    alignItems: 'center',
  },
  saveButtonText: {
    color: '#000',
    fontSize: 16,
    fontWeight: '700',
  },
});

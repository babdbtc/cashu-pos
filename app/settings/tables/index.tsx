/**
 * Table Management Settings Screen
 *
 * Manage tables, areas, and assignments.
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
import type { TableRow } from '../../../src/types/database';

const STATUS_COLORS: Record<TableRow['status'], string> = {
  available: '#4ade80',
  occupied: '#f59e0b',
  reserved: '#3b82f6',
  cleaning: '#8b5cf6',
  unavailable: '#ef4444',
};

const STATUS_LABELS: Record<TableRow['status'], string> = {
  available: 'Available',
  occupied: 'Occupied',
  reserved: 'Reserved',
  cleaning: 'Cleaning',
  unavailable: 'Unavailable',
};

export default function TablesSettingsScreen() {
  const router = useRouter();
  const { error: showError, confirm } = useAlert();

  const {
    tables,
    areas,
    areasWithStats,
    selectedAreaId,
    addTable,
    updateTable,
    deleteTable,
    selectArea,
    recomputeAreaStats,
  } = useTableStore();

  const [showAddTable, setShowAddTable] = useState(false);
  const [editingTable, setEditingTable] = useState<TableRow | null>(null);

  // Form state
  const [tableNumber, setTableNumber] = useState('');
  const [capacity, setCapacity] = useState('4');
  const [selectedAreaForNew, setSelectedAreaForNew] = useState<string | null>(null);

  // Recompute stats on mount
  useEffect(() => {
    recomputeAreaStats();
  }, [recomputeAreaStats]);

  const handleAddTable = useCallback(() => {
    if (!tableNumber.trim()) {
      showError('Error', 'Please enter a table number');
      return;
    }

    const capacityNum = parseInt(capacity, 10);
    if (isNaN(capacityNum) || capacityNum < 1) {
      showError('Error', 'Please enter a valid capacity');
      return;
    }

    // Check for duplicate table number
    const duplicate = tables.find(
      (t) => t.number.toLowerCase() === tableNumber.trim().toLowerCase() && t.active
    );
    if (duplicate) {
      showError('Error', `Table ${tableNumber} already exists`);
      return;
    }

    addTable({
      store_id: 'local', // Will be replaced on Supabase sync
      area_id: selectedAreaForNew,
      number: tableNumber.trim(),
      capacity: capacityNum,
      status: 'available',
      position: null,
      shape: 'square',
      metadata: {},
      active: true,
    });

    setTableNumber('');
    setCapacity('4');
    setSelectedAreaForNew(null);
    setShowAddTable(false);
  }, [tableNumber, capacity, selectedAreaForNew, tables, addTable, showError]);

  const handleEditTable = useCallback((table: TableRow) => {
    setEditingTable(table);
    setTableNumber(table.number);
    setCapacity(table.capacity.toString());
    setSelectedAreaForNew(table.area_id);
    setShowAddTable(true);
  }, []);

  const handleSaveEdit = useCallback(() => {
    if (!editingTable) return;

    if (!tableNumber.trim()) {
      showError('Error', 'Please enter a table number');
      return;
    }

    const capacityNum = parseInt(capacity, 10);
    if (isNaN(capacityNum) || capacityNum < 1) {
      showError('Error', 'Please enter a valid capacity');
      return;
    }

    updateTable(editingTable.id, {
      number: tableNumber.trim(),
      capacity: capacityNum,
      area_id: selectedAreaForNew,
    });

    setEditingTable(null);
    setTableNumber('');
    setCapacity('4');
    setSelectedAreaForNew(null);
    setShowAddTable(false);
  }, [editingTable, tableNumber, capacity, selectedAreaForNew, updateTable, showError]);

  const handleDeleteTable = useCallback((table: TableRow) => {
    confirm(
      'Delete Table',
      `Are you sure you want to delete table ${table.number}?`,
      () => deleteTable(table.id)
    );
  }, [confirm, deleteTable]);

  const filteredTables = selectedAreaId
    ? tables.filter((t) => t.area_id === selectedAreaId && t.active)
    : tables.filter((t) => t.active);

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="chevron-back" size={28} color="#fff" />
        </Pressable>
        <Text style={styles.headerTitle}>Tables</Text>
        <Pressable
          onPress={() => router.push('/settings/tables/areas')}
          style={styles.areasButton}
        >
          <Ionicons name="grid-outline" size={24} color="#4ade80" />
          <Text style={styles.areasButtonText}>Areas</Text>
        </Pressable>
      </View>

      <ScrollView style={styles.scrollView}>
        {/* Area Stats */}
        {areasWithStats.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>By Area</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <Pressable
                style={[
                  styles.areaChip,
                  !selectedAreaId && styles.areaChipActive,
                ]}
                onPress={() => selectArea(null)}
              >
                <Text style={[
                  styles.areaChipText,
                  !selectedAreaId && styles.areaChipTextActive,
                ]}>
                  All ({tables.filter((t) => t.active).length})
                </Text>
              </Pressable>
              {areasWithStats.map((area) => (
                <Pressable
                  key={area.id}
                  style={[
                    styles.areaChip,
                    selectedAreaId === area.id && styles.areaChipActive,
                  ]}
                  onPress={() => selectArea(area.id)}
                >
                  <Text style={[
                    styles.areaChipText,
                    selectedAreaId === area.id && styles.areaChipTextActive,
                  ]}>
                    {area.name} ({area.table_count})
                  </Text>
                  <View style={styles.areaStats}>
                    <Text style={styles.areaStatText}>
                      {area.available_count} free
                    </Text>
                  </View>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        )}

        {/* Tables List */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Tables</Text>
            <Pressable
              style={styles.addButton}
              onPress={() => {
                setEditingTable(null);
                setTableNumber('');
                setCapacity('4');
                setSelectedAreaForNew(selectedAreaId);
                setShowAddTable(true);
              }}
            >
              <Text style={styles.addButtonText}>+ Add</Text>
            </Pressable>
          </View>

          {filteredTables.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="restaurant-outline" size={48} color="#666" />
              <Text style={styles.emptyStateText}>No tables yet</Text>
              <Text style={styles.emptyStateSubtext}>
                Tap the + Add button to create your first table
              </Text>
            </View>
          ) : (
            <View style={styles.tableGrid}>
              {filteredTables
                .sort((a, b) => a.number.localeCompare(b.number, undefined, { numeric: true }))
                .map((table) => {
                  const area = areas.find((a) => a.id === table.area_id);
                  const statusColor = STATUS_COLORS[table.status];
                  const statusLabel = STATUS_LABELS[table.status];

                  return (
                    <View key={table.id} style={styles.tableCard}>
                      <View style={styles.tableCardHeader}>
                        <Text style={styles.tableNumber}>{table.number}</Text>
                        <View
                          style={[
                            styles.statusBadge,
                            { backgroundColor: statusColor + '20' },
                          ]}
                        >
                          <Text style={[styles.statusBadgeText, { color: statusColor }]}>
                            {statusLabel}
                          </Text>
                        </View>
                      </View>

                      <View style={styles.tableInfo}>
                        <View style={styles.tableInfoRow}>
                          <Ionicons name="people-outline" size={16} color="#888" />
                          <Text style={styles.tableInfoText}>
                            {table.capacity} seats
                          </Text>
                        </View>
                        {area && (
                          <View style={styles.tableInfoRow}>
                            <Ionicons name="location-outline" size={16} color="#888" />
                            <Text style={styles.tableInfoText}>{area.name}</Text>
                          </View>
                        )}
                      </View>

                      <View style={styles.tableActions}>
                        <Pressable
                          style={styles.editButton}
                          onPress={() => handleEditTable(table)}
                        >
                          <Ionicons name="pencil-outline" size={18} color="#4ade80" />
                        </Pressable>
                        <Pressable
                          style={styles.deleteButton}
                          onPress={() => handleDeleteTable(table)}
                        >
                          <Ionicons name="trash-outline" size={18} color="#ef4444" />
                        </Pressable>
                      </View>
                    </View>
                  );
                })}
            </View>
          )}
        </View>
      </ScrollView>

      {/* Add/Edit Table Modal */}
      <Modal
        visible={showAddTable}
        animationType="slide"
        transparent
        onRequestClose={() => setShowAddTable(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>
              {editingTable ? 'Edit Table' : 'Add Table'}
            </Text>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Table Number</Text>
              <TextInput
                style={styles.input}
                value={tableNumber}
                onChangeText={setTableNumber}
                placeholder="e.g., A1, Table 5"
                placeholderTextColor="#666"
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Capacity</Text>
              <TextInput
                style={styles.input}
                value={capacity}
                onChangeText={setCapacity}
                placeholder="4"
                placeholderTextColor="#666"
                keyboardType="numeric"
              />
            </View>

            {areas.length > 0 && (
              <View style={styles.formGroup}>
                <Text style={styles.label}>Area (Optional)</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <Pressable
                    style={[
                      styles.areaOption,
                      !selectedAreaForNew && styles.areaOptionSelected,
                    ]}
                    onPress={() => setSelectedAreaForNew(null)}
                  >
                    <Text
                      style={[
                        styles.areaOptionText,
                        !selectedAreaForNew && styles.areaOptionTextSelected,
                      ]}
                    >
                      No Area
                    </Text>
                  </Pressable>
                  {areas.filter((a) => a.active).map((area) => (
                    <Pressable
                      key={area.id}
                      style={[
                        styles.areaOption,
                        selectedAreaForNew === area.id && styles.areaOptionSelected,
                      ]}
                      onPress={() => setSelectedAreaForNew(area.id)}
                    >
                      <Text
                        style={[
                          styles.areaOptionText,
                          selectedAreaForNew === area.id && styles.areaOptionTextSelected,
                        ]}
                      >
                        {area.name}
                      </Text>
                    </Pressable>
                  ))}
                </ScrollView>
              </View>
            )}

            <View style={styles.modalActions}>
              <Pressable
                style={styles.cancelButton}
                onPress={() => {
                  setShowAddTable(false);
                  setEditingTable(null);
                  setTableNumber('');
                  setCapacity('4');
                  setSelectedAreaForNew(null);
                }}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={styles.saveButton}
                onPress={editingTable ? handleSaveEdit : handleAddTable}
              >
                <Text style={styles.saveButtonText}>
                  {editingTable ? 'Save' : 'Add'}
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
    marginHorizontal: 16,
  },
  areasButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  areasButtonText: {
    color: '#4ade80',
    fontSize: 14,
    fontWeight: '600',
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
    marginBottom: 12,
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
  areaChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#1f1f2e',
    borderRadius: 20,
    marginRight: 8,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  areaChipActive: {
    backgroundColor: '#4ade80',
    borderColor: '#4ade80',
  },
  areaChipText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },
  areaChipTextActive: {
    color: '#000',
    fontWeight: '600',
  },
  areaStats: {
    marginTop: 4,
  },
  areaStatText: {
    color: '#888',
    fontSize: 12,
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
  },
  tableGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  tableCard: {
    width: '48%',
    backgroundColor: '#1f1f2e',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#2a2a3e',
  },
  tableCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  tableNumber: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  tableInfo: {
    marginBottom: 12,
  },
  tableInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  tableInfoText: {
    color: '#888',
    fontSize: 13,
  },
  tableActions: {
    flexDirection: 'row',
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: '#2a2a3e',
    paddingTop: 12,
  },
  editButton: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
    backgroundColor: '#4ade8020',
    borderRadius: 6,
  },
  deleteButton: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
    backgroundColor: '#ef444420',
    borderRadius: 6,
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
  areaOption: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#0f0f1a',
    borderRadius: 8,
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#2a2a3e',
  },
  areaOptionSelected: {
    backgroundColor: '#4ade80',
    borderColor: '#4ade80',
  },
  areaOptionText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },
  areaOptionTextSelected: {
    color: '#000',
    fontWeight: '600',
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

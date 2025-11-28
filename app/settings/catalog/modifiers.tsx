/**
 * Modifiers Management Screen
 *
 * Manage modifier groups (like milk type, size) and their options.
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
  Switch,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useCatalogStore } from '@/store/catalog.store';
import { useConfigStore } from '@/store/config.store';
import type { ModifierGroup, Modifier } from '@/types/catalog';

interface ModifierGroupFormData {
  name: string;
  selection_type: 'single' | 'multiple';
  min_selections: string;
  max_selections: string;
  required: boolean;
}

interface ModifierFormData {
  name: string;
  price_adjustment: string;
}

export default function ModifiersScreen() {
  const router = useRouter();
  const modifierGroups = useCatalogStore((state) => state.modifierGroups);
  const setModifierGroups = useCatalogStore((state) => state.setModifierGroups);
  const currency = useConfigStore((state) => state.currency);

  const [groupModalVisible, setGroupModalVisible] = useState(false);
  const [modifierModalVisible, setModifierModalVisible] = useState(false);
  const [editingGroup, setEditingGroup] = useState<ModifierGroup | null>(null);
  const [editingModifier, setEditingModifier] = useState<{ groupId: string; modifier: Modifier | null } | null>(null);
  const [expandedGroupId, setExpandedGroupId] = useState<string | null>(null);

  const [groupFormData, setGroupFormData] = useState<ModifierGroupFormData>({
    name: '',
    selection_type: 'single',
    min_selections: '0',
    max_selections: '1',
    required: false,
  });

  const [modifierFormData, setModifierFormData] = useState<ModifierFormData>({
    name: '',
    price_adjustment: '0',
  });

  const formatPrice = (cents: number) => {
    if (cents === 0) return 'Free';
    const prefix = cents > 0 ? '+' : '';
    return prefix + new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency.displayCurrency,
    }).format(cents / 100);
  };

  const generateId = () => `local_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  // Group CRUD
  const openNewGroup = () => {
    setEditingGroup(null);
    setGroupFormData({
      name: '',
      selection_type: 'single',
      min_selections: '0',
      max_selections: '1',
      required: false,
    });
    setGroupModalVisible(true);
  };

  const openEditGroup = (group: ModifierGroup) => {
    setEditingGroup(group);
    setGroupFormData({
      name: group.name,
      selection_type: group.selection_type,
      min_selections: group.min_selections.toString(),
      max_selections: group.max_selections?.toString() || '',
      required: group.required,
    });
    setGroupModalVisible(true);
  };

  const handleSaveGroup = () => {
    if (!groupFormData.name.trim()) {
      Alert.alert('Error', 'Group name is required');
      return;
    }

    const minSel = parseInt(groupFormData.min_selections) || 0;
    const maxSel = groupFormData.max_selections ? parseInt(groupFormData.max_selections) : null;

    if (editingGroup) {
      // Update existing group
      const updatedGroups = modifierGroups.map((g) =>
        g.id === editingGroup.id
          ? {
              ...g,
              name: groupFormData.name.trim(),
              selection_type: groupFormData.selection_type,
              min_selections: minSel,
              max_selections: maxSel,
              required: groupFormData.required,
            }
          : g
      );
      setModifierGroups(updatedGroups);
    } else {
      // Create new group
      const newGroup: ModifierGroup = {
        id: generateId(),
        store_id: 'local',
        name: groupFormData.name.trim(),
        selection_type: groupFormData.selection_type,
        min_selections: minSel,
        max_selections: maxSel,
        required: groupFormData.required,
        active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        modifiers: [],
      };
      setModifierGroups([...modifierGroups, newGroup]);
    }
    setGroupModalVisible(false);
  };

  const handleDeleteGroup = (group: ModifierGroup) => {
    Alert.alert('Delete Modifier Group', `Are you sure you want to delete "${group.name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          setModifierGroups(modifierGroups.filter((g) => g.id !== group.id));
        },
      },
    ]);
  };

  // Modifier CRUD
  const openNewModifier = (groupId: string) => {
    setEditingModifier({ groupId, modifier: null });
    setModifierFormData({
      name: '',
      price_adjustment: '0',
    });
    setModifierModalVisible(true);
  };

  const openEditModifier = (groupId: string, modifier: Modifier) => {
    setEditingModifier({ groupId, modifier });
    setModifierFormData({
      name: modifier.name,
      price_adjustment: (modifier.price_adjustment / 100).toFixed(2),
    });
    setModifierModalVisible(true);
  };

  const handleSaveModifier = () => {
    if (!editingModifier || !modifierFormData.name.trim()) {
      Alert.alert('Error', 'Modifier name is required');
      return;
    }

    const priceAdjustment = Math.round(parseFloat(modifierFormData.price_adjustment || '0') * 100);

    const updatedGroups = modifierGroups.map((group) => {
      if (group.id !== editingModifier.groupId) return group;

      if (editingModifier.modifier) {
        // Update existing modifier
        return {
          ...group,
          modifiers: group.modifiers.map((m) =>
            m.id === editingModifier.modifier!.id
              ? {
                  ...m,
                  name: modifierFormData.name.trim(),
                  price_adjustment: priceAdjustment,
                }
              : m
          ),
        };
      } else {
        // Create new modifier
        const newModifier: Modifier = {
          id: generateId(),
          modifier_group_id: group.id,
          name: modifierFormData.name.trim(),
          price_adjustment: priceAdjustment,
          sort_order: group.modifiers.length,
          active: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        return {
          ...group,
          modifiers: [...group.modifiers, newModifier],
        };
      }
    });

    setModifierGroups(updatedGroups);
    setModifierModalVisible(false);
  };

  const handleDeleteModifier = (groupId: string, modifier: Modifier) => {
    const updatedGroups = modifierGroups.map((group) => {
      if (group.id !== groupId) return group;
      return {
        ...group,
        modifiers: group.modifiers.filter((m) => m.id !== modifier.id),
      };
    });
    setModifierGroups(updatedGroups);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      {/* Back Button */}
      <Pressable onPress={() => router.back()} style={styles.backButton}>
        <Ionicons name="chevron-back" size={28} color="#fff" />
      </Pressable>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {modifierGroups.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>✨</Text>
            <Text style={styles.emptyTitle}>No Modifier Groups Yet</Text>
            <Text style={styles.emptyText}>
              Create modifier groups for product customizations like size, milk type, or toppings.
            </Text>
          </View>
        ) : (
          <View style={styles.list}>
            {modifierGroups.map((group) => (
              <View key={group.id} style={styles.groupCard}>
                {/* Group Header */}
                <Pressable
                  style={styles.groupHeader}
                  onPress={() => setExpandedGroupId(expandedGroupId === group.id ? null : group.id)}
                >
                  <View style={styles.groupInfo}>
                    <Text style={styles.groupName}>{group.name}</Text>
                    <View style={styles.groupMeta}>
                      <View style={styles.typeBadge}>
                        <Text style={styles.typeBadgeText}>
                          {group.selection_type === 'single' ? 'Single' : 'Multiple'}
                        </Text>
                      </View>
                      {group.required && (
                        <View style={[styles.typeBadge, styles.requiredBadge]}>
                          <Text style={styles.typeBadgeText}>Required</Text>
                        </View>
                      )}
                      <Text style={styles.groupCount}>
                        {group.modifiers.length} option{group.modifiers.length !== 1 ? 's' : ''}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.groupActions}>
                    <Pressable
                      style={styles.editButton}
                      onPress={() => openEditGroup(group)}
                    >
                      <Text style={styles.editButtonText}>Edit</Text>
                    </Pressable>
                    <Text style={styles.expandIcon}>
                      {expandedGroupId === group.id ? '▼' : '▶'}
                    </Text>
                  </View>
                </Pressable>

                {/* Expanded Modifiers */}
                {expandedGroupId === group.id && (
                  <View style={styles.modifiersList}>
                    {group.modifiers.map((modifier) => (
                      <View key={modifier.id} style={styles.modifierItem}>
                        <Text style={styles.modifierName}>{modifier.name}</Text>
                        <View style={styles.modifierRight}>
                          <Text style={styles.modifierPrice}>
                            {formatPrice(modifier.price_adjustment)}
                          </Text>
                          <Pressable
                            style={styles.modifierEditButton}
                            onPress={() => openEditModifier(group.id, modifier)}
                          >
                            <Text style={styles.modifierEditText}>Edit</Text>
                          </Pressable>
                          <Pressable
                            style={styles.modifierDeleteButton}
                            onPress={() => handleDeleteModifier(group.id, modifier)}
                          >
                            <Text style={styles.modifierDeleteText}>×</Text>
                          </Pressable>
                        </View>
                      </View>
                    ))}
                    <Pressable
                      style={styles.addModifierButton}
                      onPress={() => openNewModifier(group.id)}
                    >
                      <Text style={styles.addModifierText}>+ Add Option</Text>
                    </Pressable>
                  </View>
                )}
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      {/* Add Group Button */}
      <Pressable style={styles.addButton} onPress={openNewGroup}>
        <Text style={styles.addButtonText}>+ Add Modifier Group</Text>
      </Pressable>

      {/* Group Editor Modal */}
      <Modal visible={groupModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {editingGroup ? 'Edit Group' : 'New Modifier Group'}
              </Text>
              <Pressable onPress={() => setGroupModalVisible(false)}>
                <Text style={styles.modalClose}>×</Text>
              </Pressable>
            </View>

            <ScrollView style={styles.modalBody}>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Group Name *</Text>
                <TextInput
                  style={styles.textInput}
                  value={groupFormData.name}
                  onChangeText={(text) => setGroupFormData({ ...groupFormData, name: text })}
                  placeholder="e.g., Milk Options, Size"
                  placeholderTextColor="#666"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Selection Type</Text>
                <View style={styles.selectionTypeRow}>
                  <Pressable
                    style={[
                      styles.selectionTypeOption,
                      groupFormData.selection_type === 'single' && styles.selectionTypeActive,
                    ]}
                    onPress={() => setGroupFormData({ ...groupFormData, selection_type: 'single' })}
                  >
                    <Text style={styles.selectionTypeText}>Single</Text>
                    <Text style={styles.selectionTypeHint}>Choose one</Text>
                  </Pressable>
                  <Pressable
                    style={[
                      styles.selectionTypeOption,
                      groupFormData.selection_type === 'multiple' && styles.selectionTypeActive,
                    ]}
                    onPress={() => setGroupFormData({ ...groupFormData, selection_type: 'multiple' })}
                  >
                    <Text style={styles.selectionTypeText}>Multiple</Text>
                    <Text style={styles.selectionTypeHint}>Choose many</Text>
                  </Pressable>
                </View>
              </View>

              <View style={styles.inputGroup}>
                <View style={styles.switchRow}>
                  <View>
                    <Text style={styles.inputLabel}>Required</Text>
                    <Text style={styles.inputHint}>Customer must select an option</Text>
                  </View>
                  <Switch
                    value={groupFormData.required}
                    onValueChange={(value) => setGroupFormData({ ...groupFormData, required: value })}
                    trackColor={{ false: '#2a2a3e', true: '#00d4ff' }}
                    thumbColor="#ffffff"
                  />
                </View>
              </View>

              {groupFormData.selection_type === 'multiple' && (
                <View style={styles.rowInputs}>
                  <View style={[styles.inputGroup, { flex: 1 }]}>
                    <Text style={styles.inputLabel}>Min Selections</Text>
                    <TextInput
                      style={styles.textInput}
                      value={groupFormData.min_selections}
                      onChangeText={(text) => setGroupFormData({ ...groupFormData, min_selections: text })}
                      placeholder="0"
                      placeholderTextColor="#666"
                      keyboardType="number-pad"
                    />
                  </View>
                  <View style={[styles.inputGroup, { flex: 1 }]}>
                    <Text style={styles.inputLabel}>Max Selections</Text>
                    <TextInput
                      style={styles.textInput}
                      value={groupFormData.max_selections}
                      onChangeText={(text) => setGroupFormData({ ...groupFormData, max_selections: text })}
                      placeholder="No limit"
                      placeholderTextColor="#666"
                      keyboardType="number-pad"
                    />
                  </View>
                </View>
              )}
            </ScrollView>

            <View style={styles.modalFooter}>
              {editingGroup && (
                <Pressable
                  style={styles.deleteGroupButton}
                  onPress={() => {
                    setGroupModalVisible(false);
                    handleDeleteGroup(editingGroup);
                  }}
                >
                  <Text style={styles.deleteGroupText}>Delete</Text>
                </Pressable>
              )}
              <Pressable
                style={styles.cancelButton}
                onPress={() => setGroupModalVisible(false)}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </Pressable>
              <Pressable style={styles.saveButton} onPress={handleSaveGroup}>
                <Text style={styles.saveButtonText}>Save</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modifier Editor Modal */}
      <Modal visible={modifierModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {editingModifier?.modifier ? 'Edit Option' : 'New Option'}
              </Text>
              <Pressable onPress={() => setModifierModalVisible(false)}>
                <Text style={styles.modalClose}>×</Text>
              </Pressable>
            </View>

            <View style={styles.modalBody}>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Option Name *</Text>
                <TextInput
                  style={styles.textInput}
                  value={modifierFormData.name}
                  onChangeText={(text) => setModifierFormData({ ...modifierFormData, name: text })}
                  placeholder="e.g., Oat Milk, Large"
                  placeholderTextColor="#666"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Price Adjustment ({currency.displayCurrency})</Text>
                <TextInput
                  style={styles.textInput}
                  value={modifierFormData.price_adjustment}
                  onChangeText={(text) => setModifierFormData({ ...modifierFormData, price_adjustment: text })}
                  placeholder="0.00"
                  placeholderTextColor="#666"
                  keyboardType="decimal-pad"
                />
                <Text style={styles.inputHint}>
                  Enter 0 for no extra charge, or a positive number for upcharge
                </Text>
              </View>
            </View>

            <View style={styles.modalFooter}>
              <Pressable
                style={styles.cancelButton}
                onPress={() => setModifierModalVisible(false)}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </Pressable>
              <Pressable style={styles.saveButton} onPress={handleSaveModifier}>
                <Text style={styles.saveButtonText}>Save</Text>
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
    paddingHorizontal: 40,
  },
  list: {
    gap: 12,
  },
  groupCard: {
    backgroundColor: '#1a1a2e',
    borderRadius: 12,
    overflow: 'hidden',
  },
  groupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  groupInfo: {
    flex: 1,
  },
  groupName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 4,
  },
  groupMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  typeBadge: {
    backgroundColor: '#2a2a3e',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  requiredBadge: {
    backgroundColor: '#f97316',
  },
  typeBadgeText: {
    fontSize: 11,
    color: '#ffffff',
    fontWeight: '500',
  },
  groupCount: {
    fontSize: 12,
    color: '#666',
  },
  groupActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  editButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#2a2a3e',
    borderRadius: 6,
  },
  editButtonText: {
    fontSize: 13,
    color: '#ffffff',
  },
  expandIcon: {
    fontSize: 12,
    color: '#666',
  },
  modifiersList: {
    borderTopWidth: 1,
    borderTopColor: '#2a2a3e',
    padding: 12,
    gap: 8,
  },
  modifierItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0f0f1a',
    padding: 12,
    borderRadius: 8,
  },
  modifierName: {
    flex: 1,
    fontSize: 14,
    color: '#ffffff',
  },
  modifierRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  modifierPrice: {
    fontSize: 14,
    color: '#00d4ff',
    fontWeight: '500',
  },
  modifierEditButton: {
    padding: 4,
  },
  modifierEditText: {
    fontSize: 12,
    color: '#888',
  },
  modifierDeleteButton: {
    padding: 4,
  },
  modifierDeleteText: {
    fontSize: 18,
    color: '#666',
  },
  addModifierButton: {
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#2a2a3e',
    borderStyle: 'dashed',
    alignItems: 'center',
  },
  addModifierText: {
    fontSize: 14,
    color: '#888',
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
    maxHeight: '80%',
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
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#888',
    marginBottom: 8,
  },
  inputHint: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
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
  rowInputs: {
    flexDirection: 'row',
    gap: 12,
  },
  selectionTypeRow: {
    flexDirection: 'row',
    gap: 12,
  },
  selectionTypeOption: {
    flex: 1,
    backgroundColor: '#0f0f1a',
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#2a2a3e',
    alignItems: 'center',
  },
  selectionTypeActive: {
    borderColor: '#00d4ff',
    backgroundColor: 'rgba(0, 212, 255, 0.1)',
  },
  selectionTypeText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 2,
  },
  selectionTypeHint: {
    fontSize: 12,
    color: '#888',
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  deleteGroupButton: {
    padding: 16,
    borderRadius: 12,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderWidth: 1,
    borderColor: '#ef4444',
  },
  deleteGroupText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ef4444',
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
    flex: 1,
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

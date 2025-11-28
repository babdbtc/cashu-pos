/**
 * Table Floor Plan View
 *
 * Visual overview of all tables with real-time status for restaurant service.
 * Accessible to waiters and managers during service.
 */

import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  Modal,
  RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { useTableStore, type TableWithAssignment } from '../../src/store/table.store';
import { useStaffStore } from '../../src/store/staff.store';
import type { TableRow, StaffRow } from '../../src/types/database';

const STATUS_COLORS: Record<TableRow['status'], string> = {
  available: '#4ade80',
  occupied: '#f59e0b',
  reserved: '#3b82f6',
  cleaning: '#8b5cf6',
  unavailable: '#ef4444',
};

const STATUS_ICONS: Record<TableRow['status'], any> = {
  available: 'checkmark-circle',
  occupied: 'restaurant',
  reserved: 'time',
  cleaning: 'brush',
  unavailable: 'close-circle',
};

export default function TablesFloorPlanScreen() {
  const router = useRouter();

  const {
    filteredTables,
    areasWithStats,
    selectedAreaId,
    viewMode,
    statusFilter,
    selectArea,
    setViewMode,
    setStatusFilter,
    updateTableStatus,
    assignWaiter,
    unassignWaiter,
    recomputeFiltered,
    recomputeAreaStats,
  } = useTableStore();

  const {
    getActiveWaiters,
    getCurrentStaff,
  } = useStaffStore();

  const [selectedTable, setSelectedTable] = useState<TableWithAssignment | null>(null);
  const [showWaiterSelect, setShowWaiterSelect] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const activeWaiters = getActiveWaiters();
  const currentStaff = getCurrentStaff();

  // Recompute on mount and when data changes
  useEffect(() => {
    recomputeFiltered();
    recomputeAreaStats();
  }, [recomputeFiltered, recomputeAreaStats]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    // TODO: Fetch latest data from Supabase
    recomputeFiltered();
    recomputeAreaStats();
    setTimeout(() => setRefreshing(false), 1000);
  }, [recomputeFiltered, recomputeAreaStats]);

  const handleTablePress = useCallback((table: TableWithAssignment) => {
    setSelectedTable(table);
  }, []);

  const handleStatusChange = useCallback((tableId: string, status: TableRow['status']) => {
    updateTableStatus(tableId, status);
    setSelectedTable(null);
  }, [updateTableStatus]);

  const handleAssignWaiter = useCallback((staffId: string) => {
    if (selectedTable) {
      assignWaiter(
        selectedTable.id,
        staffId,
        currentStaff?.id,
        `Assigned via floor plan`
      );
      setShowWaiterSelect(false);
      // Refresh selected table data
      recomputeFiltered();
      const updatedTable = filteredTables.find((t) => t.id === selectedTable.id);
      if (updatedTable) {
        setSelectedTable(updatedTable);
      }
    }
  }, [selectedTable, assignWaiter, currentStaff, recomputeFiltered, filteredTables]);

  const handleUnassignWaiter = useCallback(() => {
    if (selectedTable) {
      unassignWaiter(selectedTable.id);
      recomputeFiltered();
      const updatedTable = filteredTables.find((t) => t.id === selectedTable.id);
      if (updatedTable) {
        setSelectedTable(updatedTable);
      }
    }
  }, [selectedTable, unassignWaiter, recomputeFiltered, filteredTables]);

  const statusCounts = filteredTables.reduce((acc, table) => {
    acc[table.status] = (acc[table.status] || 0) + 1;
    return acc;
  }, {} as Record<TableRow['status'], number>);

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="chevron-back" size={28} color="#fff" />
        </Pressable>
        <Text style={styles.headerTitle}>Floor Plan</Text>
        <Pressable
          onPress={() => router.push('/settings/tables')}
          style={styles.settingsButton}
        >
          <Ionicons name="settings-outline" size={24} color="#888" />
        </Pressable>
      </View>

      {/* Status Filter Bar */}
      <View style={styles.filterBar}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <Pressable
            style={[
              styles.filterChip,
              statusFilter === 'all' && styles.filterChipActive,
            ]}
            onPress={() => setStatusFilter('all')}
          >
            <Text
              style={[
                styles.filterChipText,
                statusFilter === 'all' && styles.filterChipTextActive,
              ]}
            >
              All ({filteredTables.length})
            </Text>
          </Pressable>

          {(['available', 'occupied', 'reserved', 'cleaning'] as const).map((status) => {
            const count = statusCounts[status] || 0;
            return (
              <Pressable
                key={status}
                style={[
                  styles.filterChip,
                  statusFilter === status && styles.filterChipActive,
                  { borderColor: STATUS_COLORS[status] },
                ]}
                onPress={() => setStatusFilter(status)}
              >
                <Ionicons
                  name={STATUS_ICONS[status]}
                  size={16}
                  color={statusFilter === status ? '#000' : STATUS_COLORS[status]}
                />
                <Text
                  style={[
                    styles.filterChipText,
                    statusFilter === status && styles.filterChipTextActive,
                    { color: STATUS_COLORS[status] },
                  ]}
                >
                  {count}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {/* View Mode Toggle */}
        <View style={styles.viewModeToggle}>
          <Pressable
            style={[
              styles.viewModeButton,
              viewMode === 'grid' && styles.viewModeButtonActive,
            ]}
            onPress={() => setViewMode('grid')}
          >
            <Ionicons
              name="grid"
              size={18}
              color={viewMode === 'grid' ? '#000' : '#888'}
            />
          </Pressable>
          <Pressable
            style={[
              styles.viewModeButton,
              viewMode === 'list' && styles.viewModeButtonActive,
            ]}
            onPress={() => setViewMode('list')}
          >
            <Ionicons
              name="list"
              size={18}
              color={viewMode === 'list' ? '#000' : '#888'}
            />
          </Pressable>
        </View>
      </View>

      {/* Area Filter */}
      {areasWithStats.length > 0 && (
        <View style={styles.areaFilter}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <Pressable
              style={[
                styles.areaChip,
                !selectedAreaId && styles.areaChipActive,
              ]}
              onPress={() => selectArea(null)}
            >
              <Text
                style={[
                  styles.areaChipText,
                  !selectedAreaId && styles.areaChipTextActive,
                ]}
              >
                All Areas
              </Text>
            </Pressable>
            {areasWithStats.map((area) => (
              <Pressable
                key={area.id}
                style={[
                  styles.areaChip,
                  selectedAreaId === area.id && styles.areaChipActive,
                  { borderColor: area.color || '#4ade80' },
                ]}
                onPress={() => selectArea(area.id)}
              >
                <View
                  style={[
                    styles.areaColorDot,
                    { backgroundColor: area.color || '#4ade80' },
                  ]}
                />
                <Text
                  style={[
                    styles.areaChipText,
                    selectedAreaId === area.id && styles.areaChipTextActive,
                  ]}
                >
                  {area.name}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      )}

      {/* Tables Grid/List */}
      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
      >
        {filteredTables.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="restaurant-outline" size={64} color="#666" />
            <Text style={styles.emptyStateText}>No tables found</Text>
            <Pressable
              style={styles.emptyStateButton}
              onPress={() => router.push('/settings/tables')}
            >
              <Text style={styles.emptyStateButtonText}>Manage Tables</Text>
            </Pressable>
          </View>
        ) : viewMode === 'grid' ? (
          <View style={styles.tableGrid}>
            {filteredTables.map((table) => {
              const statusColor = STATUS_COLORS[table.status];
              return (
                <Pressable
                  key={table.id}
                  style={[
                    styles.tableCard,
                    { borderColor: statusColor },
                  ]}
                  onPress={() => handleTablePress(table)}
                >
                  <View
                    style={[
                      styles.tableStatusIndicator,
                      { backgroundColor: statusColor },
                    ]}
                  />
                  <Text style={styles.tableCardNumber}>{table.number}</Text>
                  <View style={styles.tableCardInfo}>
                    <Ionicons name="people-outline" size={14} color="#888" />
                    <Text style={styles.tableCardCapacity}>{table.capacity}</Text>
                  </View>
                  {table.assignment && (
                    <Text style={styles.tableCardWaiter} numberOfLines={1}>
                      {table.assignment.staff_name || 'Assigned'}
                    </Text>
                  )}
                </Pressable>
              );
            })}
          </View>
        ) : (
          <View style={styles.tableList}>
            {filteredTables.map((table) => {
              const statusColor = STATUS_COLORS[table.status];
              return (
                <Pressable
                  key={table.id}
                  style={styles.tableListItem}
                  onPress={() => handleTablePress(table)}
                >
                  <View
                    style={[
                      styles.tableListIndicator,
                      { backgroundColor: statusColor },
                    ]}
                  />
                  <View style={styles.tableListContent}>
                    <View style={styles.tableListHeader}>
                      <Text style={styles.tableListNumber}>{table.number}</Text>
                      {table.area_name && (
                        <Text style={styles.tableListArea}>{table.area_name}</Text>
                      )}
                    </View>
                    <View style={styles.tableListDetails}>
                      <View style={styles.tableListDetailItem}>
                        <Ionicons name="people-outline" size={14} color="#888" />
                        <Text style={styles.tableListDetailText}>
                          {table.capacity} seats
                        </Text>
                      </View>
                      {table.assignment && (
                        <View style={styles.tableListDetailItem}>
                          <Ionicons name="person-outline" size={14} color="#888" />
                          <Text style={styles.tableListDetailText}>
                            {table.assignment.staff_name || 'Assigned'}
                          </Text>
                        </View>
                      )}
                    </View>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color="#888" />
                </Pressable>
              );
            })}
          </View>
        )}
      </ScrollView>

      {/* Table Detail Modal */}
      <Modal
        visible={selectedTable !== null}
        animationType="slide"
        transparent
        onRequestClose={() => setSelectedTable(null)}
      >
        {selectedTable && (
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Table {selectedTable.number}</Text>
                <Pressable
                  onPress={() => setSelectedTable(null)}
                  style={styles.modalClose}
                >
                  <Ionicons name="close" size={28} color="#fff" />
                </Pressable>
              </View>

              <View style={styles.modalInfo}>
                <View style={styles.modalInfoRow}>
                  <Text style={styles.modalInfoLabel}>Capacity</Text>
                  <Text style={styles.modalInfoValue}>
                    {selectedTable.capacity} seats
                  </Text>
                </View>
                {selectedTable.area_name && (
                  <View style={styles.modalInfoRow}>
                    <Text style={styles.modalInfoLabel}>Area</Text>
                    <Text style={styles.modalInfoValue}>
                      {selectedTable.area_name}
                    </Text>
                  </View>
                )}
                {selectedTable.assignment && (
                  <View style={styles.modalInfoRow}>
                    <Text style={styles.modalInfoLabel}>Server</Text>
                    <Text style={styles.modalInfoValue}>
                      {selectedTable.assignment.staff_name || 'Assigned'}
                    </Text>
                  </View>
                )}
              </View>

              {/* Waiter Assignment */}
              <View style={styles.modalSection}>
                <Text style={styles.modalSectionTitle}>Server Assignment</Text>
                {selectedTable.assignment ? (
                  <View style={styles.assignedWaiterCard}>
                    <View style={styles.assignedWaiterInfo}>
                      <Ionicons name="person-circle" size={32} color="#4ade80" />
                      <View style={styles.assignedWaiterText}>
                        <Text style={styles.assignedWaiterName}>
                          {selectedTable.assignment.staff_name || 'Server'}
                        </Text>
                        <Text style={styles.assignedWaiterRole}>Assigned Server</Text>
                      </View>
                    </View>
                    <Pressable
                      style={styles.unassignButton}
                      onPress={handleUnassignWaiter}
                    >
                      <Text style={styles.unassignButtonText}>Unassign</Text>
                    </Pressable>
                  </View>
                ) : (
                  <Pressable
                    style={styles.assignWaiterButton}
                    onPress={() => setShowWaiterSelect(true)}
                  >
                    <Ionicons name="person-add" size={20} color="#4ade80" />
                    <Text style={styles.assignWaiterButtonText}>Assign Server</Text>
                  </Pressable>
                )}
              </View>

              <View style={styles.modalSection}>
                <Text style={styles.modalSectionTitle}>Change Status</Text>
                <View style={styles.statusGrid}>
                  {(['available', 'occupied', 'reserved', 'cleaning', 'unavailable'] as const).map(
                    (status) => (
                      <Pressable
                        key={status}
                        style={[
                          styles.statusOption,
                          selectedTable.status === status && styles.statusOptionActive,
                          { borderColor: STATUS_COLORS[status] },
                        ]}
                        onPress={() => handleStatusChange(selectedTable.id, status)}
                      >
                        <Ionicons
                          name={STATUS_ICONS[status]}
                          size={24}
                          color={STATUS_COLORS[status]}
                        />
                        <Text
                          style={[
                            styles.statusOptionText,
                            { color: STATUS_COLORS[status] },
                          ]}
                        >
                          {status.charAt(0).toUpperCase() + status.slice(1)}
                        </Text>
                      </Pressable>
                    )
                  )}
                </View>
              </View>

              {selectedTable.status === 'available' && (
                <Pressable
                  style={styles.primaryButton}
                  onPress={() => {
                    // TODO: Navigate to POS with table pre-selected
                    router.push('/pos');
                    setSelectedTable(null);
                  }}
                >
                  <Text style={styles.primaryButtonText}>Take Order</Text>
                </Pressable>
              )}
            </View>
          </View>
        )}
      </Modal>

      {/* Waiter Selection Modal */}
      <Modal
        visible={showWaiterSelect}
        animationType="slide"
        transparent
        onRequestClose={() => setShowWaiterSelect(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Assign Server</Text>
              <Pressable
                onPress={() => setShowWaiterSelect(false)}
                style={styles.modalClose}
              >
                <Ionicons name="close" size={28} color="#fff" />
              </Pressable>
            </View>

            {activeWaiters.length === 0 ? (
              <View style={styles.noWaitersState}>
                <Ionicons name="people-outline" size={48} color="#666" />
                <Text style={styles.noWaitersText}>No active waiters</Text>
                <Text style={styles.noWaitersSubtext}>
                  Add waiters in Staff Management settings
                </Text>
                <Pressable
                  style={styles.manageStaffButton}
                  onPress={() => {
                    setShowWaiterSelect(false);
                    router.push('/settings/staff');
                  }}
                >
                  <Text style={styles.manageStaffButtonText}>Manage Staff</Text>
                </Pressable>
              </View>
            ) : (
              <ScrollView style={styles.waiterList}>
                {activeWaiters.map((waiter) => (
                  <Pressable
                    key={waiter.id}
                    style={styles.waiterOption}
                    onPress={() => handleAssignWaiter(waiter.id)}
                  >
                    <View style={styles.waiterOptionContent}>
                      <Ionicons name="person-circle-outline" size={40} color="#4ade80" />
                      <View style={styles.waiterOptionInfo}>
                        <Text style={styles.waiterOptionName}>{waiter.name}</Text>
                        <Text style={styles.waiterOptionRole}>Waiter</Text>
                      </View>
                    </View>
                    <Ionicons name="chevron-forward" size={20} color="#888" />
                  </Pressable>
                ))}
              </ScrollView>
            )}
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
  settingsButton: {
    padding: 8,
  },
  filterBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1f1f2e',
    gap: 12,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#1f1f2e',
    borderRadius: 16,
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#2a2a3e',
  },
  filterChipActive: {
    backgroundColor: '#4ade80',
    borderColor: '#4ade80',
  },
  filterChipText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '500',
  },
  filterChipTextActive: {
    color: '#000',
    fontWeight: '600',
  },
  viewModeToggle: {
    flexDirection: 'row',
    backgroundColor: '#1f1f2e',
    borderRadius: 8,
    padding: 2,
  },
  viewModeButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  viewModeButtonActive: {
    backgroundColor: '#4ade80',
  },
  areaFilter: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1f1f2e',
  },
  areaChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: '#1f1f2e',
    borderRadius: 20,
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#2a2a3e',
  },
  areaChipActive: {
    backgroundColor: '#4ade80',
    borderColor: '#4ade80',
  },
  areaColorDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
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
  scrollView: {
    flex: 1,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
  },
  emptyStateText: {
    color: '#888',
    fontSize: 16,
    marginTop: 16,
    marginBottom: 24,
  },
  emptyStateButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: '#4ade80',
    borderRadius: 8,
  },
  emptyStateButtonText: {
    color: '#000',
    fontSize: 16,
    fontWeight: '600',
  },
  tableGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 12,
    gap: 12,
  },
  tableCard: {
    width: '30%',
    aspectRatio: 1,
    backgroundColor: '#1f1f2e',
    borderRadius: 12,
    padding: 12,
    borderWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  tableStatusIndicator: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 6,
    borderTopLeftRadius: 10,
    borderTopRightRadius: 10,
  },
  tableCardNumber: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
    marginTop: 8,
    marginBottom: 4,
  },
  tableCardInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  tableCardCapacity: {
    color: '#888',
    fontSize: 13,
  },
  tableCardWaiter: {
    fontSize: 11,
    color: '#888',
    marginTop: 4,
    textAlign: 'center',
  },
  tableList: {
    padding: 16,
  },
  tableListItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1f1f2e',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#2a2a3e',
  },
  tableListIndicator: {
    width: 6,
    height: '100%',
    borderRadius: 3,
    marginRight: 16,
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
  },
  tableListContent: {
    flex: 1,
    paddingLeft: 12,
  },
  tableListHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  tableListNumber: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
  },
  tableListArea: {
    fontSize: 13,
    color: '#888',
  },
  tableListDetails: {
    flexDirection: 'row',
    gap: 16,
  },
  tableListDetailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  tableListDetailText: {
    fontSize: 13,
    color: '#888',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#1f1f2e',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#fff',
  },
  modalClose: {
    padding: 4,
  },
  modalInfo: {
    backgroundColor: '#0f0f1a',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
  },
  modalInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  modalInfoLabel: {
    fontSize: 14,
    color: '#888',
  },
  modalInfoValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  modalSection: {
    marginBottom: 24,
  },
  modalSectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 16,
  },
  statusGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  statusOption: {
    width: '48%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 16,
    backgroundColor: '#0f0f1a',
    borderRadius: 12,
    borderWidth: 2,
  },
  statusOptionActive: {
    backgroundColor: '#2a2a3e',
  },
  statusOptionText: {
    fontSize: 14,
    fontWeight: '600',
  },
  primaryButton: {
    backgroundColor: '#4ade80',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#000',
    fontSize: 16,
    fontWeight: '700',
  },
  // Waiter Assignment Styles
  assignedWaiterCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#0f0f1a',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#4ade80',
  },
  assignedWaiterInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  assignedWaiterText: {
    gap: 4,
  },
  assignedWaiterName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  assignedWaiterRole: {
    fontSize: 13,
    color: '#888',
  },
  unassignButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#ef444420',
    borderRadius: 6,
  },
  unassignButtonText: {
    color: '#ef4444',
    fontSize: 13,
    fontWeight: '600',
  },
  assignWaiterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#0f0f1a',
    borderRadius: 12,
    padding: 16,
    borderWidth: 2,
    borderColor: '#4ade80',
    borderStyle: 'dashed',
  },
  assignWaiterButtonText: {
    color: '#4ade80',
    fontSize: 14,
    fontWeight: '600',
  },
  noWaitersState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
  },
  noWaitersText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginTop: 16,
  },
  noWaitersSubtext: {
    color: '#888',
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
  },
  manageStaffButton: {
    marginTop: 24,
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: '#4ade80',
    borderRadius: 8,
  },
  manageStaffButtonText: {
    color: '#000',
    fontSize: 14,
    fontWeight: '600',
  },
  waiterList: {
    maxHeight: 400,
  },
  waiterOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#0f0f1a',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#2a2a3e',
  },
  waiterOptionContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  waiterOptionInfo: {
    gap: 4,
  },
  waiterOptionName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  waiterOptionRole: {
    fontSize: 13,
    color: '#888',
  },
});

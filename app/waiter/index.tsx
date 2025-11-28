/**
 * Waiter Dashboard
 *
 * View for waiters to see their assigned tables and manage orders.
 */

import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { useTableStore } from '../../src/store/table.store';
import { useStaffStore } from '../../src/store/staff.store';
import type { TableRow } from '../../src/types/database';

const STATUS_COLORS: Record<TableRow['status'], string> = {
  available: '#4ade80',
  occupied: '#f59e0b',
  reserved: '#3b82f6',
  cleaning: '#8b5cf6',
  unavailable: '#ef4444',
};

export default function WaiterDashboardScreen() {
  const router = useRouter();

  const { getWaiterTables, recomputeFiltered, updateTableStatus } = useTableStore();
  const { getCurrentStaff } = useStaffStore();

  const [refreshing, setRefreshing] = useState(false);

  const currentStaff = getCurrentStaff();
  const myTables = currentStaff ? getWaiterTables(currentStaff.id) : [];

  // Recompute on mount
  useEffect(() => {
    recomputeFiltered();
  }, [recomputeFiltered]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    // TODO: Fetch latest data from Supabase
    recomputeFiltered();
    setTimeout(() => setRefreshing(false), 1000);
  }, [recomputeFiltered]);

  const handleTablePress = useCallback((tableId: string) => {
    // TODO: Navigate to table detail or start new order
    router.push('/pos');
  }, [router]);

  const handleQuickStatusChange = useCallback((tableId: string, newStatus: TableRow['status']) => {
    updateTableStatus(tableId, newStatus);
  }, [updateTableStatus]);

  // Group tables by status
  const occupiedTables = myTables.filter((t) => t.status === 'occupied');
  const availableTables = myTables.filter((t) => t.status === 'available');
  const otherTables = myTables.filter((t) => !['occupied', 'available'].includes(t.status));

  if (!currentStaff) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.emptyState}>
          <Ionicons name="person-outline" size={64} color="#666" />
          <Text style={styles.emptyStateText}>Not logged in</Text>
          <Text style={styles.emptyStateSubtext}>
            Please log in to view your tables
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="chevron-back" size={28} color="#fff" />
        </Pressable>
        <View style={styles.headerInfo}>
          <Text style={styles.headerSubtitle}>Waiter Dashboard</Text>
          <Text style={styles.headerTitle}>{currentStaff.name}</Text>
        </View>
        <Pressable onPress={() => router.push('/tables')} style={styles.floorPlanButton}>
          <Ionicons name="grid-outline" size={24} color="#4ade80" />
        </Pressable>
      </View>

      {/* Stats Summary */}
      <View style={styles.statsBar}>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{myTables.length}</Text>
          <Text style={styles.statLabel}>Total Tables</Text>
        </View>
        <View style={[styles.statCard, { borderColor: '#f59e0b' }]}>
          <Text style={[styles.statValue, { color: '#f59e0b' }]}>
            {occupiedTables.length}
          </Text>
          <Text style={styles.statLabel}>Occupied</Text>
        </View>
        <View style={[styles.statCard, { borderColor: '#4ade80' }]}>
          <Text style={[styles.statValue, { color: '#4ade80' }]}>
            {availableTables.length}
          </Text>
          <Text style={styles.statLabel}>Available</Text>
        </View>
      </View>

      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
      >
        {myTables.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="restaurant-outline" size={64} color="#666" />
            <Text style={styles.emptyStateText}>No tables assigned</Text>
            <Text style={styles.emptyStateSubtext}>
              Ask your manager to assign tables to you
            </Text>
          </View>
        ) : (
          <>
            {/* Occupied Tables */}
            {occupiedTables.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Occupied ({occupiedTables.length})</Text>
                {occupiedTables.map((table) => (
                  <Pressable
                    key={table.id}
                    style={[styles.tableCard, { borderColor: STATUS_COLORS.occupied }]}
                    onPress={() => handleTablePress(table.id)}
                  >
                    <View style={styles.tableCardHeader}>
                      <View style={styles.tableCardTitleRow}>
                        <Ionicons name="restaurant" size={24} color="#f59e0b" />
                        <Text style={styles.tableCardNumber}>Table {table.number}</Text>
                      </View>
                      <View style={[styles.tableStatusBadge, { backgroundColor: '#f59e0b20' }]}>
                        <Text style={[styles.tableStatusText, { color: '#f59e0b' }]}>
                          Occupied
                        </Text>
                      </View>
                    </View>

                    <View style={styles.tableCardInfo}>
                      <View style={styles.tableCardInfoItem}>
                        <Ionicons name="people-outline" size={16} color="#888" />
                        <Text style={styles.tableCardInfoText}>
                          {table.capacity} seats
                        </Text>
                      </View>
                      {table.area_name && (
                        <View style={styles.tableCardInfoItem}>
                          <Ionicons name="location-outline" size={16} color="#888" />
                          <Text style={styles.tableCardInfoText}>{table.area_name}</Text>
                        </View>
                      )}
                    </View>

                    <View style={styles.tableCardActions}>
                      <Pressable
                        style={[styles.actionButton, styles.actionButtonPrimary]}
                        onPress={() => handleTablePress(table.id)}
                      >
                        <Ionicons name="add-circle-outline" size={18} color="#000" />
                        <Text style={styles.actionButtonTextPrimary}>Add Order</Text>
                      </Pressable>
                      <Pressable
                        style={[styles.actionButton, styles.actionButtonSecondary]}
                        onPress={() => handleQuickStatusChange(table.id, 'available')}
                      >
                        <Ionicons name="checkmark-circle-outline" size={18} color="#4ade80" />
                        <Text style={styles.actionButtonTextSecondary}>Clear</Text>
                      </Pressable>
                    </View>
                  </Pressable>
                ))}
              </View>
            )}

            {/* Available Tables */}
            {availableTables.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Available ({availableTables.length})</Text>
                <View style={styles.availableGrid}>
                  {availableTables.map((table) => (
                    <Pressable
                      key={table.id}
                      style={[styles.availableTableCard, { borderColor: STATUS_COLORS.available }]}
                      onPress={() => handleTablePress(table.id)}
                    >
                      <Ionicons name="checkmark-circle" size={28} color="#4ade80" />
                      <Text style={styles.availableTableNumber}>{table.number}</Text>
                      {table.area_name && (
                        <Text style={styles.availableTableArea}>{table.area_name}</Text>
                      )}
                      <View style={styles.availableTableCapacity}>
                        <Ionicons name="people-outline" size={14} color="#888" />
                        <Text style={styles.availableTableCapacityText}>
                          {table.capacity}
                        </Text>
                      </View>
                    </Pressable>
                  ))}
                </View>
              </View>
            )}

            {/* Other Tables */}
            {otherTables.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Other ({otherTables.length})</Text>
                {otherTables.map((table) => {
                  const statusColor = STATUS_COLORS[table.status];
                  return (
                    <Pressable
                      key={table.id}
                      style={[styles.tableCard, { borderColor: statusColor }]}
                      onPress={() => handleTablePress(table.id)}
                    >
                      <View style={styles.tableCardHeader}>
                        <View style={styles.tableCardTitleRow}>
                          <Text style={styles.tableCardNumber}>Table {table.number}</Text>
                        </View>
                        <View style={[styles.tableStatusBadge, { backgroundColor: statusColor + '20' }]}>
                          <Text style={[styles.tableStatusText, { color: statusColor }]}>
                            {table.status.charAt(0).toUpperCase() + table.status.slice(1)}
                          </Text>
                        </View>
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            )}
          </>
        )}
      </ScrollView>
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
  headerInfo: {
    flex: 1,
    alignItems: 'center',
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#888',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
    marginTop: 2,
  },
  floorPlanButton: {
    padding: 8,
  },
  statsBar: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1f1f2e',
  },
  statCard: {
    flex: 1,
    backgroundColor: '#1a1a2e',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#2a2a3e',
  },
  statValue: {
    fontSize: 28,
    fontWeight: '700',
    color: '#fff',
  },
  statLabel: {
    fontSize: 12,
    color: '#888',
    marginTop: 4,
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
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
  },
  emptyStateSubtext: {
    color: '#888',
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
  },
  section: {
    padding: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 16,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  tableCard: {
    backgroundColor: '#1a1a2e',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 2,
  },
  tableCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  tableCardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  tableCardNumber: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
  },
  tableStatusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  tableStatusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  tableCardInfo: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 16,
  },
  tableCardInfoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  tableCardInfoText: {
    fontSize: 13,
    color: '#888',
  },
  tableCardActions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: 8,
  },
  actionButtonPrimary: {
    backgroundColor: '#4ade80',
  },
  actionButtonSecondary: {
    backgroundColor: '#4ade8020',
  },
  actionButtonTextPrimary: {
    color: '#000',
    fontSize: 14,
    fontWeight: '600',
  },
  actionButtonTextSecondary: {
    color: '#4ade80',
    fontSize: 14,
    fontWeight: '600',
  },
  availableGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  availableTableCard: {
    width: '30%',
    backgroundColor: '#1a1a2e',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    borderWidth: 2,
  },
  availableTableNumber: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
    marginTop: 8,
  },
  availableTableArea: {
    fontSize: 12,
    color: '#888',
    marginTop: 4,
  },
  availableTableCapacity: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 8,
  },
  availableTableCapacityText: {
    fontSize: 12,
    color: '#888',
  },
});

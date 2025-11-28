/**
 * Table Management Store
 *
 * Manages restaurant table state including areas, tables, assignments, and status tracking.
 * Integrates with order flow and staff management.
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type {
  TableAreaRow,
  TableRow,
  TableAssignmentRow,
} from '@/types/database';

// Extended table type with assignment info
export interface TableWithAssignment extends TableRow {
  assignment?: TableAssignmentRow & {
    staff_name?: string;
  };
  area_name?: string;
  active_orders_count?: number;
}

// Table area with table count
export interface TableAreaWithStats extends TableAreaRow {
  table_count: number;
  occupied_count: number;
  available_count: number;
}

// Table status filter type
export type TableStatusFilter = 'all' | TableRow['status'];

// Table view mode
export type TableViewMode = 'grid' | 'list' | 'floor';

interface TableState {
  // Data
  areas: TableAreaRow[];
  tables: TableRow[];
  assignments: TableAssignmentRow[];

  // UI State
  selectedTableId: string | null;
  selectedAreaId: string | null;
  statusFilter: TableStatusFilter;
  viewMode: TableViewMode;
  searchQuery: string;

  // Computed
  filteredTables: TableWithAssignment[];
  areasWithStats: TableAreaWithStats[];

  // Actions - Areas
  addArea: (area: Omit<TableAreaRow, 'id' | 'created_at' | 'updated_at'>) => void;
  updateArea: (id: string, updates: Partial<TableAreaRow>) => void;
  deleteArea: (id: string) => void;
  setAreas: (areas: TableAreaRow[]) => void;

  // Actions - Tables
  addTable: (table: Omit<TableRow, 'id' | 'created_at' | 'updated_at'>) => void;
  updateTable: (id: string, updates: Partial<TableRow>) => void;
  deleteTable: (id: string) => void;
  setTables: (tables: TableRow[]) => void;
  updateTableStatus: (id: string, status: TableRow['status']) => void;
  bulkUpdateTableStatus: (ids: string[], status: TableRow['status']) => void;

  // Actions - Assignments
  assignWaiter: (tableId: string, staffId: string, assignedBy?: string, notes?: string) => void;
  unassignWaiter: (tableId: string) => void;
  setAssignments: (assignments: TableAssignmentRow[]) => void;
  getWaiterTables: (staffId: string) => TableWithAssignment[];

  // Actions - UI State
  selectTable: (tableId: string | null) => void;
  selectArea: (areaId: string | null) => void;
  setStatusFilter: (filter: TableStatusFilter) => void;
  setViewMode: (mode: TableViewMode) => void;
  setSearchQuery: (query: string) => void;

  // Actions - Sync & Persistence
  syncFromSupabase: (data: {
    areas?: TableAreaRow[];
    tables?: TableRow[];
    assignments?: TableAssignmentRow[];
  }) => void;
  reset: () => void;

  // Internal
  recomputeFiltered: () => void;
  recomputeAreaStats: () => void;
}

// Generate unique IDs (local-first, will be replaced by Supabase UUIDs on sync)
function generateId(prefix: 'area' | 'table' | 'assignment'): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// Initial state
const initialState = {
  areas: [],
  tables: [],
  assignments: [],
  selectedTableId: null,
  selectedAreaId: null,
  statusFilter: 'all' as TableStatusFilter,
  viewMode: 'grid' as TableViewMode,
  searchQuery: '',
  filteredTables: [],
  areasWithStats: [],
};

export const useTableStore = create<TableState>()(
  persist(
    (set, get) => ({
      ...initialState,

      // ==========================================
      // AREAS
      // ==========================================
      addArea: (area) => {
        const newArea: TableAreaRow = {
          ...area,
          id: generateId('area'),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };

        set((state) => ({
          areas: [...state.areas, newArea].sort((a, b) => a.sort_order - b.sort_order),
        }));

        get().recomputeAreaStats();
      },

      updateArea: (id, updates) => {
        set((state) => ({
          areas: state.areas.map((area) =>
            area.id === id
              ? { ...area, ...updates, updated_at: new Date().toISOString() }
              : area
          ),
        }));

        get().recomputeAreaStats();
      },

      deleteArea: (id) => {
        set((state) => ({
          areas: state.areas.filter((area) => area.id !== id),
          // Unlink tables from deleted area
          tables: state.tables.map((table) =>
            table.area_id === id
              ? { ...table, area_id: null, updated_at: new Date().toISOString() }
              : table
          ),
        }));

        get().recomputeFiltered();
        get().recomputeAreaStats();
      },

      setAreas: (areas) => {
        set({ areas: areas.sort((a, b) => a.sort_order - b.sort_order) });
        get().recomputeAreaStats();
      },

      // ==========================================
      // TABLES
      // ==========================================
      addTable: (table) => {
        const newTable: TableRow = {
          ...table,
          id: generateId('table'),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };

        set((state) => ({
          tables: [...state.tables, newTable],
        }));

        get().recomputeFiltered();
        get().recomputeAreaStats();
      },

      updateTable: (id, updates) => {
        set((state) => ({
          tables: state.tables.map((table) =>
            table.id === id
              ? { ...table, ...updates, updated_at: new Date().toISOString() }
              : table
          ),
        }));

        get().recomputeFiltered();
        get().recomputeAreaStats();
      },

      deleteTable: (id) => {
        set((state) => ({
          tables: state.tables.filter((table) => table.id !== id),
          assignments: state.assignments.filter((assignment) => assignment.table_id !== id),
        }));

        get().recomputeFiltered();
        get().recomputeAreaStats();
      },

      setTables: (tables) => {
        set({ tables });
        get().recomputeFiltered();
        get().recomputeAreaStats();
      },

      updateTableStatus: (id, status) => {
        get().updateTable(id, { status });
      },

      bulkUpdateTableStatus: (ids, status) => {
        set((state) => ({
          tables: state.tables.map((table) =>
            ids.includes(table.id)
              ? { ...table, status, updated_at: new Date().toISOString() }
              : table
          ),
        }));

        get().recomputeFiltered();
        get().recomputeAreaStats();
      },

      // ==========================================
      // ASSIGNMENTS
      // ==========================================
      assignWaiter: (tableId, staffId, assignedBy, notes) => {
        // Deactivate existing assignments for this table
        set((state) => ({
          assignments: state.assignments.map((assignment) =>
            assignment.table_id === tableId && assignment.active
              ? { ...assignment, active: false, updated_at: new Date().toISOString() }
              : assignment
          ),
        }));

        // Create new assignment
        const newAssignment: TableAssignmentRow = {
          id: generateId('assignment'),
          table_id: tableId,
          staff_id: staffId,
          assigned_at: new Date().toISOString(),
          assigned_by: assignedBy || null,
          active: true,
          notes: notes || null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };

        set((state) => ({
          assignments: [...state.assignments, newAssignment],
        }));

        get().recomputeFiltered();
      },

      unassignWaiter: (tableId) => {
        set((state) => ({
          assignments: state.assignments.map((assignment) =>
            assignment.table_id === tableId && assignment.active
              ? { ...assignment, active: false, updated_at: new Date().toISOString() }
              : assignment
          ),
        }));

        get().recomputeFiltered();
      },

      setAssignments: (assignments) => {
        set({ assignments });
        get().recomputeFiltered();
      },

      getWaiterTables: (staffId) => {
        const { tables, assignments, areas } = get();

        // Import staff store to get staff names
        const staffStore = require('./staff.store').useStaffStore.getState();
        const staff = staffStore.staff;

        const waiterTableIds = assignments
          .filter((a) => a.staff_id === staffId && a.active)
          .map((a) => a.table_id);

        return tables
          .filter((table) => waiterTableIds.includes(table.id))
          .map((table) => {
            const assignment = assignments.find(
              (a) => a.table_id === table.id && a.active
            );
            const area = areas.find((a) => a.id === table.area_id);

            // Add staff name to assignment if exists
            let enrichedAssignment = assignment;
            if (assignment) {
              const staffMember = staff.find((s) => s.id === assignment.staff_id);
              enrichedAssignment = {
                ...assignment,
                staff_name: staffMember?.name,
              };
            }

            return {
              ...table,
              assignment: enrichedAssignment,
              area_name: area?.name,
            };
          });
      },

      // ==========================================
      // UI STATE
      // ==========================================
      selectTable: (tableId) => {
        set({ selectedTableId: tableId });
      },

      selectArea: (areaId) => {
        set({ selectedAreaId: areaId });
        get().recomputeFiltered();
      },

      setStatusFilter: (filter) => {
        set({ statusFilter: filter });
        get().recomputeFiltered();
      },

      setViewMode: (mode) => {
        set({ viewMode: mode });
      },

      setSearchQuery: (query) => {
        set({ searchQuery: query });
        get().recomputeFiltered();
      },

      // ==========================================
      // SYNC & PERSISTENCE
      // ==========================================
      syncFromSupabase: (data) => {
        const updates: Partial<TableState> = {};

        if (data.areas) {
          updates.areas = data.areas.sort((a, b) => a.sort_order - b.sort_order);
        }
        if (data.tables) {
          updates.tables = data.tables;
        }
        if (data.assignments) {
          updates.assignments = data.assignments;
        }

        set(updates);

        get().recomputeFiltered();
        get().recomputeAreaStats();
      },

      reset: () => {
        set(initialState);
      },

      // ==========================================
      // INTERNAL COMPUTATIONS
      // ==========================================
      recomputeFiltered: () => {
        const { tables, areas, assignments, selectedAreaId, statusFilter, searchQuery } = get();

        // Import staff store to get staff names
        const staffStore = require('./staff.store').useStaffStore.getState();
        const staff = staffStore.staff;

        let filtered = tables.filter((table) => table.active);

        // Filter by area
        if (selectedAreaId) {
          filtered = filtered.filter((table) => table.area_id === selectedAreaId);
        }

        // Filter by status
        if (statusFilter !== 'all') {
          filtered = filtered.filter((table) => table.status === statusFilter);
        }

        // Search filter
        if (searchQuery.trim()) {
          const query = searchQuery.toLowerCase();
          filtered = filtered.filter((table) =>
            table.number.toLowerCase().includes(query)
          );
        }

        // Enrich with assignment and area data
        const enriched: TableWithAssignment[] = filtered.map((table) => {
          const assignment = assignments.find(
            (a) => a.table_id === table.id && a.active
          );
          const area = areas.find((a) => a.id === table.area_id);

          // Add staff name to assignment if exists
          let enrichedAssignment = assignment;
          if (assignment) {
            const staffMember = staff.find((s) => s.id === assignment.staff_id);
            enrichedAssignment = {
              ...assignment,
              staff_name: staffMember?.name,
            };
          }

          return {
            ...table,
            assignment: enrichedAssignment,
            area_name: area?.name,
          };
        });

        set({ filteredTables: enriched });
      },

      recomputeAreaStats: () => {
        const { areas, tables } = get();

        const stats: TableAreaWithStats[] = areas.map((area) => {
          const areaTables = tables.filter((t) => t.area_id === area.id && t.active);
          const occupiedTables = areaTables.filter((t) => t.status === 'occupied');
          const availableTables = areaTables.filter((t) => t.status === 'available');

          return {
            ...area,
            table_count: areaTables.length,
            occupied_count: occupiedTables.length,
            available_count: availableTables.length,
          };
        });

        set({ areasWithStats: stats });
      },
    }),
    {
      name: 'cashu-pos-table-storage',
      storage: createJSONStorage(() => AsyncStorage),
      // Only persist data, not computed/UI state
      partialize: (state) => ({
        areas: state.areas,
        tables: state.tables,
        assignments: state.assignments,
        viewMode: state.viewMode,
      }),
      // Recompute derived state after hydration
      onRehydrateStorage: () => (state) => {
        if (state) {
          state.recomputeFiltered();
          state.recomputeAreaStats();
        }
      },
    }
  )
);

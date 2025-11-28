/**
 * Staff Management Store
 *
 * Manages staff members, roles, and permissions.
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { StaffRow } from '@/types/database';

interface StaffState {
  // Data
  staff: StaffRow[];
  currentStaffId: string | null; // Currently logged-in staff member

  // Actions - Staff management
  addStaff: (staff: Omit<StaffRow, 'id' | 'created_at' | 'updated_at'>) => void;
  updateStaff: (id: string, updates: Partial<StaffRow>) => void;
  deleteStaff: (id: string) => void;
  setStaff: (staff: StaffRow[]) => void;

  // Actions - Current staff
  setCurrentStaff: (staffId: string | null) => void;
  getCurrentStaff: () => StaffRow | null;

  // Queries
  getStaffByRole: (role: StaffRow['role']) => StaffRow[];
  getActiveWaiters: () => StaffRow[];
  getActiveStaff: () => StaffRow[];
}

// Generate unique IDs (local-first, will be replaced by Supabase UUIDs on sync)
function generateId(): string {
  return `staff_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// Initial state with sample staff
const initialState = {
  staff: [
    {
      id: 'staff_owner_1',
      store_id: 'local',
      name: 'Store Owner',
      email: null,
      pin_hash: null,
      role: 'owner' as const,
      permissions: ['payment', 'refund', 'reports', 'staff', 'settings', 'settlement'],
      active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  ] as StaffRow[],
  currentStaffId: 'staff_owner_1',
};

export const useStaffStore = create<StaffState>()(
  persist(
    (set, get) => ({
      ...initialState,

      // ==========================================
      // STAFF MANAGEMENT
      // ==========================================
      addStaff: (staffData) => {
        const newStaff: StaffRow = {
          ...staffData,
          id: generateId(),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };

        set((state) => ({
          staff: [...state.staff, newStaff],
        }));
      },

      updateStaff: (id, updates) => {
        set((state) => ({
          staff: state.staff.map((s) =>
            s.id === id
              ? { ...s, ...updates, updated_at: new Date().toISOString() }
              : s
          ),
        }));
      },

      deleteStaff: (id) => {
        set((state) => ({
          staff: state.staff.map((s) =>
            s.id === id
              ? { ...s, active: false, updated_at: new Date().toISOString() }
              : s
          ),
        }));
      },

      setStaff: (staff) => {
        set({ staff });
      },

      // ==========================================
      // CURRENT STAFF
      // ==========================================
      setCurrentStaff: (staffId) => {
        set({ currentStaffId: staffId });
      },

      getCurrentStaff: () => {
        const { staff, currentStaffId } = get();
        if (!currentStaffId) return null;
        return staff.find((s) => s.id === currentStaffId && s.active) || null;
      },

      // ==========================================
      // QUERIES
      // ==========================================
      getStaffByRole: (role) => {
        const { staff } = get();
        return staff.filter((s) => s.role === role && s.active);
      },

      getActiveWaiters: () => {
        const { staff } = get();
        return staff.filter((s) => s.role === 'waiter' && s.active);
      },

      getActiveStaff: () => {
        const { staff } = get();
        return staff.filter((s) => s.active);
      },
    }),
    {
      name: 'cashu-pos-staff-storage',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);

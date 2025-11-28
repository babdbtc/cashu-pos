/**
 * Staff Management Settings Screen
 *
 * Manage staff accounts and permissions.
 */

import { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  TextInput,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { useAlert } from '../../src/hooks/useAlert';
import type { StaffRole } from '../../src/types/config';

interface StaffMember {
  id: string;
  name: string;
  role: StaffRole;
  pin?: string;
  createdAt: Date;
}

const ROLE_INFO: Record<StaffRole, { title: string; description: string; color: string }> = {
  owner: {
    title: 'Owner',
    description: 'Full access to all settings and operations',
    color: '#f59e0b',
  },
  manager: {
    title: 'Manager',
    description: 'Can manage staff, view reports, process refunds',
    color: '#3b82f6',
  },
  supervisor: {
    title: 'Supervisor',
    description: 'Can process refunds, view daily reports',
    color: '#8b5cf6',
  },
  cashier: {
    title: 'Cashier',
    description: 'Can process payments only',
    color: '#4ade80',
  },
  viewer: {
    title: 'Viewer',
    description: 'Can view transactions, no actions',
    color: '#888',
  },
};

export default function StaffSettingsScreen() {
  const router = useRouter();
  const { error: showError, confirm } = useAlert();

  // Mock staff data - would be from store in production
  const [staff, setStaff] = useState<StaffMember[]>([
    { id: '1', name: 'Store Owner', role: 'owner', createdAt: new Date() },
  ]);
  const [showAddStaff, setShowAddStaff] = useState(false);
  const [newStaffName, setNewStaffName] = useState('');
  const [newStaffRole, setNewStaffRole] = useState<StaffRole>('cashier');

  const handleAddStaff = useCallback(() => {
    if (!newStaffName.trim()) {
      showError('Error', 'Please enter a staff name');
      return;
    }

    const newMember: StaffMember = {
      id: Date.now().toString(),
      name: newStaffName.trim(),
      role: newStaffRole,
      createdAt: new Date(),
    };

    setStaff((prev) => [...prev, newMember]);
    setNewStaffName('');
    setShowAddStaff(false);
  }, [newStaffName, newStaffRole, showError]);

  const handleRemoveStaff = useCallback((id: string, name: string) => {
    confirm(
      'Remove Staff',
      `Are you sure you want to remove ${name}?`,
      () => setStaff((prev) => prev.filter((s) => s.id !== id))
    );
  }, [confirm]);

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      {/* Back Button */}
      <Pressable onPress={() => router.back()} style={styles.backButton}>
        <Ionicons name="chevron-back" size={28} color="#fff" />
      </Pressable>

      <ScrollView style={styles.scrollView}>
        {/* Staff List */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Staff Members</Text>
            <Pressable
              style={styles.addButton}
              onPress={() => setShowAddStaff(true)}
            >
              <Text style={styles.addButtonText}>+ Add</Text>
            </Pressable>
          </View>

          {staff.map((member) => {
            const roleInfo = ROLE_INFO[member.role];
            return (
              <View key={member.id} style={styles.staffItem}>
                <View style={styles.staffInfo}>
                  <View style={styles.staffHeader}>
                    <Text style={styles.staffName}>{member.name}</Text>
                    <View
                      style={[styles.roleBadge, { backgroundColor: roleInfo.color + '20' }]}
                    >
                      <Text style={[styles.roleBadgeText, { color: roleInfo.color }]}>
                        {roleInfo.title}
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.staffDescription}>{roleInfo.description}</Text>
                </View>

                {member.role !== 'owner' && (
                  <Pressable
                    style={styles.removeButton}
                    onPress={() => handleRemoveStaff(member.id, member.name)}
                  >
                    <Text style={styles.removeButtonText}>Remove</Text>
                  </Pressable>
                )}
              </View>
            );
          })}
        </View>

        {/* Add Staff Form */}
        {showAddStaff && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Add New Staff</Text>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Name</Text>
              <TextInput
                style={styles.input}
                value={newStaffName}
                onChangeText={setNewStaffName}
                placeholder="Enter staff name"
                placeholderTextColor="#555"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Role</Text>
              {(Object.keys(ROLE_INFO) as StaffRole[])
                .filter((r) => r !== 'owner')
                .map((role) => {
                  const info = ROLE_INFO[role];
                  return (
                    <Pressable
                      key={role}
                      style={[
                        styles.roleOption,
                        newStaffRole === role && styles.roleOptionSelected,
                      ]}
                      onPress={() => setNewStaffRole(role)}
                    >
                      <View style={styles.roleRadio}>
                        <View
                          style={[
                            styles.radioOuter,
                            newStaffRole === role && { borderColor: info.color },
                          ]}
                        >
                          {newStaffRole === role && (
                            <View style={[styles.radioInner, { backgroundColor: info.color }]} />
                          )}
                        </View>
                      </View>
                      <View style={styles.roleOptionInfo}>
                        <Text style={styles.roleOptionTitle}>{info.title}</Text>
                        <Text style={styles.roleOptionDescription}>{info.description}</Text>
                      </View>
                    </Pressable>
                  );
                })}
            </View>

            <View style={styles.formActions}>
              <Pressable
                style={styles.cancelButton}
                onPress={() => setShowAddStaff(false)}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </Pressable>
              <Pressable style={styles.saveButton} onPress={handleAddStaff}>
                <Text style={styles.saveButtonText}>Add Staff</Text>
              </Pressable>
            </View>
          </View>
        )}

        {/* Role Permissions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Role Permissions</Text>

          <View style={styles.permissionsTable}>
            <View style={styles.permissionsHeader}>
              <Text style={styles.permissionLabel}>Permission</Text>
              <Text style={styles.permissionRole}>O</Text>
              <Text style={styles.permissionRole}>M</Text>
              <Text style={styles.permissionRole}>S</Text>
              <Text style={styles.permissionRole}>C</Text>
              <Text style={styles.permissionRole}>V</Text>
            </View>

            {[
              { label: 'Process Payments', o: true, m: true, s: true, c: true, v: false },
              { label: 'Process Refunds', o: true, m: true, s: true, c: false, v: false },
              { label: 'View Reports', o: true, m: true, s: true, c: false, v: true },
              { label: 'Manage Staff', o: true, m: true, s: false, c: false, v: false },
              { label: 'Change Settings', o: true, m: false, s: false, c: false, v: false },
              { label: 'Settlement', o: true, m: true, s: false, c: false, v: false },
            ].map((perm, idx) => (
              <View key={idx} style={styles.permissionsRow}>
                <Text style={styles.permissionLabel}>{perm.label}</Text>
                <Text style={styles.permissionCheck}>{perm.o ? '✓' : '–'}</Text>
                <Text style={styles.permissionCheck}>{perm.m ? '✓' : '–'}</Text>
                <Text style={styles.permissionCheck}>{perm.s ? '✓' : '–'}</Text>
                <Text style={styles.permissionCheck}>{perm.c ? '✓' : '–'}</Text>
                <Text style={styles.permissionCheck}>{perm.v ? '✓' : '–'}</Text>
              </View>
            ))}
          </View>

          <Text style={styles.legendText}>
            O = Owner, M = Manager, S = Supervisor, C = Cashier, V = Viewer
          </Text>
        </View>
      </ScrollView>
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
  section: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#2a2a3e',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#888',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  addButton: {
    backgroundColor: '#4ade80',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  addButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0f0f1a',
  },
  staffItem: {
    backgroundColor: '#1a1a2e',
    padding: 16,
    borderRadius: 8,
    marginBottom: 8,
  },
  staffInfo: {
    marginBottom: 12,
  },
  staffHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  staffName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
    marginRight: 8,
  },
  roleBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  roleBadgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  staffDescription: {
    fontSize: 14,
    color: '#888',
  },
  removeButton: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
    borderRadius: 6,
  },
  removeButtonText: {
    fontSize: 14,
    color: '#ef4444',
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#1a1a2e',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: '#ffffff',
  },
  roleOption: {
    flexDirection: 'row',
    backgroundColor: '#1a1a2e',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  roleOptionSelected: {
    backgroundColor: '#2a3a2e',
    borderWidth: 1,
    borderColor: '#4ade80',
  },
  roleRadio: {
    marginRight: 12,
    paddingTop: 2,
  },
  radioOuter: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#555',
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  roleOptionInfo: {
    flex: 1,
  },
  roleOptionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 2,
  },
  roleOptionDescription: {
    fontSize: 14,
    color: '#888',
  },
  formActions: {
    flexDirection: 'row',
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 8,
    backgroundColor: '#2a2a3e',
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#888',
  },
  saveButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 8,
    backgroundColor: '#4ade80',
    alignItems: 'center',
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0f0f1a',
  },
  permissionsTable: {
    backgroundColor: '#1a1a2e',
    borderRadius: 8,
    overflow: 'hidden',
  },
  permissionsHeader: {
    flexDirection: 'row',
    backgroundColor: '#2a2a3e',
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  permissionsRow: {
    flexDirection: 'row',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#2a2a3e',
  },
  permissionLabel: {
    flex: 1,
    fontSize: 14,
    color: '#888',
  },
  permissionRole: {
    width: 28,
    fontSize: 14,
    fontWeight: '600',
    color: '#888',
    textAlign: 'center',
  },
  permissionCheck: {
    width: 28,
    fontSize: 14,
    color: '#4ade80',
    textAlign: 'center',
  },
  legendText: {
    fontSize: 12,
    color: '#555',
    marginTop: 12,
    textAlign: 'center',
  },
});

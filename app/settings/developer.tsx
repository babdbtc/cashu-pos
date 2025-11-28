/**
 * Developer Utilities
 *
 * Tools for testing, debugging, and development.
 * Load sample data, clear data, and other utilities.
 */

import { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '@/components/layout';
import { Button } from '@/components/ui';
import { colors, spacing, typography } from '@/theme';
import { loadSampleData, clearSampleData, sampleAreas, sampleStaff, sampleProducts } from '@/utils/sampleData';
import { useToast } from '@/hooks/useToast';

export default function DeveloperScreen() {
  const router = useRouter();
  const { showSuccess, showError } = useToast();
  const [isLoading, setIsLoading] = useState(false);

  const handleLoadSampleData = async () => {
    Alert.alert(
      'Load Sample Data',
      'This will create sample areas, tables, and staff members. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Load',
          style: 'default',
          onPress: async () => {
            setIsLoading(true);
            try {
              const result = await loadSampleData();
              showSuccess(
                `Sample data loaded!\n${result.areaIds.length} areas, ${result.tableIds.length} tables, ${result.staffIds.length} staff`
              );
            } catch (error) {
              console.error('[Developer] Failed to load sample data:', error);
              showError('Failed to load sample data');
            } finally {
              setIsLoading(false);
            }
          },
        },
      ]
    );
  };

  const handleClearSampleData = async () => {
    Alert.alert(
      'Clear All Data',
      'This will delete ALL tables, areas, and staff (except owner). This cannot be undone!',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: async () => {
            setIsLoading(true);
            try {
              await clearSampleData();
              showSuccess('All sample data cleared');
            } catch (error) {
              console.error('[Developer] Failed to clear sample data:', error);
              showError('Failed to clear data');
            } finally {
              setIsLoading(false);
            }
          },
        },
      ]
    );
  };

  const handleShowDataPreview = () => {
    Alert.alert(
      'Sample Data Preview',
      `Areas: ${sampleAreas.length}\n` +
        `Staff: ${sampleStaff.length}\n` +
        `Products: ${sampleProducts.length}\n\n` +
        'Areas:\n' +
        sampleAreas.map((a) => `  • ${a.name}`).join('\n') +
        '\n\nStaff:\n' +
        sampleStaff.map((s) => `  • ${s.name} (${s.role})`).join('\n'),
      [{ text: 'OK' }]
    );
  };

  return (
    <Screen>
      <SafeAreaView style={styles.container} edges={['top']}>
        {/* Header */}
        <View style={styles.header}>
          <Button
            title=""
            onPress={() => router.back()}
            variant="ghost"
            size="sm"
            icon="chevron-back"
          />
          <Text style={styles.headerTitle}>Developer Tools</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView style={styles.content}>
          {/* Warning Banner */}
          <View style={styles.warningBanner}>
            <Ionicons name="warning" size={24} color="#f59e0b" />
            <View style={styles.warningText}>
              <Text style={styles.warningTitle}>Development Only</Text>
              <Text style={styles.warningSubtitle}>
                These tools are for testing and should not be used in production
              </Text>
            </View>
          </View>

          {/* Sample Data Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Sample Data</Text>
            <Text style={styles.sectionDescription}>
              Load realistic test data for tables, areas, and staff members
            </Text>

            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Ionicons name="grid" size={24} color={colors.accent.primary} />
                <Text style={styles.cardTitle}>Table Management Data</Text>
              </View>
              <Text style={styles.cardDescription}>
                Creates 4 areas (Main Dining, Patio, Bar, Private Room) with 22 tables and 6 staff
                members including 3 waiters
              </Text>
              <View style={styles.cardStats}>
                <View style={styles.statItem}>
                  <Text style={styles.statValue}>{sampleAreas.length}</Text>
                  <Text style={styles.statLabel}>Areas</Text>
                </View>
                <View style={styles.statItem}>
                  <Text style={styles.statValue}>22</Text>
                  <Text style={styles.statLabel}>Tables</Text>
                </View>
                <View style={styles.statItem}>
                  <Text style={styles.statValue}>{sampleStaff.length}</Text>
                  <Text style={styles.statLabel}>Staff</Text>
                </View>
              </View>
              <View style={styles.cardActions}>
                <Button
                  title="Preview Data"
                  onPress={handleShowDataPreview}
                  variant="ghost"
                  size="sm"
                  fullWidth
                />
                <Button
                  title={isLoading ? 'Loading...' : 'Load Sample Data'}
                  onPress={handleLoadSampleData}
                  variant="primary"
                  size="md"
                  fullWidth
                  disabled={isLoading}
                />
              </View>
            </View>

            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Ionicons name="restaurant" size={24} color={colors.accent.warning} />
                <Text style={styles.cardTitle}>Menu Items</Text>
              </View>
              <Text style={styles.cardDescription}>
                {sampleProducts.length} sample products across categories: Appetizers, Main Courses,
                Desserts, and Beverages
              </Text>
              <Text style={styles.cardNote}>
                Note: Product loading not yet implemented. Import products via Settings → Products.
              </Text>
            </View>
          </View>

          {/* Data Management Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Data Management</Text>
            <Text style={styles.sectionDescription}>Clear all test data and reset to default</Text>

            <View style={[styles.card, styles.dangerCard]}>
              <View style={styles.cardHeader}>
                <Ionicons name="trash" size={24} color={colors.accent.danger} />
                <Text style={[styles.cardTitle, styles.dangerText]}>Clear All Data</Text>
              </View>
              <Text style={styles.cardDescription}>
                Permanently delete all tables, areas, and staff (except owner). This action cannot
                be undone.
              </Text>
              <Button
                title={isLoading ? 'Clearing...' : 'Clear All Data'}
                onPress={handleClearSampleData}
                variant="ghost"
                size="md"
                fullWidth
                disabled={isLoading}
                style={styles.dangerButton}
              />
            </View>
          </View>

          {/* Quick Links Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Quick Links</Text>

            <View style={styles.linkGrid}>
              <Button
                title="Tables"
                onPress={() => router.push('/settings/tables')}
                variant="secondary"
                size="md"
                icon="grid-outline"
              />
              <Button
                title="Floor Plan"
                onPress={() => router.push('/tables')}
                variant="secondary"
                size="md"
                icon="restaurant-outline"
              />
              <Button
                title="Staff"
                onPress={() => router.push('/settings/staff')}
                variant="secondary"
                size="md"
                icon="people-outline"
              />
              <Button
                title="Waiter View"
                onPress={() => router.push('/waiter')}
                variant="secondary"
                size="md"
                icon="person-outline"
              />
            </View>
          </View>

          {/* Info Section */}
          <View style={styles.infoSection}>
            <Text style={styles.infoTitle}>Sample Data Details</Text>
            <Text style={styles.infoText}>
              <Text style={styles.infoBold}>Areas:</Text> Main Dining (blue), Patio (green), Bar
              (amber), Private Room (purple)
            </Text>
            <Text style={styles.infoText}>
              <Text style={styles.infoBold}>Tables:</Text> Mixed capacities (2-12 seats), various
              shapes and statuses
            </Text>
            <Text style={styles.infoText}>
              <Text style={styles.infoBold}>Staff:</Text> 1 manager, 1 cashier, 3 waiters, 1 chef
            </Text>
            <Text style={styles.infoText}>
              <Text style={styles.infoBold}>Assignments:</Text> Waiters automatically assigned to
              their sections
            </Text>
            <Text style={styles.infoText}>
              <Text style={styles.infoBold}>PINs:</Text> 1234 (manager), 3456-5678 (waiters)
            </Text>
          </View>
        </ScrollView>
      </SafeAreaView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.default,
  },
  headerTitle: {
    ...typography.h3,
    color: colors.text.primary,
  },
  content: {
    flex: 1,
    padding: spacing.lg,
  },
  warningBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.accent.warning + '20',
    padding: spacing.md,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.accent.warning,
    marginBottom: spacing.xl,
  },
  warningText: {
    flex: 1,
    marginLeft: spacing.md,
  },
  warningTitle: {
    ...typography.bodyLarge,
    fontWeight: '600',
    color: colors.accent.warning,
  },
  warningSubtitle: {
    ...typography.body,
    color: colors.text.secondary,
    marginTop: spacing.xs,
  },
  section: {
    marginBottom: spacing.xxl,
  },
  sectionTitle: {
    ...typography.h4,
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },
  sectionDescription: {
    ...typography.body,
    color: colors.text.secondary,
    marginBottom: spacing.lg,
  },
  card: {
    backgroundColor: colors.background.secondary,
    borderRadius: 12,
    padding: spacing.lg,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  dangerCard: {
    borderColor: colors.accent.danger,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  cardTitle: {
    ...typography.h5,
    color: colors.text.primary,
    marginLeft: spacing.sm,
  },
  dangerText: {
    color: colors.accent.danger,
  },
  cardDescription: {
    ...typography.body,
    color: colors.text.secondary,
    marginBottom: spacing.md,
  },
  cardNote: {
    ...typography.bodySmall,
    color: colors.text.tertiary,
    fontStyle: 'italic',
    marginTop: spacing.sm,
  },
  cardStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.background.primary,
    borderRadius: 8,
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    ...typography.h3,
    color: colors.accent.primary,
  },
  statLabel: {
    ...typography.label,
    marginTop: spacing.xs,
  },
  cardActions: {
    gap: spacing.sm,
  },
  dangerButton: {
    borderColor: colors.accent.danger,
  },
  linkGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  infoSection: {
    backgroundColor: colors.background.secondary,
    padding: spacing.lg,
    borderRadius: 12,
    marginBottom: spacing.xxl,
  },
  infoTitle: {
    ...typography.h5,
    color: colors.text.primary,
    marginBottom: spacing.md,
  },
  infoText: {
    ...typography.body,
    color: colors.text.secondary,
    marginBottom: spacing.sm,
    lineHeight: 20,
  },
  infoBold: {
    fontWeight: '600',
    color: colors.text.primary,
  },
});

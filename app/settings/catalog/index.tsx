/**
 * Catalog Management Hub
 *
 * Main entry point for managing products, categories, and modifiers.
 */

import { View, Text, StyleSheet, Pressable, ScrollView, Alert } from 'react-native';
import { Link, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useCatalogStore } from '@/store/catalog.store';

// Store presets
const STORE_PRESETS = [
  {
    id: 'coffee_shop',
    name: 'Coffee Shop',
    description: 'Espresso drinks, pastries, with milk & size options',
    icon: '☕',
  },
  {
    id: 'restaurant',
    name: 'Restaurant',
    description: 'Meals, sides, drinks with customizations',
    icon: '🍽️',
  },
  {
    id: 'retail',
    name: 'Retail Store',
    description: 'General products, no modifiers needed',
    icon: '🛒',
  },
  {
    id: 'bar',
    name: 'Bar / Pub',
    description: 'Drinks, cocktails, snacks',
    icon: '🍺',
  },
];

interface MenuItemProps {
  title: string;
  description: string;
  value?: string;
  href: string;
  icon?: string;
}

function MenuItem({ title, description, value, href, icon }: MenuItemProps) {
  return (
    <Link href={href as any} asChild>
      <Pressable style={styles.menuItem}>
        {icon && <Text style={styles.menuIcon}>{icon}</Text>}
        <View style={styles.menuContent}>
          <Text style={styles.menuTitle}>{title}</Text>
          <Text style={styles.menuDescription}>{description}</Text>
        </View>
        <View style={styles.menuRight}>
          {value && <Text style={styles.menuValue}>{value}</Text>}
          <Text style={styles.menuArrow}>›</Text>
        </View>
      </Pressable>
    </Link>
  );
}

interface PresetCardProps {
  preset: typeof STORE_PRESETS[0];
  onSelect: () => void;
}

function PresetCard({ preset, onSelect }: PresetCardProps) {
  return (
    <Pressable style={styles.presetCard} onPress={onSelect}>
      <Text style={styles.presetIcon}>{preset.icon}</Text>
      <Text style={styles.presetName}>{preset.name}</Text>
      <Text style={styles.presetDescription}>{preset.description}</Text>
    </Pressable>
  );
}

export default function CatalogScreen() {
  const router = useRouter();
  const categories = useCatalogStore((state) => state.categories);
  const products = useCatalogStore((state) => state.products);
  const modifierGroups = useCatalogStore((state) => state.modifierGroups);
  const clearLocalData = useCatalogStore((state) => state.clearLocalData);

  const handlePresetSelect = (presetId: string) => {
    Alert.alert(
      'Load Preset',
      `This will replace your current catalog with the ${STORE_PRESETS.find(p => p.id === presetId)?.name} preset. Continue?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Load Preset',
          onPress: () => {
            router.push(`/settings/catalog/preset/${presetId}` as any);
          },
        },
      ]
    );
  };

  const handleClearCatalog = () => {
    Alert.alert(
      'Clear Catalog',
      'This will remove all products, categories, and modifiers. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear All',
          style: 'destructive',
          onPress: () => {
            clearLocalData();
          },
        },
      ]
    );
  };

  const hasData = categories.length > 0 || products.length > 0;

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {/* Quick Stats */}
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>{categories.length}</Text>
            <Text style={styles.statLabel}>Categories</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>{products.length}</Text>
            <Text style={styles.statLabel}>Products</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>{modifierGroups.length}</Text>
            <Text style={styles.statLabel}>Modifiers</Text>
          </View>
        </View>

        {/* Management Links */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Manage Catalog</Text>

          <MenuItem
            title="Categories"
            description="Organize products into groups"
            value={`${categories.length}`}
            href="/settings/catalog/categories"
            icon="📁"
          />

          <MenuItem
            title="Products"
            description="Add and edit products"
            value={`${products.length}`}
            href="/settings/catalog/products"
            icon="📦"
          />

          <MenuItem
            title="Modifiers"
            description="Product add-ons like size, milk type"
            value={`${modifierGroups.length}`}
            href="/settings/catalog/modifiers"
            icon="✨"
          />
        </View>

        {/* Store Presets */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quick Setup Presets</Text>
          <Text style={styles.sectionSubtitle}>
            Start with a template for your business type
          </Text>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.presetsRow}
          >
            {STORE_PRESETS.map((preset) => (
              <PresetCard
                key={preset.id}
                preset={preset}
                onSelect={() => handlePresetSelect(preset.id)}
              />
            ))}
          </ScrollView>
        </View>

        {/* Danger Zone */}
        {hasData && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Danger Zone</Text>

            <Pressable style={styles.dangerButton} onPress={handleClearCatalog}>
              <Text style={styles.dangerButtonText}>Clear All Catalog Data</Text>
              <Text style={styles.dangerButtonHint}>Remove all products, categories, and modifiers</Text>
            </Pressable>
          </View>
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
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#1a1a2e',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 32,
    fontWeight: '700',
    color: '#00d4ff',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#888',
    textTransform: 'uppercase',
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#888',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 8,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 12,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a2e',
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
  },
  menuIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  menuContent: {
    flex: 1,
  },
  menuTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 2,
  },
  menuDescription: {
    fontSize: 14,
    color: '#888',
  },
  menuRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  menuValue: {
    fontSize: 14,
    color: '#00d4ff',
    fontWeight: '600',
    marginRight: 8,
  },
  menuArrow: {
    fontSize: 20,
    color: '#555',
  },
  presetsRow: {
    paddingVertical: 8,
    gap: 12,
  },
  presetCard: {
    width: 140,
    backgroundColor: '#1a1a2e',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#2a2a3e',
  },
  presetIcon: {
    fontSize: 32,
    marginBottom: 8,
  },
  presetName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ffffff',
    textAlign: 'center',
    marginBottom: 4,
  },
  presetDescription: {
    fontSize: 11,
    color: '#888',
    textAlign: 'center',
    lineHeight: 14,
  },
  dangerButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#ef4444',
    borderRadius: 12,
    padding: 16,
  },
  dangerButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ef4444',
    marginBottom: 4,
  },
  dangerButtonHint: {
    fontSize: 13,
    color: '#888',
  },
});

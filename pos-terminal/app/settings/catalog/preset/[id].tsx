/**
 * Preset Loading Screen
 *
 * Confirm and load a catalog preset.
 */

import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, ActivityIndicator, Alert } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useCatalogStore } from '@/store/catalog.store';
import { PRESETS } from '../presets';

export default function PresetScreen() {
    const { id } = useLocalSearchParams<{ id: string }>();
    const router = useRouter();
    const [isLoading, setIsLoading] = useState(false);

    const clearLocalData = useCatalogStore((state) => state.clearLocalData);
    const addCategory = useCatalogStore((state) => state.addCategory);
    const addProduct = useCatalogStore((state) => state.addProduct);
    const setModifierGroups = useCatalogStore((state) => state.setModifierGroups);

    const preset = id ? PRESETS[id] : null;

    if (!preset) {
        return (
            <SafeAreaView style={styles.container}>
                <View style={styles.errorContainer}>
                    <Text style={styles.errorText}>Preset not found</Text>
                    <Pressable style={styles.backButton} onPress={() => router.back()}>
                        <Text style={styles.backButtonText}>Go Back</Text>
                    </Pressable>
                </View>
            </SafeAreaView>
        );
    }

    const handleLoadPreset = async () => {
        setIsLoading(true);

        try {
            // 1. Clear existing data
            clearLocalData();

            // 2. Add Modifier Groups
            // We need to ensure IDs are unique if we were merging, but we are clearing.
            // However, the preset IDs might conflict if we load the same preset twice? 
            // Actually clearLocalData clears everything, so it's fine.
            // But we should probably regenerate IDs to be safe or just use the ones in preset if they are unique enough.
            // The preset IDs are static strings like 'mod_milk'. It's better to generate new IDs or keep them if we want consistency.
            // Let's keep them for simplicity as we just cleared data.
            setModifierGroups(preset.modifierGroups);

            // 3. Add Categories and keep track of their new IDs
            const categoryNameMap = new Map<string, string>();

            for (const cat of preset.categories) {
                if (!cat.name) continue;

                const newCat = await addCategory({
                    name: cat.name,
                    description: cat.description || null,
                    color: cat.color || '#666',
                    icon: cat.icon || '📁',
                    sort_order: cat.sort_order || 0,
                    active: true,
                    store_id: 'local',
                });

                categoryNameMap.set(cat.name, newCat.id);
            }

            // 4. Add Products
            for (const prod of preset.products) {
                if (!prod.name) continue;

                // Find the category ID based on the name we stored in the preset
                const categoryId = prod.category_id ? categoryNameMap.get(prod.category_id) : null;

                await addProduct({
                    name: prod.name,
                    description: prod.description || null,
                    price: prod.price || 0,
                    category_id: categoryId || null,
                    image_url: null,
                    sku: null,
                    barcode: null,
                    tax_rate: 0,
                    active: true,
                    track_inventory: false,
                    allow_backorder: true,
                    has_variants: false,
                    sort_order: 0,
                    cost: null,
                    store_id: 'local',
                });
            }

            Alert.alert('Success', 'Catalog preset loaded successfully', [
                { text: 'OK', onPress: () => router.replace('/settings/catalog') }
            ]);
        } catch (error) {
            console.error(error);
            Alert.alert('Error', 'Failed to load preset');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <SafeAreaView style={styles.container} edges={['bottom']}>
            <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
                <View style={styles.header}>
                    <Text style={styles.icon}>{preset.icon}</Text>
                    <Text style={styles.title}>{preset.name}</Text>
                    <Text style={styles.description}>{preset.description}</Text>
                </View>

                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>What's Included</Text>

                    <View style={styles.statRow}>
                        <View style={styles.statItem}>
                            <Text style={styles.statNumber}>{preset.categories.length}</Text>
                            <Text style={styles.statLabel}>Categories</Text>
                        </View>
                        <View style={styles.statItem}>
                            <Text style={styles.statNumber}>{preset.products.length}</Text>
                            <Text style={styles.statLabel}>Products</Text>
                        </View>
                        <View style={styles.statItem}>
                            <Text style={styles.statNumber}>{preset.modifierGroups.length}</Text>
                            <Text style={styles.statLabel}>Modifiers</Text>
                        </View>
                    </View>
                </View>

                <View style={styles.previewSection}>
                    <Text style={styles.sectionTitle}>Preview Categories</Text>
                    <View style={styles.categoriesList}>
                        {preset.categories.map((cat, index) => (
                            <View key={index} style={styles.categoryBadge}>
                                <Text style={styles.categoryIcon}>{cat.icon}</Text>
                                <Text style={styles.categoryName}>{cat.name}</Text>
                            </View>
                        ))}
                    </View>
                </View>

                <View style={styles.warningBox}>
                    <Text style={styles.warningTitle}>⚠️ Warning</Text>
                    <Text style={styles.warningText}>
                        Loading this preset will delete all your current products, categories, and modifiers. This action cannot be undone.
                    </Text>
                </View>
            </ScrollView>

            <View style={styles.footer}>
                <Pressable
                    style={styles.cancelButton}
                    onPress={() => router.back()}
                    disabled={isLoading}
                >
                    <Text style={styles.cancelButtonText}>Cancel</Text>
                </Pressable>

                <Pressable
                    style={styles.loadButton}
                    onPress={handleLoadPreset}
                    disabled={isLoading}
                >
                    {isLoading ? (
                        <ActivityIndicator color="#0f0f1a" />
                    ) : (
                        <Text style={styles.loadButtonText}>Load Preset</Text>
                    )}
                </Pressable>
            </View>
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
        padding: 24,
        paddingBottom: 100,
    },
    header: {
        alignItems: 'center',
        marginBottom: 32,
    },
    icon: {
        fontSize: 64,
        marginBottom: 16,
    },
    title: {
        fontSize: 28,
        fontWeight: '700',
        color: '#ffffff',
        marginBottom: 8,
        textAlign: 'center',
    },
    description: {
        fontSize: 16,
        color: '#888',
        textAlign: 'center',
        lineHeight: 24,
    },
    section: {
        marginBottom: 32,
    },
    sectionTitle: {
        fontSize: 14,
        fontWeight: '600',
        color: '#888',
        textTransform: 'uppercase',
        letterSpacing: 1,
        marginBottom: 16,
    },
    statRow: {
        flexDirection: 'row',
        gap: 12,
    },
    statItem: {
        flex: 1,
        backgroundColor: '#1a1a2e',
        borderRadius: 12,
        padding: 16,
        alignItems: 'center',
    },
    statNumber: {
        fontSize: 24,
        fontWeight: '700',
        color: '#00d4ff',
        marginBottom: 4,
    },
    statLabel: {
        fontSize: 12,
        color: '#888',
    },
    previewSection: {
        marginBottom: 32,
    },
    categoriesList: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    categoryBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#1a1a2e',
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: '#2a2a3e',
        gap: 6,
    },
    categoryIcon: {
        fontSize: 14,
    },
    categoryName: {
        fontSize: 14,
        color: '#ffffff',
    },
    warningBox: {
        backgroundColor: 'rgba(239, 68, 68, 0.1)',
        borderWidth: 1,
        borderColor: '#ef4444',
        borderRadius: 12,
        padding: 16,
    },
    warningTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: '#ef4444',
        marginBottom: 8,
    },
    warningText: {
        fontSize: 14,
        color: '#ef4444',
        lineHeight: 20,
    },
    footer: {
        flexDirection: 'row',
        padding: 16,
        gap: 12,
        borderTopWidth: 1,
        borderTopColor: '#2a2a3e',
        backgroundColor: '#0f0f1a',
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
    loadButton: {
        flex: 2,
        padding: 16,
        borderRadius: 12,
        backgroundColor: '#00d4ff',
        alignItems: 'center',
    },
    loadButtonText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#0f0f1a',
    },
    errorContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
    },
    errorText: {
        fontSize: 18,
        color: '#ef4444',
        marginBottom: 16,
    },
    backButton: {
        paddingHorizontal: 24,
        paddingVertical: 12,
        backgroundColor: '#2a2a3e',
        borderRadius: 8,
    },
    backButtonText: {
        color: '#ffffff',
        fontWeight: '600',
    },
});

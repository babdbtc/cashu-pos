/**
 * Business Type Settings Screen
 *
 * Change business type and view available features.
 */

import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, typography } from '@/theme';
import { useThemeColors } from '@/hooks/useThemeColors';
import { useConfigStore } from '@/store/config.store';
import type { BusinessType } from '@/types/config';

export default function BusinessTypeSettingsScreen() {
  const router = useRouter();
  const businessType = useConfigStore((state) => state.businessType);
  const setBusinessType = useConfigStore((state) => state.setBusinessType);
  const themeColors = useThemeColors();

  const businessTypes = [
    {
      type: 'restaurant' as BusinessType,
      emoji: '🍽️',
      title: 'Restaurant / Café',
      description: 'Table management, coursing, kitchen display',
      features: [
        'Floor plan with table status',
        'Course firing (apps → mains → desserts)',
        'Split billing by item/seat/amount',
        'Kitchen Display System (KDS)',
        'Modifiers (size, temp, toppings)',
        'Happy hour scheduling',
      ],
    },
    {
      type: 'retail' as BusinessType,
      emoji: '🛍️',
      title: 'Retail Store',
      description: 'Inventory, barcodes, customer directory',
      features: [
        'Barcode scanning (UPC, EAN, QR)',
        'Inventory tracking (SKU/serial/lot)',
        'Customer directory & loyalty',
        'Product variants (size, color)',
        'Gift cards',
        'Auto-reorder thresholds',
      ],
    },
    {
      type: 'service' as BusinessType,
      emoji: '💇',
      title: 'Service Business',
      description: 'Appointments, staff scheduling, packages',
      features: [
        'Appointment calendar',
        'Staff scheduling & providers',
        'Service packages & memberships',
        'Tip suggestions & pooling',
        'Commission tracking',
        'Duration-based services',
      ],
    },
    {
      type: 'general' as BusinessType,
      emoji: '🏪',
      title: 'General / Other',
      description: 'Basic POS features for any business',
      features: [
        'Product catalog',
        'Quick checkout',
        'Transaction history',
        'Basic reporting',
        'Multiple payment methods',
        'Offline mode',
      ],
    },
  ];

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      {/* Back Button */}
      <Pressable onPress={() => router.back()} style={styles.backButton}>
        <Ionicons name="chevron-back" size={28} color="#fff" />
      </Pressable>

      <ScrollView style={styles.scrollView}>
        {/* Current Business Type */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Current Business Type</Text>
          <View
            style={[
              styles.currentType,
              { borderColor: themeColors.accent },
            ]}
          >
            <Text style={styles.currentTypeEmoji}>
              {businessTypes.find((bt) => bt.type === businessType)?.emoji}
            </Text>
            <View style={styles.currentTypeContent}>
              <Text style={styles.currentTypeTitle}>
                {businessTypes.find((bt) => bt.type === businessType)?.title}
              </Text>
              <Text style={styles.currentTypeDescription}>
                {businessTypes.find((bt) => bt.type === businessType)?.description}
              </Text>
            </View>
          </View>
        </View>

        {/* Change Business Type */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Change Business Type</Text>
          <Text style={styles.sectionDescription}>
            Changing your business type will customize the UI and available features
          </Text>

          {businessTypes.map((item) => (
            <Pressable
              key={item.type}
              style={[
                styles.businessTypeOption,
                businessType === item.type && styles.businessTypeOptionActive,
                businessType === item.type && { borderColor: themeColors.accent },
              ]}
              onPress={() => setBusinessType(item.type)}
            >
              <View style={styles.businessTypeHeader}>
                <Text style={styles.businessTypeEmoji}>{item.emoji}</Text>
                <View style={styles.businessTypeContent}>
                  <Text
                    style={[
                      styles.businessTypeTitle,
                      businessType === item.type && { color: themeColors.accent },
                    ]}
                  >
                    {item.title}
                  </Text>
                  <Text style={styles.businessTypeDescription}>{item.description}</Text>
                </View>
                {businessType === item.type && (
                  <Text style={[styles.checkmark, { color: themeColors.accent }]}>✓</Text>
                )}
              </View>

              {/* Features */}
              <View style={styles.featureList}>
                {item.features.map((feature, index) => (
                  <View key={index} style={styles.featureItem}>
                    <Text style={styles.featureBullet}>•</Text>
                    <Text style={styles.featureText}>{feature}</Text>
                  </View>
                ))}
              </View>
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  backButton: {
    padding: 12,
    paddingLeft: 8,
  },
  scrollView: {
    flex: 1,
  },
  section: {
    padding: spacing.xl,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.default,
  },
  sectionTitle: {
    ...typography.h3,
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },
  sectionDescription: {
    ...typography.bodySmall,
    color: colors.text.secondary,
    marginBottom: spacing.lg,
  },
  currentType: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(74, 222, 128, 0.05)',
    borderWidth: 2,
    borderRadius: 16,
    padding: spacing.lg,
  },
  currentTypeEmoji: {
    fontSize: 48,
    marginRight: spacing.md,
  },
  currentTypeContent: {
    flex: 1,
  },
  currentTypeTitle: {
    ...typography.h3,
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },
  currentTypeDescription: {
    ...typography.bodySmall,
    color: colors.text.secondary,
  },
  businessTypeOption: {
    backgroundColor: colors.background.secondary,
    borderWidth: 2,
    borderColor: colors.border.default,
    borderRadius: 12,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  businessTypeOptionActive: {
    backgroundColor: 'rgba(74, 222, 128, 0.05)',
  },
  businessTypeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  businessTypeEmoji: {
    fontSize: 32,
    marginRight: spacing.md,
  },
  businessTypeContent: {
    flex: 1,
  },
  businessTypeTitle: {
    ...typography.h4,
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },
  businessTypeDescription: {
    ...typography.caption,
    color: colors.text.secondary,
  },
  checkmark: {
    fontSize: 24,
    fontWeight: '700',
    marginLeft: spacing.sm,
  },
  featureList: {
    gap: spacing.xs,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  featureBullet: {
    ...typography.bodySmall,
    color: colors.text.muted,
    marginRight: spacing.sm,
  },
  featureText: {
    ...typography.bodySmall,
    color: colors.text.muted,
    flex: 1,
  },
});

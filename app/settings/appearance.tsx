/**
 * Appearance Settings Screen
 *
 * Configure theme colors and visual customization.
 */

import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, typography } from '@/theme';
import { useThemeColors } from '@/hooks/useThemeColors';
import { useConfigStore } from '@/store/config.store';

export default function AppearanceSettingsScreen() {
  const router = useRouter();
  const appearance = useConfigStore((state) => state.appearance);
  const setAccentColor = useConfigStore((state) => state.setAccentColor);
  const setTheme = useConfigStore((state) => state.setTheme);
  const themeColors = useThemeColors();

  const accentColors = [
    { color: '#4ade80', name: 'Green' },
    { color: '#60a5fa', name: 'Blue' },
    { color: '#a78bfa', name: 'Purple' },
    { color: '#fb923c', name: 'Orange' },
    { color: '#f87171', name: 'Red' },
    { color: '#ec4899', name: 'Pink' },
    { color: '#fbbf24', name: 'Amber' },
    { color: '#2dd4bf', name: 'Teal' },
  ];

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      {/* Back Button */}
      <Pressable onPress={() => router.back()} style={styles.backButton}>
        <Ionicons name="chevron-back" size={28} color="#fff" />
      </Pressable>

      <ScrollView style={styles.scrollView}>
        {/* Accent Color */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Accent Color</Text>
          <Text style={styles.sectionDescription}>
            Choose a color that matches your brand
          </Text>

          <View style={styles.colorGrid}>
            {accentColors.map((item) => (
              <Pressable
                key={item.color}
                style={[
                  styles.colorOption,
                  appearance.accentColor === item.color && styles.colorOptionSelected,
                ]}
                onPress={() => setAccentColor(item.color)}
              >
                <View
                  style={[
                    styles.colorCircle,
                    { backgroundColor: item.color },
                    appearance.accentColor === item.color && styles.colorCircleSelected,
                  ]}
                >
                  {appearance.accentColor === item.color && (
                    <Text style={styles.checkmark}>✓</Text>
                  )}
                </View>
                <Text style={styles.colorName}>{item.name}</Text>
              </Pressable>
            ))}
          </View>
        </View>

        {/* Theme */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Theme</Text>
          <Text style={styles.sectionDescription}>
            Light theme coming soon
          </Text>

          <View style={styles.themeOptions}>
            <Pressable
              style={[
                styles.themeOption,
                appearance.theme === 'dark' && styles.themeOptionActive,
                appearance.theme === 'dark' && { borderColor: themeColors.accent },
              ]}
              onPress={() => setTheme('dark')}
            >
              <Text
                style={[
                  styles.themeOptionText,
                  appearance.theme === 'dark' && styles.themeOptionTextActive,
                  appearance.theme === 'dark' && { color: themeColors.accent },
                ]}
              >
                Dark
              </Text>
            </Pressable>
            <Pressable
              style={[
                styles.themeOption,
                appearance.theme === 'light' && styles.themeOptionActive,
                appearance.theme === 'light' && { borderColor: themeColors.accent },
                styles.themeOptionDisabled,
              ]}
              disabled
            >
              <Text
                style={[
                  styles.themeOptionText,
                  appearance.theme === 'light' && styles.themeOptionTextActive,
                  appearance.theme === 'light' && { color: themeColors.accent },
                  styles.themeOptionTextDisabled,
                ]}
              >
                Light (Coming Soon)
              </Text>
            </Pressable>
          </View>
        </View>

        {/* Preview */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Preview</Text>

          <View style={styles.previewBox}>
            <View style={[styles.previewButton, { backgroundColor: themeColors.accent }]}>
              <Text style={styles.previewButtonText}>Point of Sale</Text>
            </View>
            <View style={styles.previewStats}>
              <Text style={[styles.previewStatValue, { color: themeColors.accent }]}>
                $1,234.56
              </Text>
              <Text style={styles.previewStatLabel}>Today's Sales</Text>
            </View>
          </View>
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
  colorGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  colorOption: {
    alignItems: 'center',
    gap: spacing.sm,
    width: 80,
  },
  colorOptionSelected: {
    transform: [{ scale: 1.05 }],
  },
  colorCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: colors.background.secondary,
  },
  colorCircleSelected: {
    borderColor: colors.border.light,
    borderWidth: 4,
  },
  checkmark: {
    color: '#fff',
    fontSize: 28,
    fontWeight: '700',
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  colorName: {
    ...typography.caption,
    color: colors.text.secondary,
    fontSize: 12,
  },
  themeOptions: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  themeOption: {
    flex: 1,
    backgroundColor: colors.background.secondary,
    borderWidth: 1,
    borderColor: colors.border.default,
    borderRadius: 12,
    paddingVertical: spacing.lg,
    alignItems: 'center',
  },
  themeOptionActive: {
    backgroundColor: 'rgba(74, 222, 128, 0.1)',
  },
  themeOptionDisabled: {
    opacity: 0.5,
  },
  themeOptionText: {
    ...typography.body,
    color: colors.text.muted,
  },
  themeOptionTextActive: {
    fontWeight: '600',
  },
  themeOptionTextDisabled: {
    color: colors.text.muted,
  },
  previewBox: {
    backgroundColor: colors.background.secondary,
    borderRadius: 16,
    padding: spacing.xl,
    gap: spacing.lg,
  },
  previewButton: {
    borderRadius: 12,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.xl,
    alignItems: 'center',
  },
  previewButtonText: {
    ...typography.h3,
    color: colors.text.inverse,
    fontWeight: '700',
  },
  previewStats: {
    alignItems: 'center',
    gap: spacing.xs,
  },
  previewStatValue: {
    ...typography.h1,
    fontSize: 32,
  },
  previewStatLabel: {
    ...typography.caption,
    color: colors.text.muted,
  },
});

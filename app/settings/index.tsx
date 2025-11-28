/**
 * Settings Screen
 *
 * Main settings overview with navigation to sub-settings.
 */

import { View, Text, StyleSheet, Pressable, ScrollView, Alert } from 'react-native';
import { Link, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { useConfigStore } from '../../src/store/config.store';
import { useCatalogStore } from '../../src/store/catalog.store';

interface SettingsSectionProps {
  title: string;
  description: string;
  href: string;
  value?: string;
  restricted?: boolean;
}

function SettingsSection({ title, description, href, value, restricted }: SettingsSectionProps) {
  if (restricted) {
    return (
      <Pressable
        style={[styles.section, styles.sectionRestricted]}
        onPress={() => Alert.alert(
          'Restricted',
          'This setting is only available on the main terminal.',
          [{ text: 'OK' }]
        )}
      >
        <View style={styles.sectionContent}>
          <View style={styles.sectionTitleRow}>
            <Text style={[styles.sectionTitle, styles.sectionTitleRestricted]}>{title}</Text>
            <Ionicons name="lock-closed" size={14} color="#666" />
          </View>
          <Text style={styles.sectionDescription}>{description}</Text>
        </View>
        <View style={styles.sectionRight}>
          <Text style={styles.restrictedLabel}>Main Only</Text>
        </View>
      </Pressable>
    );
  }

  return (
    <Link href={href as any} asChild>
      <Pressable style={styles.section}>
        <View style={styles.sectionContent}>
          <Text style={styles.sectionTitle}>{title}</Text>
          <Text style={styles.sectionDescription}>{description}</Text>
        </View>
        <View style={styles.sectionRight}>
          {value && <Text style={styles.sectionValue}>{value}</Text>}
          <Text style={styles.sectionArrow}>›</Text>
        </View>
      </Pressable>
    </Link>
  );
}

export default function SettingsScreen() {
  const router = useRouter();
  const terminalName = useConfigStore((state) => state.terminalName);
  const terminalType = useConfigStore((state) => state.terminalType);
  const merchantName = useConfigStore((state) => state.merchantName);
  const currency = useConfigStore((state) => state.currency);
  const primaryMint = useConfigStore((state) => state.mints.primaryMintUrl);
  const trustedMints = useConfigStore((state) => state.mints.trusted);
  const products = useCatalogStore((state) => state.products);
  const categories = useCatalogStore((state) => state.categories);

  const isSubTerminal = terminalType === 'sub';

  const mintDisplay = primaryMint
    ? new URL(primaryMint).hostname
    : 'Not configured';

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      {/* Back Button */}
      <Pressable onPress={() => router.back()} style={styles.backButton}>
        <Ionicons name="chevron-back" size={28} color="#fff" />
      </Pressable>

      <ScrollView style={styles.scrollView}>
        {/* Terminal Info */}
        <View style={styles.group}>
          <Text style={styles.groupTitle}>Terminal</Text>

          <View style={styles.infoSection}>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Merchant</Text>
              <Text style={styles.infoValue}>{merchantName}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Terminal</Text>
              <Text style={styles.infoValue}>{terminalName}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Type</Text>
              <View style={styles.terminalTypeBadge}>
                <Text style={[
                  styles.terminalTypeText,
                  isSubTerminal ? styles.terminalTypeSub : styles.terminalTypeMain
                ]}>
                  {isSubTerminal ? 'Sub-Terminal' : 'Main Terminal'}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Business Configuration */}
        <View style={styles.group}>
          <Text style={styles.groupTitle}>Business</Text>

          <SettingsSection
            title="Business Type"
            description="Customize features for your business type"
            href="/settings/business"
          />
        </View>

        {/* Multi-Terminal Sync */}
        <View style={styles.group}>
          <Text style={styles.groupTitle}>Multi-Terminal</Text>

          <SettingsSection
            title="Sync Settings"
            description="Configure multi-terminal sync via Nostr"
            href="/settings/sync"
          />
        </View>

        {/* Catalog Management */}
        <View style={styles.group}>
          <Text style={styles.groupTitle}>Catalog</Text>

          <SettingsSection
            title="Products & Categories"
            description="Manage your product catalog"
            href="/settings/catalog"
            value={`${products.length} products`}
          />
        </View>

        {/* Restaurant Management */}
        <View style={styles.group}>
          <Text style={styles.groupTitle}>Restaurant</Text>

          <SettingsSection
            title="Tables & Areas"
            description="Manage dining tables and floor sections"
            href="/settings/tables"
          />
        </View>

        {/* Mint Configuration */}
        <View style={styles.group}>
          <Text style={styles.groupTitle}>Mint</Text>

          <SettingsSection
            title="Mint Configuration"
            description="Configure trusted mints for receiving payments"
            href="/settings/mint"
            value={`${trustedMints.length} mint${trustedMints.length !== 1 ? 's' : ''}`}
          />
        </View>

        {/* Appearance */}
        <View style={styles.group}>
          <Text style={styles.groupTitle}>Appearance</Text>

          <SettingsSection
            title="Theme & Colors"
            description="Customize your terminal's appearance"
            href="/settings/appearance"
          />
        </View>

        {/* Payment Settings */}
        <View style={styles.group}>
          <Text style={styles.groupTitle}>Payments</Text>

          <SettingsSection
            title="Currency"
            description="Display currency and exchange rate settings"
            href="/settings/currency"
            value={currency.displayCurrency}
          />

          <SettingsSection
            title="Settlement"
            description="Configure how payments are settled"
            href="/settings/settlement"
          />

          <SettingsSection
            title="Offline Mode"
            description="Configure offline payment acceptance"
            href="/settings/offline"
          />
        </View>

        {/* Wallet */}
        <View style={styles.group}>
          <Text style={styles.groupTitle}>Wallet</Text>

          <SettingsSection
            title="Backup Wallet"
            description="View and backup your recovery phrase"
            href="/wallet/backup"
          />

          <SettingsSection
            title="Restore Wallet"
            description="Restore wallet from recovery phrase"
            href="/wallet/restore"
          />
        </View>

        {/* Staff & Security */}
        <View style={styles.group}>
          <Text style={styles.groupTitle}>Staff & Security</Text>

          <SettingsSection
            title="Staff Management"
            description="Manage staff accounts and permissions"
            href="/settings/staff"
            restricted={isSubTerminal}
          />

          <SettingsSection
            title="Security"
            description="PIN, limits, and security settings"
            href="/settings/security"
            restricted={isSubTerminal}
          />

          <SettingsSection
            title="Admin Dashboard"
            description="Manage funds, withdrawals, and exports"
            href="/admin"
            restricted={isSubTerminal}
          />

        </View>

        {/* Developer Tools */}
        <View style={styles.group}>
          <Text style={styles.groupTitle}>Developer</Text>

          <SettingsSection
            title="Developer Tools"
            description="Load sample data and testing utilities"
            href="/settings/developer"
          />
        </View>

        {/* About */}
        <View style={styles.group}>
          <Text style={styles.groupTitle}>About</Text>

          <View style={styles.aboutSection}>
            <Text style={styles.aboutTitle}>CashuPay POS</Text>
            <Text style={styles.aboutVersion}>Version 1.0.0</Text>
            <Text style={styles.aboutDescription}>
              Open source point-of-sale terminal for Cashu ecash payments.
            </Text>
          </View>
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
  group: {
    marginBottom: 32,
  },
  groupTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#888',
    textTransform: 'uppercase',
    letterSpacing: 1,
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  section: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a2e',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#2a2a3e',
  },
  sectionRestricted: {
    opacity: 0.6,
  },
  sectionContent: {
    flex: 1,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 4,
  },
  sectionTitleRestricted: {
    marginBottom: 0,
  },
  restrictedLabel: {
    fontSize: 12,
    color: '#666',
    fontStyle: 'italic',
  },
  sectionDescription: {
    fontSize: 14,
    color: '#888',
  },
  sectionRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sectionValue: {
    fontSize: 14,
    color: '#888',
    marginRight: 8,
  },
  sectionArrow: {
    fontSize: 20,
    color: '#555',
  },
  infoSection: {
    backgroundColor: '#1a1a2e',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  infoLabel: {
    fontSize: 16,
    color: '#888',
  },
  infoValue: {
    fontSize: 16,
    color: '#ffffff',
    fontWeight: '500',
  },
  terminalTypeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  terminalTypeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  terminalTypeMain: {
    color: '#4ade80',
  },
  terminalTypeSub: {
    color: '#f59e0b',
  },
  aboutSection: {
    backgroundColor: '#1a1a2e',
    paddingHorizontal: 20,
    paddingVertical: 24,
    alignItems: 'center',
  },
  aboutTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: 4,
  },
  aboutVersion: {
    fontSize: 14,
    color: '#888',
    marginBottom: 12,
  },
  aboutDescription: {
    fontSize: 14,
    color: '#888',
    textAlign: 'center',
    lineHeight: 20,
  },
});

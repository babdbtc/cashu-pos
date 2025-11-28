/**
 * Settings Screen
 *
 * Main settings overview with navigation to sub-settings.
 */

import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import { Link, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useConfigStore } from '../../src/store/config.store';
import { useCatalogStore } from '../../src/store/catalog.store';

interface SettingsSectionProps {
  title: string;
  description: string;
  href: string;
  value?: string;
}

function SettingsSection({ title, description, href, value }: SettingsSectionProps) {
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
  const merchantName = useConfigStore((state) => state.merchantName);
  const currency = useConfigStore((state) => state.currency);
  const primaryMint = useConfigStore((state) => state.mints.primaryMintUrl);
  const trustedMints = useConfigStore((state) => state.mints.trusted);
  const products = useCatalogStore((state) => state.products);
  const categories = useCatalogStore((state) => state.categories);

  const mintDisplay = primaryMint
    ? new URL(primaryMint).hostname
    : 'Not configured';

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
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
          </View>
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

        {/* Staff & Security */}
        <View style={styles.group}>
          <Text style={styles.groupTitle}>Staff & Security</Text>

          <SettingsSection
            title="Staff Management"
            description="Manage staff accounts and permissions"
            href="/settings/staff"
          />

          <SettingsSection
            title="Security"
            description="PIN, limits, and security settings"
            href="/settings/security"
          />

          <SettingsSection
            title="Admin Dashboard"
            description="Manage funds, withdrawals, and exports"
            href="/admin"
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
  sectionContent: {
    flex: 1,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 4,
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

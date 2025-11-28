/**
 * Sync Settings Screen
 *
 * Configure and monitor multi-terminal sync via Nostr
 */

import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  ActivityIndicator,
  Switch,
} from 'react-native';
import { Stack, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { syncService } from '@/services/sync.service';
import { useConfigStore } from '@/store/config.store';
import { useThemeColors } from '@/hooks/useThemeColors';

export default function SyncSettingsScreen() {
  const colors = useThemeColors();
  const { merchantId, terminalId } = useConfigStore();

  const [syncStatus, setSyncStatus] = useState({
    enabled: false,
    syncing: false,
    pendingEvents: 0,
    lastSync: 0,
    nostrPubkey: null as string | null,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSyncStatus();
  }, []);

  const loadSyncStatus = async () => {
    try {
      const status = await syncService.getSyncStatus();
      setSyncStatus(status);
    } catch (error) {
      console.error('Error loading sync status:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleSync = async () => {
    try {
      if (syncStatus.enabled) {
        syncService.stopSync();
        setSyncStatus(prev => ({ ...prev, enabled: false }));
      } else {
        if (!merchantId || !terminalId) {
          alert('Please complete terminal setup first');
          return;
        }

        // Initialize if needed
        await syncService.initialize(merchantId, terminalId);
        await syncService.startSync();

        loadSyncStatus();
      }
    } catch (error) {
      console.error('Error toggling sync:', error);
      alert('Failed to toggle sync: ' + (error as Error).message);
    }
  };

  const handleManualSync = async () => {
    try {
      await syncService.performSync();
      loadSyncStatus();
    } catch (error) {
      console.error('Error performing sync:', error);
      alert('Sync failed: ' + (error as Error).message);
    }
  };

  const formatLastSync = (timestamp: number) => {
    if (!timestamp) return 'Never';

    const now = Date.now();
    const diff = now - timestamp;

    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return `${Math.floor(diff / 86400000)}d ago`;
  };

  const copyPubkey = () => {
    if (syncStatus.nostrPubkey) {
      // In a real app, use Clipboard API
      alert(`Pubkey copied: ${syncStatus.nostrPubkey.substring(0, 16)}...`);
    }
  };

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <Stack.Screen
          options={{
            title: 'Sync Settings',
            headerStyle: { backgroundColor: colors.surface },
            headerTintColor: colors.text,
          }}
        />
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Stack.Screen
        options={{
          title: 'Sync Settings',
          headerStyle: { backgroundColor: colors.surface },
          headerTintColor: colors.text,
        }}
      />

      <ScrollView contentContainerStyle={styles.content}>
        {/* Sync Status */}
        <View style={[styles.card, { backgroundColor: colors.surface }]}>
          <View style={styles.statusHeader}>
            <View style={styles.statusIcon}>
              <Ionicons
                name={syncStatus.enabled ? 'cloud-done' : 'cloud-offline'}
                size={32}
                color={syncStatus.enabled ? colors.accent : colors.textSecondary}
              />
            </View>
            <View style={styles.statusInfo}>
              <Text style={[styles.statusTitle, { color: colors.text }]}>
                {syncStatus.enabled ? 'Sync Active' : 'Sync Disabled'}
              </Text>
              <Text style={[styles.statusSubtitle, { color: colors.textSecondary }]}>
                Last sync: {formatLastSync(syncStatus.lastSync)}
              </Text>
            </View>
            <Switch
              value={syncStatus.enabled}
              onValueChange={handleToggleSync}
              trackColor={{ false: colors.border, true: colors.accent }}
              thumbColor="#fff"
            />
          </View>

          {syncStatus.enabled && (
            <>
              <View style={[styles.divider, { backgroundColor: colors.border }]} />

              <View style={styles.statsRow}>
                <View style={styles.stat}>
                  <Text style={[styles.statValue, { color: colors.text }]}>
                    {syncStatus.pendingEvents}
                  </Text>
                  <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
                    Pending
                  </Text>
                </View>

                <View style={styles.stat}>
                  <Text style={[styles.statValue, { color: colors.text }]}>
                    {syncStatus.syncing ? (
                      <ActivityIndicator size="small" color={colors.accent} />
                    ) : (
                      '✓'
                    )}
                  </Text>
                  <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
                    Status
                  </Text>
                </View>
              </View>
            </>
          )}
        </View>

        {/* Terminal Identity */}
        <View style={[styles.card, { backgroundColor: colors.surface }]}>
          <Text style={[styles.cardTitle, { color: colors.text }]}>Terminal Identity</Text>

          <View style={styles.identityRow}>
            <Text style={[styles.label, { color: colors.textSecondary }]}>Terminal ID</Text>
            <Text style={[styles.value, { color: colors.text }]}>{terminalId || 'Not set'}</Text>
          </View>

          {syncStatus.nostrPubkey && (
            <>
              <View style={styles.identityRow}>
                <Text style={[styles.label, { color: colors.textSecondary }]}>Nostr Pubkey</Text>
                <Pressable onPress={copyPubkey} style={styles.pubkeyContainer}>
                  <Text style={[styles.pubkey, { color: colors.accent }]} numberOfLines={1}>
                    {syncStatus.nostrPubkey.substring(0, 16)}...
                  </Text>
                  <Ionicons name="copy-outline" size={16} color={colors.accent} />
                </Pressable>
              </View>
            </>
          )}
        </View>

        {/* Actions */}
        {syncStatus.enabled && (
          <View style={[styles.card, { backgroundColor: colors.surface }]}>
            <Text style={[styles.cardTitle, { color: colors.text }]}>Actions</Text>

            <Pressable
              onPress={handleManualSync}
              style={[styles.actionButton, { backgroundColor: colors.accent }]}
              disabled={syncStatus.syncing}
            >
              {syncStatus.syncing ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Ionicons name="sync" size={20} color="#fff" />
                  <Text style={styles.actionButtonText}>Sync Now</Text>
                </>
              )}
            </Pressable>
          </View>
        )}

        {/* Info */}
        <View style={[styles.card, { backgroundColor: colors.surface }]}>
          <Text style={[styles.cardTitle, { color: colors.text }]}>About Sync</Text>
          <Text style={[styles.infoText, { color: colors.textSecondary }]}>
            Multi-terminal sync uses Nostr relays to synchronize data between terminals.
            Your data is encrypted and distributed across multiple relays for reliability.
          </Text>
          <Text style={[styles.infoText, { color: colors.textSecondary, marginTop: 12 }]}>
            When enabled, product changes, transactions, and other data will automatically
            sync with other terminals in your merchant network.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: 16,
  },
  card: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 16,
  },
  statusHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusIcon: {
    marginRight: 12,
  },
  statusInfo: {
    flex: 1,
  },
  statusTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 4,
  },
  statusSubtitle: {
    fontSize: 14,
  },
  divider: {
    height: 1,
    marginVertical: 16,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  stat: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    textTransform: 'uppercase',
  },
  identityRow: {
    marginBottom: 12,
  },
  label: {
    fontSize: 12,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  value: {
    fontSize: 14,
    fontWeight: '500',
  },
  pubkeyContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  pubkey: {
    fontSize: 14,
    fontFamily: 'monospace',
    flex: 1,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 8,
    gap: 8,
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  infoText: {
    fontSize: 14,
    lineHeight: 20,
  },
});

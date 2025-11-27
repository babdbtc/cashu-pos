/**
 * Mint Configuration Screen
 *
 * Allows adding and managing trusted mints.
 */

import { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  TextInput,
  ScrollView,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useConfigStore } from '../../src/store/config.store';
import { getMintInfo, isMintOnline } from '../../src/services/cashu.service';

export default function MintSettingsScreen() {
  const [newMintUrl, setNewMintUrl] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const trustedMints = useConfigStore((state) => state.mints.trusted);
  const primaryMintUrl = useConfigStore((state) => state.mints.primaryMintUrl);
  const addTrustedMint = useConfigStore((state) => state.addTrustedMint);
  const removeTrustedMint = useConfigStore((state) => state.removeTrustedMint);
  const setPrimaryMint = useConfigStore((state) => state.setPrimaryMint);

  const handleAddMint = useCallback(async () => {
    if (!newMintUrl.trim()) {
      setError('Please enter a mint URL');
      return;
    }

    // Validate URL format
    let url: URL;
    try {
      url = new URL(newMintUrl.trim());
    } catch {
      setError('Invalid URL format');
      return;
    }

    // Check if already added
    if (trustedMints.some((m) => m.url === url.toString())) {
      setError('This mint is already added');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Check if mint is online
      const isOnline = await isMintOnline(url.toString());
      if (!isOnline) {
        setError('Could not connect to mint');
        return;
      }

      // Get mint info for the name
      const info = await getMintInfo(url.toString());
      const mintName = info?.name || url.hostname;

      // Add to trusted mints
      addTrustedMint(url.toString(), mintName);
      setNewMintUrl('');
    } catch (err) {
      setError('Failed to add mint');
      console.error('Failed to add mint:', err);
    } finally {
      setIsLoading(false);
    }
  }, [newMintUrl, trustedMints, addTrustedMint]);

  const handleRemoveMint = useCallback(
    (mintUrl: string) => {
      Alert.alert(
        'Remove Mint',
        'Are you sure you want to remove this mint?',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Remove',
            style: 'destructive',
            onPress: () => removeTrustedMint(mintUrl),
          },
        ]
      );
    },
    [removeTrustedMint]
  );

  const handleSetPrimary = useCallback(
    (mintUrl: string) => {
      setPrimaryMint(mintUrl);
    },
    [setPrimaryMint]
  );

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView style={styles.scrollView}>
        {/* Add New Mint */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Add Mint</Text>

          <View style={styles.inputContainer}>
            <TextInput
              style={styles.input}
              value={newMintUrl}
              onChangeText={setNewMintUrl}
              placeholder="https://mint.example.com"
              placeholderTextColor="#555"
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
            />

            <Pressable
              style={[styles.addButton, isLoading && styles.addButtonDisabled]}
              onPress={handleAddMint}
              disabled={isLoading}
            >
              <Text style={styles.addButtonText}>
                {isLoading ? 'Adding...' : 'Add'}
              </Text>
            </Pressable>
          </View>

          {error && <Text style={styles.errorText}>{error}</Text>}

          <Text style={styles.helpText}>
            Enter the URL of a Cashu mint you trust. The mint will be verified
            before being added.
          </Text>
        </View>

        {/* Trusted Mints List */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Trusted Mints</Text>

          {trustedMints.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyStateText}>
                No mints configured yet. Add a mint to start accepting payments.
              </Text>
            </View>
          ) : (
            trustedMints.map((mint) => (
              <View key={mint.url} style={styles.mintItem}>
                <View style={styles.mintInfo}>
                  <View style={styles.mintHeader}>
                    <Text style={styles.mintName}>{mint.name}</Text>
                    {mint.url === primaryMintUrl && (
                      <View style={styles.primaryBadge}>
                        <Text style={styles.primaryBadgeText}>Primary</Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.mintUrl}>{mint.url}</Text>
                </View>

                <View style={styles.mintActions}>
                  {mint.url !== primaryMintUrl && (
                    <Pressable
                      style={styles.mintAction}
                      onPress={() => handleSetPrimary(mint.url)}
                    >
                      <Text style={styles.mintActionText}>Set Primary</Text>
                    </Pressable>
                  )}

                  <Pressable
                    style={[styles.mintAction, styles.mintActionDanger]}
                    onPress={() => handleRemoveMint(mint.url)}
                  >
                    <Text style={styles.mintActionTextDanger}>Remove</Text>
                  </Pressable>
                </View>
              </View>
            ))
          )}
        </View>

        {/* Info */}
        <View style={styles.section}>
          <Text style={styles.infoText}>
            The primary mint will be used to receive payments. Tokens from any
            trusted mint will be accepted.
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
  scrollView: {
    flex: 1,
  },
  section: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#2a2a3e',
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#888',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 16,
  },
  inputContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  input: {
    flex: 1,
    backgroundColor: '#1a1a2e',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: '#ffffff',
  },
  addButton: {
    backgroundColor: '#4ade80',
    paddingHorizontal: 20,
    borderRadius: 8,
    justifyContent: 'center',
  },
  addButtonDisabled: {
    backgroundColor: '#2a2a3e',
  },
  addButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0f0f1a',
  },
  errorText: {
    color: '#ef4444',
    fontSize: 14,
    marginTop: 8,
  },
  helpText: {
    color: '#888',
    fontSize: 14,
    marginTop: 12,
    lineHeight: 20,
  },
  emptyState: {
    padding: 24,
    backgroundColor: '#1a1a2e',
    borderRadius: 8,
    alignItems: 'center',
  },
  emptyStateText: {
    color: '#888',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  mintItem: {
    backgroundColor: '#1a1a2e',
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
  },
  mintInfo: {
    marginBottom: 12,
  },
  mintHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  mintName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
  },
  primaryBadge: {
    backgroundColor: '#4ade80',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    marginLeft: 8,
  },
  primaryBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#0f0f1a',
  },
  mintUrl: {
    fontSize: 14,
    color: '#888',
  },
  mintActions: {
    flexDirection: 'row',
    gap: 12,
  },
  mintAction: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    backgroundColor: '#2a2a3e',
  },
  mintActionDanger: {
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
  },
  mintActionText: {
    fontSize: 14,
    color: '#ffffff',
  },
  mintActionTextDanger: {
    fontSize: 14,
    color: '#ef4444',
  },
  infoText: {
    color: '#888',
    fontSize: 14,
    lineHeight: 20,
  },
});

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  Platform,
  Share,
} from 'react-native';
import { router } from 'expo-router';
import { useSeedStore } from '../../src/store/seed.store';
import * as Clipboard from 'expo-clipboard';
// Note: File system features are only available on mobile platforms
// Web platform will use download instead

export default function WalletBackupScreen() {
  const [mnemonic, setMnemonic] = useState<string>('');
  const [mnemonicWords, setMnemonicWords] = useState<string[]>([]);
  const [showMnemonic, setShowMnemonic] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const { getSeedForBackup, walletId } = useSeedStore();

  useEffect(() => {
    loadSeed();
  }, []);

  const loadSeed = async () => {
    try {
      setIsLoading(true);
      const seed = await getSeedForBackup();

      if (!seed) {
        Alert.alert(
          'No Wallet Found',
          'No wallet seed found. Please initialize a wallet first.',
          [{ text: 'OK', onPress: () => router.back() }]
        );
        return;
      }

      setMnemonic(seed);
      setMnemonicWords(seed.split(' '));
    } catch (error) {
      Alert.alert(
        'Error',
        'Failed to load wallet seed.',
        [{ text: 'OK', onPress: () => router.back() }]
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleRevealMnemonic = () => {
    Alert.alert(
      'Security Warning',
      'Your recovery phrase gives full access to your wallet. Make sure no one is watching your screen.',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Show Recovery Phrase',
          onPress: () => setShowMnemonic(true),
        },
      ]
    );
  };

  const handleCopyToClipboard = async () => {
    if (!showMnemonic) {
      handleRevealMnemonic();
      return;
    }

    await Clipboard.setStringAsync(mnemonic);

    Alert.alert(
      'Copied!',
      'Recovery phrase copied to clipboard. Remember to clear your clipboard after saving it securely.',
      [{ text: 'OK' }]
    );
  };

  const handleExportToFile = async () => {
    if (!showMnemonic) {
      handleRevealMnemonic();
      return;
    }

    try {
      const backupData = {
        walletType: 'Cashu POS Wallet',
        walletId: walletId || 'unknown',
        mnemonic,
        exportedAt: new Date().toISOString(),
        warning: 'Keep this file secure! Anyone with access to this file can access your funds.',
      };

      const fileName = `cashupay-wallet-backup-${Date.now()}.json`;
      const fileContent = JSON.stringify(backupData, null, 2);

      if (Platform.OS === 'web') {
        // Web platform - download as file
        const blob = new Blob([fileContent], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = fileName;
        link.click();
        URL.revokeObjectURL(url);

        Alert.alert('Success', 'Wallet backup file downloaded');
      } else {
        // Mobile platform - use Share API
        await Share.share({
          message: `Cashu POS Wallet Backup\n\nWallet ID: ${walletId}\nRecovery Phrase: ${mnemonic}\n\nKeep this information secure!`,
          title: 'Wallet Backup',
        });

        Alert.alert('Success', 'Backup shared successfully');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to export wallet backup');
      console.error('Export error:', error);
    }
  };

  if (isLoading) {
    return (
      <View style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading wallet...</Text>
        </View>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
      <View style={styles.header}>
        <Text style={styles.title}>🔐 Wallet Backup</Text>
        <Text style={styles.subtitle}>
          Your Recovery Phrase
        </Text>
      </View>

      <View style={styles.warningBox}>
        <Text style={styles.warningTitle}>⚠️ SECURITY WARNING</Text>
        <Text style={styles.warningText}>
          • Never share your recovery phrase with anyone{'\n'}
          • Store it in a secure location (offline is best){'\n'}
          • Anyone with these words can access your funds{'\n'}
          • Take a photo or write it down - don't just copy it
        </Text>
      </View>

      {!showMnemonic ? (
        <View style={styles.hiddenContainer}>
          <Text style={styles.hiddenText}>
            Recovery phrase is hidden for security
          </Text>

          <TouchableOpacity
            style={styles.revealButton}
            onPress={handleRevealMnemonic}
          >
            <Text style={styles.revealButtonText}>👁️ Reveal Recovery Phrase</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.mnemonicContainer}>
          {mnemonicWords.map((word, index) => (
            <View key={index} style={styles.wordItem}>
              <Text style={styles.wordNumber}>{index + 1}.</Text>
              <Text style={styles.wordText}>{word}</Text>
            </View>
          ))}
        </View>
      )}

      {showMnemonic && (
        <>
          <TouchableOpacity
            style={styles.copyButton}
            onPress={handleCopyToClipboard}
          >
            <Text style={styles.copyButtonText}>📋 Copy to Clipboard</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.exportButton}
            onPress={handleExportToFile}
          >
            <Text style={styles.exportButtonText}>💾 Export Backup File</Text>
          </TouchableOpacity>
        </>
      )}

      <View style={styles.infoBox}>
        <Text style={styles.infoTitle}>💡 Backup Best Practices</Text>
        <Text style={styles.infoText}>
          1. Write your recovery phrase on paper{'\n'}
          2. Store it in a safe or secure location{'\n'}
          3. Consider making multiple copies in different locations{'\n'}
          4. Never store it digitally (photos, cloud, etc.) unless encrypted{'\n'}
          5. Test your backup by restoring on a different device
        </Text>
      </View>

      <TouchableOpacity
        style={styles.doneButton}
        onPress={() => router.back()}
      >
        <Text style={styles.doneButtonText}>Done</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#fff',
    fontSize: 18,
  },
  header: {
    marginBottom: 30,
    alignItems: 'center',
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 18,
    color: '#999',
  },
  warningBox: {
    backgroundColor: '#ff6b001a',
    borderWidth: 2,
    borderColor: '#ff6b00',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
  },
  warningTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#ff6b00',
    marginBottom: 8,
  },
  warningText: {
    fontSize: 14,
    color: '#ff6b00',
    lineHeight: 22,
  },
  hiddenContainer: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 40,
    marginBottom: 20,
    alignItems: 'center',
  },
  hiddenText: {
    fontSize: 16,
    color: '#999',
    marginBottom: 20,
    textAlign: 'center',
  },
  revealButton: {
    backgroundColor: '#007AFF',
    borderRadius: 12,
    padding: 16,
    paddingHorizontal: 32,
  },
  revealButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  mnemonicContainer: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  wordItem: {
    width: '48%',
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  wordNumber: {
    fontSize: 14,
    color: '#666',
    width: 30,
  },
  wordText: {
    fontSize: 16,
    color: '#fff',
    fontWeight: '600',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  copyButton: {
    backgroundColor: '#333',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginBottom: 12,
  },
  copyButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  exportButton: {
    backgroundColor: '#4CAF50',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginBottom: 24,
  },
  exportButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  infoBox: {
    marginTop: 24,
    padding: 16,
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    marginBottom: 24,
  },
  infoTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  infoText: {
    color: '#999',
    fontSize: 14,
    lineHeight: 22,
  },
  doneButton: {
    backgroundColor: '#007AFF',
    borderRadius: 12,
    padding: 18,
    alignItems: 'center',
  },
  doneButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  Clipboard,
  Platform,
} from 'react-native';
import { router } from 'expo-router';
import { useSeedStore } from '../../src/store/seed.store';
import * as Clipboard2 from 'expo-clipboard';

export default function WalletSetupScreen() {
  const [mnemonic, setMnemonic] = useState<string>('');
  const [mnemonicWords, setMnemonicWords] = useState<string[]>([]);
  const [hasConfirmedBackup, setHasConfirmedBackup] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  const { initializeWallet, markSeedBackedUp } = useSeedStore();

  useEffect(() => {
    createNewWallet();
  }, []);

  const createNewWallet = async () => {
    try {
      console.log('[WalletSetup] Starting wallet creation...');
      setIsCreating(true);
      const newMnemonic = await initializeWallet();
      console.log('[WalletSetup] Wallet created successfully');
      setMnemonic(newMnemonic);
      setMnemonicWords(newMnemonic.split(' '));
    } catch (error) {
      console.error('[WalletSetup] Error creating wallet:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      Alert.alert(
        'Error',
        `Failed to create wallet: ${errorMessage}\n\nPlease try again.`,
        [{ text: 'Retry', onPress: createNewWallet }]
      );
    } finally {
      setIsCreating(false);
    }
  };

  const handleCopyToClipboard = async () => {
    if (Platform.OS === 'web') {
      Clipboard.setString(mnemonic);
    } else {
      await Clipboard2.setStringAsync(mnemonic);
    }

    Alert.alert(
      'Copied!',
      'Recovery phrase copied to clipboard. Please paste it somewhere safe immediately.',
      [{ text: 'OK' }]
    );
  };

  const handleConfirmBackup = () => {
    Alert.alert(
      'Confirm Backup',
      'Have you written down or securely saved your 12-word recovery phrase?\n\nYou will need it to recover your wallet if you lose access to this device.\n\nWithout it, your funds cannot be recovered!',
      [
        {
          text: 'Not Yet',
          style: 'cancel',
        },
        {
          text: 'Yes, I Saved It',
          onPress: async () => {
            setHasConfirmedBackup(true);
            await markSeedBackedUp();
          },
        },
      ]
    );
  };

  const handleContinue = () => {
    router.back();
  };

  if (isCreating || !mnemonic) {
    return (
      <View style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Creating your wallet...</Text>
        </View>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
      <View style={styles.header}>
        <Text style={styles.title}>🔐 Wallet Setup</Text>
        <Text style={styles.subtitle}>
          Your Recovery Phrase
        </Text>
      </View>

      <View style={styles.warningBox}>
        <Text style={styles.warningTitle}>⚠️ IMPORTANT</Text>
        <Text style={styles.warningText}>
          • Write down these 12 words in order{'\n'}
          • Keep them safe and private{'\n'}
          • Never share them with anyone{'\n'}
          • This is the ONLY way to recover your wallet{'\n'}
          • If you lose these words, you lose your funds
        </Text>
      </View>

      <View style={styles.mnemonicContainer}>
        {mnemonicWords.map((word, index) => (
          <View key={index} style={styles.wordItem}>
            <Text style={styles.wordNumber}>{index + 1}.</Text>
            <Text style={styles.wordText}>{word}</Text>
          </View>
        ))}
      </View>

      <TouchableOpacity
        style={styles.copyButton}
        onPress={handleCopyToClipboard}
      >
        <Text style={styles.copyButtonText}>📋 Copy to Clipboard</Text>
      </TouchableOpacity>

      {!hasConfirmedBackup ? (
        <TouchableOpacity
          style={styles.confirmButton}
          onPress={handleConfirmBackup}
        >
          <Text style={styles.confirmButtonText}>
            I Have Saved My Recovery Phrase
          </Text>
        </TouchableOpacity>
      ) : (
        <View>
          <View style={styles.successBox}>
            <Text style={styles.successText}>
              ✓ Backup confirmed! Your wallet is ready.
            </Text>
          </View>

          <TouchableOpacity
            style={styles.continueButton}
            onPress={handleContinue}
          >
            <Text style={styles.continueButtonText}>Continue</Text>
          </TouchableOpacity>
        </View>
      )}

      <View style={styles.infoBox}>
        <Text style={styles.infoText}>
          💡 Tip: You can view your recovery phrase again in Settings → Security → View Recovery Phrase
        </Text>
      </View>
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
    marginBottom: 16,
  },
  copyButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  confirmButton: {
    backgroundColor: '#4CAF50',
    borderRadius: 12,
    padding: 18,
    alignItems: 'center',
  },
  confirmButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  successBox: {
    backgroundColor: '#4CAF5020',
    borderWidth: 2,
    borderColor: '#4CAF50',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    alignItems: 'center',
  },
  successText: {
    color: '#4CAF50',
    fontSize: 16,
    fontWeight: '600',
  },
  continueButton: {
    backgroundColor: '#007AFF',
    borderRadius: 12,
    padding: 18,
    alignItems: 'center',
  },
  continueButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  infoBox: {
    marginTop: 24,
    padding: 16,
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
  },
  infoText: {
    color: '#999',
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
});

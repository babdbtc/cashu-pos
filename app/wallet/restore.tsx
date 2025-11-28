import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Alert,
  Platform,
} from 'react-native';
import { router } from 'expo-router';
import { useSeedStore } from '../../src/store/seed.store';
import { seedService } from '../../src/services/seed.service';

export default function WalletRestoreScreen() {
  const [inputWords, setInputWords] = useState<string[]>(Array(12).fill(''));
  const [isRestoring, setIsRestoring] = useState(false);

  const { restoreWallet } = useSeedStore();

  const handleWordChange = (index: number, value: string) => {
    const newWords = [...inputWords];
    newWords[index] = value.toLowerCase().trim();
    setInputWords(newWords);
  };

  const handlePasteFromClipboard = async () => {
    try {
      // Try to get clipboard content
      const clipboardContent = await navigator.clipboard?.readText();

      if (!clipboardContent) {
        Alert.alert('Error', 'No text found in clipboard');
        return;
      }

      const words = clipboardContent
        .toLowerCase()
        .trim()
        .split(/\s+/)
        .filter(word => word.length > 0);

      if (words.length !== 12) {
        Alert.alert(
          'Invalid Format',
          `Expected 12 words, found ${words.length}. Please check your recovery phrase.`
        );
        return;
      }

      setInputWords(words);
      Alert.alert('Success', 'Recovery phrase pasted from clipboard');
    } catch (error) {
      Alert.alert(
        'Manual Entry Required',
        'Please enter your 12-word recovery phrase manually.'
      );
    }
  };

  const handleRestore = async () => {
    const mnemonic = inputWords.join(' ');

    // Validate all words are filled
    if (inputWords.some(word => !word)) {
      Alert.alert('Incomplete', 'Please enter all 12 words');
      return;
    }

    // Validate mnemonic
    if (!seedService.validateSeed(mnemonic)) {
      Alert.alert(
        'Invalid Recovery Phrase',
        'The words you entered do not form a valid recovery phrase. Please check and try again.'
      );
      return;
    }

    Alert.alert(
      'Restore Wallet',
      'This will replace any existing wallet data. Are you sure you want to continue?',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Restore',
          style: 'destructive',
          onPress: async () => {
            try {
              setIsRestoring(true);
              await restoreWallet(mnemonic);

              Alert.alert(
                'Success!',
                'Your wallet has been restored successfully.',
                [
                  {
                    text: 'OK',
                    onPress: () => router.replace('/'),
                  },
                ]
              );
            } catch (error) {
              Alert.alert(
                'Restore Failed',
                error instanceof Error ? error.message : 'Failed to restore wallet'
              );
            } finally {
              setIsRestoring(false);
            }
          },
        },
      ]
    );
  };

  const handleClearAll = () => {
    setInputWords(Array(12).fill(''));
  };

  const isComplete = inputWords.every(word => word.length > 0);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
      <View style={styles.header}>
        <Text style={styles.title}>🔓 Restore Wallet</Text>
        <Text style={styles.subtitle}>
          Enter your 12-word recovery phrase
        </Text>
      </View>

      <View style={styles.infoBox}>
        <Text style={styles.infoText}>
          Enter the 12 words from your recovery phrase in the correct order.
          Each word should be lowercase with no extra spaces.
        </Text>
      </View>

      {Platform.OS === 'web' && (
        <TouchableOpacity
          style={styles.pasteButton}
          onPress={handlePasteFromClipboard}
        >
          <Text style={styles.pasteButtonText}>📋 Paste from Clipboard</Text>
        </TouchableOpacity>
      )}

      <View style={styles.inputContainer}>
        {inputWords.map((word, index) => (
          <View key={index} style={styles.wordInputWrapper}>
            <Text style={styles.wordLabel}>{index + 1}.</Text>
            <TextInput
              style={styles.wordInput}
              value={word}
              onChangeText={(value) => handleWordChange(index, value)}
              placeholder={`Word ${index + 1}`}
              placeholderTextColor="#666"
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="off"
              returnKeyType={index === 11 ? 'done' : 'next'}
              blurOnSubmit={index === 11}
            />
          </View>
        ))}
      </View>

      <View style={styles.buttonContainer}>
        <TouchableOpacity
          style={[styles.clearButton, { marginRight: 10 }]}
          onPress={handleClearAll}
        >
          <Text style={styles.clearButtonText}>Clear All</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.restoreButton,
            !isComplete && styles.restoreButtonDisabled,
            { flex: 1 },
          ]}
          onPress={handleRestore}
          disabled={!isComplete || isRestoring}
        >
          <Text style={styles.restoreButtonText}>
            {isRestoring ? 'Restoring...' : 'Restore Wallet'}
          </Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity
        style={styles.cancelButton}
        onPress={() => router.back()}
      >
        <Text style={styles.cancelButtonText}>Cancel</Text>
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
  header: {
    marginBottom: 24,
    alignItems: 'center',
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 16,
    color: '#999',
  },
  infoBox: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  infoText: {
    color: '#999',
    fontSize: 14,
    lineHeight: 20,
  },
  pasteButton: {
    backgroundColor: '#333',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginBottom: 20,
  },
  pasteButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  inputContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  wordInputWrapper: {
    width: '48%',
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    backgroundColor: '#1a1a1a',
    borderRadius: 8,
    padding: 12,
  },
  wordLabel: {
    fontSize: 14,
    color: '#666',
    width: 30,
    fontWeight: '600',
  },
  wordInput: {
    flex: 1,
    fontSize: 16,
    color: '#fff',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  buttonContainer: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  clearButton: {
    backgroundColor: '#333',
    borderRadius: 12,
    padding: 18,
    alignItems: 'center',
    flex: 1,
  },
  clearButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  restoreButton: {
    backgroundColor: '#4CAF50',
    borderRadius: 12,
    padding: 18,
    alignItems: 'center',
  },
  restoreButtonDisabled: {
    backgroundColor: '#333',
    opacity: 0.5,
  },
  restoreButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  cancelButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#666',
    borderRadius: 12,
    padding: 18,
    alignItems: 'center',
  },
  cancelButtonText: {
    color: '#666',
    fontSize: 16,
    fontWeight: '600',
  },
});

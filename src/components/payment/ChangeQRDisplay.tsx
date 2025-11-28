/**
 * ChangeQRDisplay
 *
 * Full-screen display for change token QR code that customer can scan.
 */

import { View, Text, StyleSheet, Pressable, Share } from 'react-native';
import { useState } from 'react';
import QRCode from 'react-native-qrcode-svg';
import * as Clipboard from 'expo-clipboard';
import { Screen } from '@/components/layout';
import { Button } from '@/components/ui';
import { Toast } from '@/components/common/Toast';
import { colors, spacing, typography, borderRadius } from '@/theme';
import { getCurrencySymbol } from '@/constants/currencies';

interface ChangeQRDisplayProps {
  changeToken: string;
  changeSats: number;
  fiatAmount: number;
  fiatCurrency: string;
  onDone: () => void;
}

export function ChangeQRDisplay({
  changeToken,
  changeSats,
  fiatAmount,
  fiatCurrency,
  onDone,
}: ChangeQRDisplayProps) {
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');

  const currencySymbol = getCurrencySymbol(fiatCurrency);

  const handleCopyToken = async () => {
    try {
      await Clipboard.setStringAsync(changeToken);
      setToastMessage('Token copied to clipboard');
      setShowToast(true);
      setTimeout(() => setShowToast(false), 2000);
    } catch (error) {
      console.error('Failed to copy token:', error);
    }
  };

  const handleShareToken = async () => {
    try {
      await Share.share({
        message: `Cashu Change Token:\n\n${changeToken}`,
        title: 'Cashu Change',
      });
    } catch (error) {
      console.error('Failed to share token:', error);
    }
  };

  return (
    <Screen style={styles.screen}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Scan to Receive Change</Text>
      </View>

      {/* QR Code */}
      <View style={styles.qrSection}>
        <View style={styles.qrContainer}>
          <View style={styles.qrWrapper}>
            <QRCode
              value={changeToken}
              size={280}
              color="black"
              backgroundColor="white"
            />
          </View>
        </View>

        {/* Amount Display */}
        <View style={styles.amountContainer}>
          <Text style={styles.amountSats}>{changeSats.toLocaleString()} sats</Text>
          <Text style={styles.amountFiat}>
            ≈ {currencySymbol}{fiatAmount.toFixed(2)}
          </Text>
        </View>

        {/* Instructions */}
        <View style={styles.instructions}>
          <Text style={styles.instructionTitle}>For Customer:</Text>
          <Text style={styles.instructionText}>
            Scan this QR code with your Cashu wallet to receive change
          </Text>
        </View>
      </View>

      {/* Actions */}
      <View style={styles.actions}>
        <Button
          title="Copy Token"
          onPress={handleCopyToken}
          variant="secondary"
          size="md"
          fullWidth
        />

        <Button
          title="Share Token"
          onPress={handleShareToken}
          variant="secondary"
          size="md"
          fullWidth
        />

        <Button
          title="Done"
          onPress={onDone}
          variant="primary"
          size="lg"
          fullWidth
        />
      </View>

      {/* Toast for feedback */}
      {showToast && (
        <Toast
          message={toastMessage}
          type="success"
          onDismiss={() => setShowToast(false)}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    padding: spacing.xl,
  },
  header: {
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  headerTitle: {
    ...typography.h2,
    textAlign: 'center',
  },
  qrSection: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  qrContainer: {
    marginBottom: spacing.xl,
  },
  qrWrapper: {
    padding: spacing.lg,
    backgroundColor: 'white',
    borderRadius: borderRadius.xl,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 12,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  amountContainer: {
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  amountSats: {
    ...typography.amountLarge,
    color: colors.accent.success,
    fontWeight: '700',
  },
  amountFiat: {
    ...typography.bodyLarge,
    color: colors.text.secondary,
    marginTop: spacing.xs,
  },
  instructions: {
    backgroundColor: colors.accent.primary + '10',
    borderRadius: borderRadius.md,
    padding: spacing.md,
    maxWidth: 320,
  },
  instructionTitle: {
    ...typography.button,
    color: colors.accent.primary,
    marginBottom: spacing.xs,
  },
  instructionText: {
    ...typography.bodySmall,
    color: colors.text.secondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  actions: {
    gap: spacing.md,
  },
});

// Platform import for shadows
import { Platform } from 'react-native';

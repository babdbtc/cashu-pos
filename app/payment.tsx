/**
 * Payment Screen
 *
 * Displays payment details and waits for NFC tap, QR scan, or Lightning payment.
 */

import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import QRCode from 'react-native-qrcode-svg';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Screen } from '@/components/layout';
import { Button } from '@/components/ui';
import { PriceDisplay } from '@/components/common/PriceDisplay';
import { PaymentStateIndicator } from '@/components/payment/PaymentStateIndicator';
import { PaymentErrorModal } from '@/components/payment/PaymentErrorModal';
import { RateLockBadge } from '@/components/payment/RateLockBadge';
import { RateExpiryOverlay } from '@/components/payment/RateExpiryOverlay';
import { colors, spacing, typography, borderRadius } from '@/theme';
import { getCurrencySymbol } from '@/constants/currencies';
import { usePaymentStore, PaymentMethod } from '@/store/payment.store';
import { useConfigStore } from '@/store/config.store';
import { useWalletStore } from '@/store/wallet.store';
import { nfcService } from '@/services/nfc.service';
import { createMintQuote, checkMintQuote, mintTokens, parseToken, swapTokens, encodeToken } from '@/services/cashu.service';
import { syncTransaction } from '@/services/sync-integration';
import { tokenForwardService } from '@/services/token-forward.service';
import { createPaymentError } from '@/types/payment-error';
import type { PaymentErrorRecovery } from '@/types/payment-error';

export default function PaymentScreen() {
  const router = useRouter();
  const {
    currentPayment,
    paymentMethod,
    setPaymentMethod,
    updatePaymentState,
    cancelPayment,
    completePayment,
    failPayment,
    setLightningInvoice,
    lightningInvoice,
    setLightningPaid,
    errorDetails,
    clearPaymentError,
  } = usePaymentStore();

  const { mints, currency, terminalType, terminalId, terminalName, merchantId } = useConfigStore();
  const { addProofs } = useWalletStore();
  const primaryMintUrl = mints.primaryMintUrl;

  // Check if this terminal should forward tokens to main
  const shouldForwardTokens = tokenForwardService.shouldForwardTokens();

  const [isListening, setIsListening] = useState(false);
  const [isGeneratingInvoice, setIsGeneratingInvoice] = useState(false);
  const [pollingInterval, setPollingInterval] = useState<ReturnType<typeof setInterval> | null>(null);

  // QR Scanner state
  const [showScanner, setShowScanner] = useState(false);
  const [permission, requestPermission] = useCameraPermissions();

  // Rate lock expiry state
  const [showRateExpiry, setShowRateExpiry] = useState(false);

  // Redirect if no payment (must be in useEffect, not during render)
  useEffect(() => {
    if (!currentPayment) {
      router.replace('/');
    }
  }, [currentPayment, router]);

  // Start NFC listening when in Cashu mode (and not showing scanner)
  useEffect(() => {
    if (paymentMethod === 'cashu' && !isListening && !showScanner) {
      startNFCListening();
    } else if (paymentMethod !== 'cashu' || showScanner) {
      // Stop NFC if switching away or showing scanner
      nfcService.cancelReading().catch(() => { });
      setIsListening(false);
    }

    return () => {
      nfcService.cancelReading().catch(() => { });
    };
  }, [paymentMethod, showScanner]);

  // Handle Lightning Invoice Generation
  useEffect(() => {
    if (paymentMethod === 'lightning' && currentPayment && !lightningInvoice && !isGeneratingInvoice) {
      generateInvoice();
    }

    // Cleanup polling on unmount or method change
    return () => {
      if (pollingInterval) {
        clearInterval(pollingInterval);
        setPollingInterval(null);
      }
    };
  }, [paymentMethod, currentPayment]);

  // Poll for Lightning payment
  useEffect(() => {
    if (paymentMethod === 'lightning' && lightningInvoice && !lightningInvoice.paid && !pollingInterval) {
      const interval = setInterval(async () => {
        try {
          if (!primaryMintUrl) return;

          const status = await checkMintQuote(primaryMintUrl, lightningInvoice.quote);

          if (status.paid) {
            setLightningPaid();
            clearInterval(interval);
            setPollingInterval(null);
            handleLightningSuccess(lightningInvoice.quote);
          }
        } catch (error) {
          console.error('Error polling invoice:', error);
        }
      }, 3000); // Poll every 3 seconds

      setPollingInterval(interval);
    }
  }, [paymentMethod, lightningInvoice, pollingInterval, primaryMintUrl]);

  const generateInvoice = async () => {
    if (!primaryMintUrl || !currentPayment) {
      console.error('No primary mint configured or no payment');
      return;
    }

    try {
      setIsGeneratingInvoice(true);
      const { quote, request, expiry } = await createMintQuote(primaryMintUrl, currentPayment.satsAmount);

      setLightningInvoice({
        quote,
        bolt11: request,
        expiry,
        paid: false
      });
    } catch (error) {
      console.error('Failed to generate invoice:', error);
      // Optional: Show error to user
    } finally {
      setIsGeneratingInvoice(false);
    }
  };

  const handleLightningSuccess = async (quoteId: string) => {
    try {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      updatePaymentState('processing');

      if (!primaryMintUrl || !currentPayment) return;

      // Mint tokens
      const proofs = await mintTokens(primaryMintUrl, currentPayment.satsAmount, quoteId);

      const txId = `ln_${quoteId.substring(0, 8)}`;

      // Check if this is a sub-terminal that should forward tokens to main
      if (shouldForwardTokens) {
        // Encode the minted tokens for forwarding
        const tokenString = encodeToken(primaryMintUrl, proofs);
        console.log('[Payment] Forwarding Lightning payment to main terminal...');

        const forwardResult = await tokenForwardService.forwardToken({
          token: tokenString,
          transactionId: txId,
          amount: currentPayment.satsAmount,
          fiatAmount: currentPayment.fiatAmount,
          fiatCurrency: currentPayment.fiatCurrency,
          paymentMethod: 'lightning',
          mintUrl: primaryMintUrl,
        });

        if (!forwardResult.success) {
          console.error('[Payment] Token forward failed:', forwardResult.error);
          // Fallback: store locally if forward fails
          addProofs(proofs, primaryMintUrl);
        }
      } else {
        // Main terminal or standalone: store locally
        addProofs(proofs, primaryMintUrl);
      }

      completePayment(txId);

      // Sync transaction to other terminals (for stats/reporting)
      syncTransaction({
        id: txId,
        total: currentPayment.satsAmount,
        items: [],
        paymentMethod: 'lightning',
        fiatAmount: currentPayment.fiatAmount,
        fiatCurrency: currentPayment.fiatCurrency,
        exchangeRate: currentPayment.exchangeRate,
      }).catch(err => console.error('Failed to sync transaction:', err));

      router.replace('/result');
    } catch (error) {
      console.error('Failed to mint tokens after payment:', error);
      failPayment('Payment received but failed to mint tokens. Please contact support.');
    }
  };

  const startNFCListening = async () => {
    try {
      setIsListening(true);
      updatePaymentState('waiting_for_tap');

      // Use continuous reading for terminal mode
      await nfcService.startContinuousReading((result) => {
        if (result.success && result.token) {
          handleTokenReceived(result.token);
        }
      });
    } catch (error) {
      console.error('NFC Error:', error);
      // Continue without NFC - user can still use Lightning or QR scan
    }
  };

  const handleTokenReceived = async (tokenString: string) => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    updatePaymentState('validating');

    try {
      const parsed = parseToken(tokenString);
      if (!parsed) {
        const error = createPaymentError('invalid_token_format');
        failPayment(error);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        return;
      }

      updatePaymentState('processing');

      const mintUrl = parsed.token.mint;
      const txId = `tx_${Date.now()}`;

      // Validate mint if we have a primary mint configured
      if (primaryMintUrl && mintUrl !== primaryMintUrl) {
        const error = createPaymentError(
          'wrong_mint',
          `Expected: ${primaryMintUrl}, Received: ${mintUrl}`,
          { expectedMint: primaryMintUrl, receivedMint: mintUrl }
        );
        failPayment(error);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        return;
      }

      // Check if this is a sub-terminal that should forward tokens to main
      if (shouldForwardTokens && currentPayment) {
        // Forward token to main terminal instead of storing locally
        console.log('[Payment] Forwarding token to main terminal...');

        const forwardResult = await tokenForwardService.forwardToken({
          token: tokenString,
          transactionId: txId,
          amount: currentPayment.satsAmount,
          fiatAmount: currentPayment.fiatAmount,
          fiatCurrency: currentPayment.fiatCurrency,
          paymentMethod: 'cashu_nfc',
          mintUrl,
        });

        if (!forwardResult.success) {
          console.error('[Payment] Token forward failed:', forwardResult.error);
          // Create warning but still complete locally
          const error = createPaymentError('forwarding_failed');
          failPayment(error);
          // Don't return - continue with local completion
        }

        completePayment(txId);

        // Sync transaction to other terminals (for stats/reporting)
        syncTransaction({
          id: txId,
          total: currentPayment.satsAmount,
          items: [],
          paymentMethod: 'cashu_nfc',
          fiatAmount: currentPayment.fiatAmount,
          fiatCurrency: currentPayment.fiatCurrency,
          exchangeRate: currentPayment.exchangeRate,
        }).catch(err => console.error('Failed to sync transaction:', err));

      } else {
        // Main terminal or standalone: swap tokens and store locally
        const { proofs } = await swapTokens(mintUrl, parsed.token.proofs);

        // Add to wallet with mint URL
        addProofs(proofs, mintUrl);

        completePayment(txId);

        // Sync transaction to other terminals
        if (currentPayment) {
          syncTransaction({
            id: txId,
            total: currentPayment.satsAmount,
            items: [],
            paymentMethod: 'cashu_nfc',
            fiatAmount: currentPayment.fiatAmount,
            fiatCurrency: currentPayment.fiatCurrency,
            exchangeRate: currentPayment.exchangeRate,
          }).catch(err => console.error('Failed to sync transaction:', err));
        }
      }

      router.replace('/result');
    } catch (error) {
      console.error("Failed to receive token:", error);

      // Determine specific error type
      let paymentError;
      if (error instanceof Error) {
        if (error.message.includes('Network')) {
          paymentError = createPaymentError('network_timeout', error.message);
        } else if (error.message.includes('swap')) {
          paymentError = createPaymentError('swap_failed', error.message);
        } else {
          paymentError = createPaymentError('unknown_error', error.message);
        }
      } else {
        paymentError = createPaymentError('unknown_error');
      }

      failPayment(paymentError);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  };

  const handleErrorRecovery = (action: PaymentErrorRecovery) => {
    clearPaymentError();

    switch (action) {
      case 'retry':
        // Reset to waiting state and try again
        updatePaymentState('waiting_for_tap');
        startNFCListening();
        break;

      case 'fallback_qr':
      case 'force_qr':
        // Switch to QR scanner
        handleScanQR();
        break;

      case 'restart':
        // Go back to start
        cancelPayment();
        router.back();
        break;

      case 'accept_partial':
        // Continue despite warning (e.g., forwarding failed)
        router.replace('/result');
        break;

      case 'contact_support':
        // Dismiss and go back
        cancelPayment();
        router.back();
        break;

      default:
        // Default: just clear the error
        break;
    }
  };

  const handleScanQR = () => {
    if (!permission?.granted) {
      requestPermission();
      return;
    }
    // Stop NFC when showing scanner
    nfcService.cancelReading().catch(() => { });
    setIsListening(false);
    setShowScanner(true);
  };

  const handleBarCodeScanned = ({ data }: { data: string }) => {
    setShowScanner(false);
    // Clean up the token - handle cashu: prefix if present
    let cleanToken = data.trim();
    if (cleanToken.toLowerCase().startsWith('cashu:')) {
      cleanToken = cleanToken.slice(6);
    }
    // Process the scanned token
    handleTokenReceived(cleanToken);
  };

  const handleCancel = () => {
    nfcService.cancelReading().catch(() => { });
    if (pollingInterval) clearInterval(pollingInterval);
    cancelPayment();
    router.back();
  };

  const handleSimulatePayment = () => {
    // For development/demo purposes
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    updatePaymentState('processing');

    setTimeout(() => {
      const txId = `tx_${Date.now()}`;
      completePayment(txId);

      // Sync transaction to other terminals
      if (currentPayment) {
        syncTransaction({
          id: txId,
          total: currentPayment.satsAmount,
          items: [],
          paymentMethod: 'simulated',
          fiatAmount: currentPayment.fiatAmount,
          fiatCurrency: currentPayment.fiatCurrency,
          exchangeRate: currentPayment.exchangeRate,
        }).catch(err => console.error('Failed to sync transaction:', err));
      }

      router.replace('/result');
    }, 1000);
  };

  const handleRateExpired = () => {
    // Stop payment methods
    nfcService.cancelReading().catch(() => {});
    if (pollingInterval) clearInterval(pollingInterval);

    // Show expiry overlay
    setShowRateExpiry(true);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
  };

  const handleGetNewRate = () => {
    // Return to previous screen to get new rate
    setShowRateExpiry(false);
    cancelPayment();
    router.back();
  };

  // Show nothing while redirecting
  if (!currentPayment) {
    return null;
  }

  const { satsAmount, fiatAmount, fiatCurrency } = currentPayment;

  // QR Scanner View
  if (showScanner) {
    return (
      <Screen style={styles.scannerScreen}>
        <View style={styles.scannerHeader}>
          <Button
            title="Cancel"
            onPress={() => setShowScanner(false)}
            variant="ghost"
            size="sm"
          />
          <Text style={styles.scannerTitle}>Scan Cashu Token</Text>
          <View style={{ width: 60 }} />
        </View>

        <View style={styles.scannerAmountBadge}>
          <Text style={styles.scannerAmountText}>
            {currency.satsDisplayFormat === 'btc'
              ? `₿${satsAmount.toLocaleString()}`
              : `${satsAmount.toLocaleString()} sats`}
          </Text>
        </View>

        <View style={styles.cameraContainer}>
          <CameraView
            style={styles.camera}
            facing="back"
            barcodeScannerSettings={{
              barcodeTypes: ['qr'],
            }}
            onBarcodeScanned={handleBarCodeScanned}
          />
          <View style={styles.scanOverlay}>
            <View style={styles.scanFrame} />
          </View>
        </View>

        <Text style={styles.scanHint}>
          Scan the customer's Cashu token QR code
        </Text>
      </Screen>
    );
  }

  return (
    <Screen style={styles.screen}>
      {/* Header with Cancel and Rate Lock */}
      <View style={styles.header}>
        <Pressable onPress={handleCancel} style={styles.cancelButton}>
          <Text style={styles.cancelText}>Cancel</Text>
        </Pressable>
        {/* Rate Lock Badge - Top Right */}
        {currentPayment.lockedRate && (
          <RateLockBadge
            lockedRate={currentPayment.lockedRate}
            onExpired={handleRateExpired}
          />
        )}
      </View>

      {/* Hero Amount Display */}
      <View style={styles.amountSection}>
        <PriceDisplay
          fiatAmount={fiatAmount}
          satsAmount={satsAmount}
          currencySymbol={getCurrencySymbol(fiatCurrency)}
          large
        />
      </View>

      {/* Payment Area */}
      <View style={styles.paymentArea}>
        {paymentMethod === 'cashu' ? (
          <View style={styles.nfcContainer}>
            <PaymentStateIndicator state={currentPayment.state} />

            {/* QR Scan Option */}
            <View style={styles.orDivider}>
              <View style={styles.dividerLine} />
              <Text style={styles.orText}>or</Text>
              <View style={styles.dividerLine} />
            </View>

            <Button
              title="Scan QR Code"
              onPress={handleScanQR}
              variant="secondary"
              size="md"
            />
            <Text style={styles.qrHintText}>
              Scan customer's Cashu token QR
            </Text>
          </View>
        ) : (
          <View style={styles.lightningContainer}>
            {isGeneratingInvoice ? (
              <View style={styles.qrPlaceholder}>
                <ActivityIndicator size="large" color={colors.accent.primary} />
                <Text style={styles.qrSubtext}>Generating Invoice...</Text>
              </View>
            ) : lightningInvoice ? (
              <View style={styles.qrContainer}>
                <View style={styles.qrWrapper}>
                  <QRCode
                    value={lightningInvoice.bolt11}
                    size={200}
                    color="black"
                    backgroundColor="white"
                  />
                </View>
                <Text style={styles.instructionText}>
                  Scan with Lightning wallet to pay
                </Text>
                {lightningInvoice.paid && (
                  <View style={styles.paidOverlay}>
                    <Text style={styles.paidText}>PAID!</Text>
                  </View>
                )}
              </View>
            ) : (
              <View style={styles.qrPlaceholder}>
                <Text style={styles.qrPlaceholderText}>No Invoice</Text>
                <Button title="Retry" onPress={generateInvoice} size="sm" />
              </View>
            )}
          </View>
        )}
      </View>

      {/* Payment Method Selector - Bottom */}
      <View style={styles.methodSelector}>
        <View style={styles.methodPills}>
          <Pressable
            style={[
              styles.methodPill,
              paymentMethod === 'cashu' && styles.methodPillActive,
            ]}
            onPress={() => setPaymentMethod('cashu')}
          >
            <Text
              style={[
                styles.methodPillText,
                paymentMethod === 'cashu' && styles.methodPillTextActive,
              ]}
            >
              Cashu
            </Text>
          </Pressable>

          <Pressable
            style={[
              styles.methodPill,
              paymentMethod === 'lightning' && styles.methodPillActive,
            ]}
            onPress={() => setPaymentMethod('lightning')}
          >
            <Text
              style={[
                styles.methodPillText,
                paymentMethod === 'lightning' && styles.methodPillTextActive,
              ]}
            >
              Lightning
            </Text>
          </Pressable>
        </View>

        {/* Dev: Simulate Payment Button */}
        <Button
          title="Simulate Payment (Dev)"
          onPress={handleSimulatePayment}
          variant="ghost"
          size="sm"
          fullWidth
        />
      </View>

      {/* Error Modal */}
      <PaymentErrorModal
        error={errorDetails}
        visible={!!errorDetails}
        onRecoveryAction={handleErrorRecovery}
        onDismiss={clearPaymentError}
      />

      {/* Rate Expiry Overlay */}
      <RateExpiryOverlay
        visible={showRateExpiry}
        onGetNewRate={handleGetNewRate}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    padding: spacing.lg,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  cancelButton: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  cancelText: {
    ...typography.body,
    color: colors.text.secondary,
    fontSize: 16,
  },
  amountSection: {
    alignItems: 'center',
    paddingVertical: spacing.lg,
    marginBottom: spacing.md,
  },
  paymentArea: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: spacing.xl,
  },
  nfcContainer: {
    alignItems: 'center',
    width: '100%',
  },
  instructionText: {
    ...typography.body,
    color: colors.text.secondary,
    textAlign: 'center',
    marginTop: spacing.md,
  },
  methodSelector: {
    paddingTop: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border.default,
  },
  methodPills: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  methodPill: {
    flex: 1,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: borderRadius.round,
    backgroundColor: colors.background.secondary,
    borderWidth: 2,
    borderColor: 'transparent',
    alignItems: 'center',
  },
  methodPillActive: {
    backgroundColor: colors.accent.primary,
    borderColor: colors.accent.primary,
  },
  methodPillText: {
    ...typography.button,
    color: colors.text.muted,
    fontSize: 16,
    fontWeight: '600',
  },
  methodPillTextActive: {
    color: colors.text.inverse,
  },
  orDivider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: spacing.xl,
    width: '100%',
    paddingHorizontal: spacing.xl,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.border.default,
  },
  orText: {
    ...typography.bodySmall,
    color: colors.text.muted,
    paddingHorizontal: spacing.md,
  },
  qrHintText: {
    ...typography.caption,
    color: colors.text.muted,
    marginTop: spacing.sm,
  },
  lightningContainer: {
    alignItems: 'center',
  },
  qrContainer: {
    alignItems: 'center',
  },
  qrWrapper: {
    padding: spacing.md,
    backgroundColor: 'white',
    borderRadius: borderRadius.lg,
    marginBottom: spacing.md,
  },
  qrPlaceholder: {
    width: 200,
    height: 200,
    backgroundColor: colors.background.secondary,
    borderRadius: borderRadius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xxl,
  },
  qrPlaceholderText: {
    ...typography.h4,
    color: colors.text.muted,
  },
  qrSubtext: {
    ...typography.bodySmall,
    color: colors.text.muted,
    marginTop: spacing.sm,
  },
  paidOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: borderRadius.lg,
  },
  paidText: {
    ...typography.h2,
    color: colors.accent.success,
    fontWeight: 'bold',
  },
  // Scanner styles
  scannerScreen: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  scannerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.md,
    paddingTop: spacing.lg,
  },
  scannerTitle: {
    ...typography.h4,
    color: colors.text.primary,
  },
  scannerAmountBadge: {
    backgroundColor: colors.accent.primary,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: borderRadius.round,
    alignSelf: 'center',
    marginBottom: spacing.md,
  },
  scannerAmountText: {
    ...typography.button,
    color: colors.text.inverse,
  },
  cameraContainer: {
    flex: 1,
    margin: spacing.md,
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
    position: 'relative',
  },
  camera: {
    flex: 1,
  },
  scanOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scanFrame: {
    width: 250,
    height: 250,
    borderWidth: 2,
    borderColor: colors.accent.primary,
    borderRadius: borderRadius.lg,
    backgroundColor: 'transparent',
  },
  scanHint: {
    ...typography.body,
    color: colors.text.secondary,
    textAlign: 'center',
    padding: spacing.lg,
  },
});

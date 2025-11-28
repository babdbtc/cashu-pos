import { useState, useMemo } from 'react';
import { View, Text, StyleSheet, TextInput, ActivityIndicator, Pressable, Platform, ScrollView } from 'react-native';
import { useAlert } from '@/hooks/useAlert';
import { useRouter } from 'expo-router';
import { CameraView, useCameraPermissions } from 'expo-camera';
import QRCode from 'react-native-qrcode-svg';
import { Screen } from '@/components/layout';
import { Button } from '@/components/ui';
import { colors, spacing, typography, borderRadius } from '@/theme';
import { useWalletStore, isTestnetMint, getMintDisplayName, normalizeMintUrl, type MintBalance } from '@/store/wallet.store';
import { useConfigStore } from '@/store/config.store';
import { createMeltQuote, meltTokens, splitTokens, encodeToken } from '@/services/cashu.service';
import type { Proof } from '@/types/mint';

type WithdrawMode = 'lightning' | 'cashu';

export default function WithdrawScreen() {
    const router = useRouter();
    const { alert, success, error: showError } = useAlert();
    const { balance, proofs, removeProofs, addProofs, getBalancesByMint, getProofsForMint } = useWalletStore();
    const { mints } = useConfigStore();
    const primaryMintUrl = mints.primaryMintUrl;

    // Get available mint balances
    const mintBalances = useMemo(() => getBalancesByMint(), [proofs]);
    const [selectedMintUrl, setSelectedMintUrl] = useState<string | null>(null);

    // Get the effective mint and balance for operations
    const effectiveMint = selectedMintUrl || (mintBalances.length > 0 ? mintBalances[0].mintUrl : primaryMintUrl);
    const selectedMintBalance = mintBalances.find(m => m.mintUrl === effectiveMint);
    const availableBalance = selectedMintBalance?.balance || 0;
    const selectedProofs = effectiveMint ? getProofsForMint(effectiveMint) : proofs;

    const [mode, setMode] = useState<WithdrawMode>('lightning');
    const [invoice, setInvoice] = useState('');
    const [cashuAmount, setCashuAmount] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [status, setStatus] = useState('');
    const [showScanner, setShowScanner] = useState(false);
    const [permission, requestPermission] = useCameraPermissions();

    // Cashu token QR display state
    const [generatedToken, setGeneratedToken] = useState<string | null>(null);
    const [tokenAmount, setTokenAmount] = useState(0);

    const handleScan = () => {
        if (!permission?.granted) {
            requestPermission();
            return;
        }
        setShowScanner(true);
    };

    const handleBarCodeScanned = ({ data }: { data: string }) => {
        setShowScanner(false);
        // Clean up the invoice - remove lightning: prefix if present
        let cleanInvoice = data.trim();
        if (cleanInvoice.toLowerCase().startsWith('lightning:')) {
            cleanInvoice = cleanInvoice.slice(10);
        }
        setInvoice(cleanInvoice);
    };

    const handleWithdraw = async () => {
        if (!invoice) {
            showError('Error', 'Please enter a Lightning invoice');
            return;
        }
        if (!effectiveMint) {
            showError('Error', 'No mint selected');
            return;
        }
        if (availableBalance === 0) {
            showError('Error', 'No balance available from selected mint');
            return;
        }

        try {
            setIsLoading(true);
            setStatus('Getting quote...');

            // 1. Get Melt Quote from the selected mint
            const quote = await createMeltQuote(effectiveMint, invoice);

            if (quote.amount + quote.fee > availableBalance) {
                showError('Error', `Insufficient balance. Need ${quote.amount + quote.fee} sats (${quote.amount} + ${quote.fee} fee). Available: ${availableBalance} sats.`);
                setIsLoading(false);
                return;
            }

            setStatus(`Paying ${quote.amount} sats + ${quote.fee} fee...`);

            // 2. Melt tokens (pay invoice) using proofs from selected mint
            const result = await meltTokens(effectiveMint, quote.quote, selectedProofs);

            if (result.paid) {
                // Remove spent proofs
                removeProofs(selectedProofs);

                // Add change proofs if any (tagged with the mint URL)
                if (result.change && result.change.length > 0) {
                    addProofs(result.change, effectiveMint);
                }

                success('Success', 'Payment successful!', () => router.back());
            } else {
                showError('Error', 'Payment failed.');
            }

        } catch (error) {
            console.error(error);
            showError('Error', 'Withdrawal failed: ' + (error instanceof Error ? error.message : 'Unknown error'));
        } finally {
            setIsLoading(false);
            setStatus('');
        }
    };

    // Select proofs for the requested amount
    const selectProofsForAmount = (
        availableProofs: Proof[],
        targetAmount: number
    ): { selected: Proof[]; total: number } | null => {
        const sorted = [...availableProofs].sort((a, b) => a.amount - b.amount);
        const selected: Proof[] = [];
        let total = 0;

        for (const proof of sorted) {
            if (total >= targetAmount) break;
            selected.push(proof);
            total += proof.amount;
        }

        if (total < targetAmount) {
            return null;
        }

        return { selected, total };
    };

    const handleGenerateCashuToken = async () => {
        const amount = parseInt(cashuAmount);
        if (isNaN(amount) || amount <= 0) {
            showError('Error', 'Please enter a valid amount');
            return;
        }
        if (amount > availableBalance) {
            showError('Error', `Insufficient balance. Available: ${availableBalance} sats`);
            return;
        }
        if (!effectiveMint) {
            showError('Error', 'No mint selected');
            return;
        }

        try {
            setIsLoading(true);
            setStatus('Generating Cashu token...');

            // Select proofs for the amount from the selected mint's proofs
            const selection = selectProofsForAmount(selectedProofs, amount);
            if (!selection) {
                showError('Error', 'Could not select proofs for this amount');
                setIsLoading(false);
                return;
            }

            let tokenProofs: Proof[];
            let changeProofs: Proof[];

            if (selection.total === amount) {
                // Exact match
                tokenProofs = selection.selected;
                changeProofs = [];
            } else {
                // Need to split using the correct mint
                setStatus('Splitting tokens...');
                const result = await splitTokens(
                    effectiveMint,
                    selection.selected,
                    selection.total - amount // keepAmount = change
                );
                tokenProofs = result.send;
                changeProofs = result.keep;
            }

            // Encode the token with the CORRECT mint URL (normalized - no trailing slash)
            const normalizedMint = normalizeMintUrl(effectiveMint);
            const token = encodeToken(normalizedMint, tokenProofs, `Withdraw ${amount} sats`);

            // Update wallet - remove used proofs, add change with correct mint tag
            removeProofs(selection.selected);
            if (changeProofs.length > 0) {
                addProofs(changeProofs, effectiveMint);
            }

            // Display the QR code
            setGeneratedToken(token);
            setTokenAmount(amount);

        } catch (error) {
            console.error(error);
            showError('Error', 'Failed to generate token: ' + (error instanceof Error ? error.message : 'Unknown error'));
        } finally {
            setIsLoading(false);
            setStatus('');
        }
    };

    const handleResetToken = () => {
        setGeneratedToken(null);
        setTokenAmount(0);
        setCashuAmount('');
    };

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
                    <Text style={styles.scannerTitle}>Scan Lightning Invoice</Text>
                    <View style={{ width: 60 }} />
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
                    Position the QR code within the frame
                </Text>
            </Screen>
        );
    }

    // Generated Token QR Display
    if (generatedToken) {
        return (
            <Screen style={styles.screen}>
                <View style={styles.header}>
                    <Button
                        title="Back"
                        onPress={handleResetToken}
                        variant="ghost"
                        size="sm"
                        style={{ alignSelf: 'flex-start', marginBottom: spacing.md }}
                    />
                    <Text style={styles.title}>Cashu Token Generated</Text>
                </View>

                <View style={styles.tokenContainer}>
                    <View style={styles.qrWrapper}>
                        <QRCode value={generatedToken} size={220} />
                    </View>

                    <Text style={styles.tokenAmountText}>{tokenAmount.toLocaleString()} sats</Text>
                    <Text style={styles.tokenHint}>
                        Scan this QR code with a Cashu wallet to claim the tokens
                    </Text>

                    <View style={styles.tokenActions}>
                        <Button
                            title="Generate Another"
                            onPress={handleResetToken}
                            variant="secondary"
                            fullWidth
                        />
                        <Button
                            title="Done"
                            onPress={() => router.back()}
                            fullWidth
                            style={{ marginTop: spacing.sm }}
                        />
                    </View>
                </View>
            </Screen>
        );
    }

    return (
        <Screen style={styles.screen}>
            <View style={styles.header}>
                <Button
                    title="Back"
                    onPress={() => router.back()}
                    variant="ghost"
                    size="sm"
                    style={{ alignSelf: 'flex-start', marginBottom: spacing.md }}
                />
                <Text style={styles.title}>Withdraw Funds</Text>
            </View>

            {/* Mode Selector */}
            <View style={styles.modeSelector}>
                <Pressable
                    style={[styles.modeOption, mode === 'lightning' && styles.modeOptionActive]}
                    onPress={() => setMode('lightning')}
                >
                    <Text style={[styles.modeOptionText, mode === 'lightning' && styles.modeOptionTextActive]}>
                        Lightning Invoice
                    </Text>
                </Pressable>
                <Pressable
                    style={[styles.modeOption, mode === 'cashu' && styles.modeOptionActive]}
                    onPress={() => setMode('cashu')}
                >
                    <Text style={[styles.modeOptionText, mode === 'cashu' && styles.modeOptionTextActive]}>
                        Cashu Token
                    </Text>
                </Pressable>
            </View>

            {/* Mint Selector - show when multiple mints have balance */}
            {mintBalances.length > 1 && (
                <View style={styles.mintSelector}>
                    <Text style={styles.mintSelectorLabel}>Withdraw from:</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.mintList}>
                        {mintBalances.map((mint) => (
                            <Pressable
                                key={mint.mintUrl}
                                style={[
                                    styles.mintOption,
                                    effectiveMint === mint.mintUrl && styles.mintOptionSelected,
                                    mint.isTestnet && styles.mintOptionTestnet,
                                ]}
                                onPress={() => setSelectedMintUrl(mint.mintUrl)}
                            >
                                <Text style={[
                                    styles.mintOptionName,
                                    effectiveMint === mint.mintUrl && styles.mintOptionNameSelected,
                                ]}>
                                    {mint.displayName}
                                </Text>
                                <Text style={[
                                    styles.mintOptionBalance,
                                    effectiveMint === mint.mintUrl && styles.mintOptionBalanceSelected,
                                ]}>
                                    {mint.balance.toLocaleString()} sats
                                </Text>
                                {mint.isTestnet && (
                                    <View style={styles.testnetBadge}>
                                        <Text style={styles.testnetBadgeText}>TEST</Text>
                                    </View>
                                )}
                            </Pressable>
                        ))}
                    </ScrollView>
                </View>
            )}

            <View style={styles.content}>
                {mode === 'lightning' ? (
                    <>
                        <View style={styles.labelRow}>
                            <Text style={styles.label}>Lightning Invoice</Text>
                            <Pressable onPress={handleScan} style={styles.scanButton}>
                                <Text style={styles.scanButtonText}>Scan QR</Text>
                            </Pressable>
                        </View>

                        <TextInput
                            style={styles.input}
                            value={invoice}
                            onChangeText={setInvoice}
                            placeholder="lnbc... or scan QR code"
                            placeholderTextColor={colors.text.muted}
                            multiline
                            numberOfLines={4}
                        />

                        <Text style={styles.balanceInfo}>
                            Available Balance: {availableBalance.toLocaleString()} sats
                            {selectedMintBalance?.isTestnet && ' (Testnet)'}
                        </Text>

                        {isLoading ? (
                            <View style={styles.loading}>
                                <ActivityIndicator color={colors.accent.primary} />
                                <Text style={styles.statusText}>{status}</Text>
                            </View>
                        ) : (
                            <Button
                                title="Pay Invoice"
                                onPress={handleWithdraw}
                                fullWidth
                                disabled={!invoice || availableBalance === 0}
                            />
                        )}
                    </>
                ) : (
                    <>
                        <Text style={styles.label}>Amount (sats)</Text>
                        <TextInput
                            style={styles.amountInput}
                            value={cashuAmount}
                            onChangeText={setCashuAmount}
                            placeholder="Enter amount"
                            placeholderTextColor={colors.text.muted}
                            keyboardType="number-pad"
                        />

                        <Text style={styles.balanceInfo}>
                            Available Balance: {availableBalance.toLocaleString()} sats
                            {selectedMintBalance?.isTestnet && ' (Testnet)'}
                        </Text>

                        <Text style={styles.cashuHint}>
                            Generate a Cashu token QR code that can be scanned by any Cashu-compatible wallet
                        </Text>

                        {isLoading ? (
                            <View style={styles.loading}>
                                <ActivityIndicator color={colors.accent.primary} />
                                <Text style={styles.statusText}>{status}</Text>
                            </View>
                        ) : (
                            <Button
                                title="Generate Token QR"
                                onPress={handleGenerateCashuToken}
                                fullWidth
                                disabled={!cashuAmount || availableBalance === 0}
                            />
                        )}
                    </>
                )}

                {availableBalance === 0 && (
                    <Text style={styles.noBalanceText}>
                        No balance available to withdraw
                    </Text>
                )}
            </View>
        </Screen>
    );
}

const styles = StyleSheet.create({
    screen: {
        flex: 1,
        padding: spacing.md,
    },
    header: {
        marginBottom: spacing.lg,
    },
    title: {
        ...typography.h2,
        color: colors.text.primary,
    },
    content: {
        flex: 1,
    },

    // Mode selector
    modeSelector: {
        flexDirection: 'row',
        backgroundColor: colors.background.secondary,
        borderRadius: borderRadius.md,
        padding: spacing.xs,
        marginBottom: spacing.lg,
    },
    modeOption: {
        flex: 1,
        paddingVertical: spacing.sm,
        paddingHorizontal: spacing.md,
        borderRadius: borderRadius.sm,
        alignItems: 'center',
    },
    modeOptionActive: {
        backgroundColor: colors.accent.primary,
    },
    modeOptionText: {
        ...typography.body,
        color: colors.text.secondary,
        fontWeight: '500',
    },
    modeOptionTextActive: {
        color: colors.text.inverse,
        fontWeight: '600',
    },

    // Mint selector
    mintSelector: {
        marginBottom: spacing.md,
    },
    mintSelectorLabel: {
        ...typography.label,
        marginBottom: spacing.sm,
    },
    mintList: {
        flexDirection: 'row',
    },
    mintOption: {
        backgroundColor: colors.background.secondary,
        borderRadius: borderRadius.md,
        padding: spacing.sm,
        marginRight: spacing.sm,
        minWidth: 120,
        borderWidth: 2,
        borderColor: 'transparent',
    },
    mintOptionSelected: {
        borderColor: colors.accent.primary,
        backgroundColor: colors.background.tertiary,
    },
    mintOptionTestnet: {
        position: 'relative',
    },
    mintOptionName: {
        ...typography.bodySmall,
        color: colors.text.secondary,
        marginBottom: 2,
    },
    mintOptionNameSelected: {
        color: colors.text.primary,
        fontWeight: '600',
    },
    mintOptionBalance: {
        ...typography.body,
        color: colors.text.primary,
        fontWeight: '600',
    },
    mintOptionBalanceSelected: {
        color: colors.accent.primary,
    },
    testnetBadge: {
        position: 'absolute',
        top: 4,
        right: 4,
        backgroundColor: colors.status.warning,
        paddingHorizontal: 4,
        paddingVertical: 1,
        borderRadius: 4,
    },
    testnetBadgeText: {
        fontSize: 8,
        fontWeight: '700',
        color: colors.text.inverse,
    },

    // Form elements
    labelRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: spacing.sm,
    },
    label: {
        ...typography.label,
    },
    scanButton: {
        backgroundColor: colors.accent.primary,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.xs,
        borderRadius: borderRadius.sm,
    },
    scanButtonText: {
        ...typography.buttonSmall,
        color: colors.text.inverse,
    },
    input: {
        backgroundColor: colors.background.secondary,
        color: colors.text.primary,
        padding: spacing.md,
        borderRadius: borderRadius.md,
        height: 120,
        textAlignVertical: 'top',
        marginBottom: spacing.md,
        fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
        fontSize: 12,
    },
    amountInput: {
        backgroundColor: colors.background.secondary,
        color: colors.text.primary,
        padding: spacing.md,
        borderRadius: borderRadius.md,
        marginBottom: spacing.md,
        fontSize: 24,
        fontWeight: '700',
        textAlign: 'center',
    },
    balanceInfo: {
        ...typography.body,
        color: colors.text.secondary,
        marginBottom: spacing.lg,
    },
    cashuHint: {
        ...typography.bodySmall,
        color: colors.text.muted,
        marginBottom: spacing.xl,
        textAlign: 'center',
    },
    loading: {
        alignItems: 'center',
        gap: spacing.sm,
    },
    statusText: {
        color: colors.text.secondary,
    },
    noBalanceText: {
        ...typography.bodySmall,
        color: colors.status.error,
        textAlign: 'center',
        marginTop: spacing.md,
    },

    // Token display
    tokenContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    qrWrapper: {
        padding: spacing.md,
        backgroundColor: 'white',
        borderRadius: borderRadius.lg,
        marginBottom: spacing.lg,
    },
    tokenAmountText: {
        ...typography.h1,
        color: colors.accent.primary,
        marginBottom: spacing.sm,
    },
    tokenHint: {
        ...typography.body,
        color: colors.text.secondary,
        textAlign: 'center',
        marginBottom: spacing.xl,
        paddingHorizontal: spacing.lg,
    },
    tokenActions: {
        width: '100%',
        paddingHorizontal: spacing.lg,
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

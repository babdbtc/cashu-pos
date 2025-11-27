import { useState } from 'react';
import { View, Text, StyleSheet, TextInput, Alert, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { Screen } from '@/components/layout';
import { Button } from '@/components/ui';
import { colors, spacing, typography, borderRadius } from '@/theme';
import { useWalletStore } from '@/store/wallet.store';
import { useConfigStore } from '@/store/config.store';
import { createMeltQuote, meltTokens } from '@/services/cashu.service';

export default function WithdrawScreen() {
    const router = useRouter();
    const { balance, proofs, removeProofs, addProofs } = useWalletStore();
    const { mints } = useConfigStore();
    const primaryMintUrl = mints.primaryMintUrl;

    const [invoice, setInvoice] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [status, setStatus] = useState('');

    const handleWithdraw = async () => {
        if (!invoice) {
            Alert.alert('Error', 'Please enter a Lightning invoice');
            return;
        }
        if (!primaryMintUrl) {
            Alert.alert('Error', 'No primary mint configured');
            return;
        }

        try {
            setIsLoading(true);
            setStatus('Getting quote...');

            // 1. Get Melt Quote
            const quote = await createMeltQuote(primaryMintUrl, invoice);

            if (quote.amount + quote.fee > balance) {
                Alert.alert('Error', `Insufficient balance. Need ${quote.amount + quote.fee} sats.`);
                setIsLoading(false);
                return;
            }

            setStatus('Paying invoice...');

            // 2. Melt tokens (pay invoice)
            // We send all proofs for simplicity. The mint will return change.
            const result = await meltTokens(primaryMintUrl, quote.quote, proofs);

            if (result.paid) {
                // Remove spent proofs (all of them since we sent all)
                removeProofs(proofs);

                // Add change proofs if any
                if (result.change && result.change.length > 0) {
                    addProofs(result.change);
                }

                Alert.alert('Success', 'Payment successful!');
                router.back();
            } else {
                Alert.alert('Error', 'Payment failed.');
            }

        } catch (error) {
            console.error(error);
            Alert.alert('Error', 'Withdrawal failed: ' + (error instanceof Error ? error.message : 'Unknown error'));
        } finally {
            setIsLoading(false);
            setStatus('');
        }
    };

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

            <View style={styles.content}>
                <Text style={styles.label}>Lightning Invoice</Text>
                <TextInput
                    style={styles.input}
                    value={invoice}
                    onChangeText={setInvoice}
                    placeholder="lnbc..."
                    placeholderTextColor={colors.text.muted}
                    multiline
                    numberOfLines={4}
                />

                <Text style={styles.balanceInfo}>
                    Available Balance: {balance.toLocaleString()} sats
                </Text>

                {isLoading ? (
                    <View style={styles.loading}>
                        <ActivityIndicator color={colors.accent.primary} />
                        <Text style={styles.statusText}>{status}</Text>
                    </View>
                ) : (
                    <Button title="Pay Invoice" onPress={handleWithdraw} fullWidth />
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
    label: {
        ...typography.label,
        marginBottom: spacing.sm,
    },
    input: {
        backgroundColor: colors.background.secondary,
        color: colors.text.primary,
        padding: spacing.md,
        borderRadius: borderRadius.md,
        height: 120,
        textAlignVertical: 'top',
        marginBottom: spacing.md,
    },
    balanceInfo: {
        ...typography.body,
        color: colors.text.secondary,
        marginBottom: spacing.xl,
    },
    loading: {
        alignItems: 'center',
        gap: spacing.sm,
    },
    statusText: {
        color: colors.text.secondary,
    },
});

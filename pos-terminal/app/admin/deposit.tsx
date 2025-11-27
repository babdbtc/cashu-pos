import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, Alert, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import QRCode from 'react-native-qrcode-svg';
import { Screen } from '@/components/layout';
import { Button } from '@/components/ui';
import { colors, spacing, typography, borderRadius } from '@/theme';
import { useWalletStore } from '@/store/wallet.store';
import { useConfigStore } from '@/store/config.store';
import { createMintQuote, checkMintQuote, mintTokens } from '@/services/cashu.service';

export default function DepositScreen() {
    const router = useRouter();
    const { addProofs } = useWalletStore();
    const { mints } = useConfigStore();
    const primaryMintUrl = mints.primaryMintUrl;

    const [amount, setAmount] = useState('');
    const [invoice, setInvoice] = useState<{ quote: string, bolt11: string } | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [status, setStatus] = useState('');

    // Polling
    useEffect(() => {
        let interval: ReturnType<typeof setInterval>;
        if (invoice && primaryMintUrl) {
            interval = setInterval(async () => {
                try {
                    const check = await checkMintQuote(primaryMintUrl, invoice.quote);
                    if (check.paid) {
                        clearInterval(interval);
                        setStatus('Minting tokens...');
                        const proofs = await mintTokens(primaryMintUrl, parseInt(amount), invoice.quote);
                        addProofs(proofs, primaryMintUrl);
                        Alert.alert('Success', 'Deposit successful!');
                        router.back();
                    }
                } catch (e) {
                    console.error(e);
                }
            }, 3000);
        }
        return () => clearInterval(interval);
    }, [invoice, primaryMintUrl, amount]);

    const handleGenerate = async () => {
        const sats = parseInt(amount);
        if (isNaN(sats) || sats <= 0) {
            Alert.alert('Error', 'Invalid amount');
            return;
        }
        if (!primaryMintUrl) {
            Alert.alert('Error', 'No primary mint configured');
            return;
        }

        try {
            setIsLoading(true);
            setStatus('Generating invoice...');
            const { quote, request } = await createMintQuote(primaryMintUrl, sats);
            setInvoice({ quote, bolt11: request });
        } catch (error) {
            Alert.alert('Error', 'Failed to generate invoice');
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
                <Text style={styles.title}>Deposit Funds</Text>
            </View>

            <View style={styles.content}>
                {!invoice ? (
                    <>
                        <Text style={styles.label}>Amount (sats)</Text>
                        <TextInput
                            style={styles.input}
                            value={amount}
                            onChangeText={setAmount}
                            keyboardType="number-pad"
                            placeholder="1000"
                            placeholderTextColor={colors.text.muted}
                        />
                        {isLoading ? (
                            <ActivityIndicator color={colors.accent.primary} />
                        ) : (
                            <Button title="Generate Invoice" onPress={handleGenerate} fullWidth />
                        )}
                    </>
                ) : (
                    <View style={styles.qrContainer}>
                        <View style={styles.qrWrapper}>
                            <QRCode value={invoice.bolt11} size={220} />
                        </View>
                        <Text style={styles.instruction}>Scan to pay {amount} sats</Text>
                        <Text style={styles.status}>{status || 'Waiting for payment...'}</Text>
                        <Button title="Cancel" onPress={() => setInvoice(null)} variant="secondary" style={{ marginTop: spacing.lg }} />
                    </View>
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
        fontSize: 18,
        marginBottom: spacing.lg,
    },
    qrContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        flex: 1,
    },
    qrWrapper: {
        padding: spacing.md,
        backgroundColor: 'white',
        borderRadius: borderRadius.lg,
        marginBottom: spacing.lg,
    },
    instruction: {
        ...typography.h3,
        marginBottom: spacing.sm,
    },
    status: {
        ...typography.body,
        color: colors.text.secondary,
    },
});

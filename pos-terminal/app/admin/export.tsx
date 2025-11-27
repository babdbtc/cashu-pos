import { useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { Screen } from '@/components/layout';
import { Button } from '@/components/ui';
import { colors, spacing, typography, borderRadius } from '@/theme';
import { usePaymentStore } from '@/store/payment.store';
import { useToast } from '@/hooks/useToast';

export default function ExportScreen() {
    const router = useRouter();
    const { recentPayments } = usePaymentStore();
    const { showSuccess, showError, showInfo } = useToast();
    const [isExporting, setIsExporting] = useState(false);

    const handleExport = async (format: 'csv' | 'json') => {
        try {
            setIsExporting(true);

            if (recentPayments.length === 0) {
                showInfo('No transactions to export');
                return;
            }

            let content = '';
            let filename = `transactions_${Date.now()}`;

            if (format === 'json') {
                content = JSON.stringify(recentPayments, null, 2);
                filename += '.json';
            } else {
                // CSV Header
                const headers = ['ID', 'Date', 'Type', 'Status', 'Sats', 'Fiat', 'Currency', 'Method'];
                content = headers.join(',') + '\n';

                // CSV Rows
                recentPayments.forEach(p => {
                    const row = [
                        p.id,
                        new Date(p.createdAt).toISOString(),
                        'Payment', // Type
                        p.state,
                        p.satsAmount,
                        p.fiatAmount,
                        p.fiatCurrency,
                        p.paymentMethod || 'cashu'
                    ];
                    content += row.join(',') + '\n';
                });
                filename += '.csv';
            }

            const filePath = `${FileSystem.documentDirectory}${filename}`;
            await FileSystem.writeAsStringAsync(filePath, content);

            if (await Sharing.isAvailableAsync()) {
                await Sharing.shareAsync(filePath);
                showSuccess(`Exported ${recentPayments.length} transactions as ${format.toUpperCase()}`);
            } else {
                showError('Sharing is not available on this device');
            }

        } catch (error) {
            console.error(error);
            showError('Export failed. Please try again.');
        } finally {
            setIsExporting(false);
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
                <Text style={styles.title}>Export Transactions</Text>
            </View>

            <View style={styles.content}>
                <Text style={styles.infoText}>
                    Export your transaction history for accounting or backup purposes.
                    Currently available: {recentPayments.length} transactions.
                </Text>

                {isExporting ? (
                    <ActivityIndicator size="large" color={colors.accent.primary} />
                ) : (
                    <View style={styles.buttonGroup}>
                        <Button
                            title="Export as CSV"
                            onPress={() => handleExport('csv')}
                            style={styles.button}
                        />
                        <Button
                            title="Export as JSON"
                            onPress={() => handleExport('json')}
                            variant="secondary"
                            style={styles.button}
                        />
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
        justifyContent: 'center',
    },
    infoText: {
        ...typography.body,
        color: colors.text.secondary,
        textAlign: 'center',
        marginBottom: spacing.xl,
    },
    buttonGroup: {
        gap: spacing.md,
    },
    button: {
        width: '100%',
    },
});

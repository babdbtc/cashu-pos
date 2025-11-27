import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { Screen } from '@/components/layout';
import { Button } from '@/components/ui';
import { colors, spacing, typography, borderRadius } from '@/theme';
import { useWalletStore } from '@/store/wallet.store';
import { useConfigStore } from '@/store/config.store';

export default function AdminDashboard() {
    const router = useRouter();
    const { balance, proofs } = useWalletStore();
    const { currency } = useConfigStore();

    return (
        <Screen style={styles.screen}>
            <View style={styles.header}>
                <Pressable onPress={() => router.back()} style={styles.backButton}>
                    <Text style={styles.backText}>Back</Text>
                </Pressable>
                <Text style={styles.title}>Admin Dashboard</Text>
            </View>

            <ScrollView contentContainerStyle={styles.content}>
                {/* Balance Card */}
                <View style={styles.card}>
                    <Text style={styles.cardLabel}>Current Balance</Text>
                    <Text style={styles.balanceAmount}>{balance.toLocaleString()} sats</Text>
                    <Text style={styles.tokenCount}>{proofs.length} tokens</Text>

                    <View style={styles.actionButtons}>
                        <Button
                            title="Withdraw"
                            onPress={() => router.push('/admin/withdraw')}
                            style={styles.actionBtn}
                        />
                        <Button
                            title="Deposit"
                            onPress={() => router.push('/admin/deposit')}
                            variant="secondary"
                            style={styles.actionBtn}
                        />
                    </View>
                </View>

                {/* Quick Actions */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Management</Text>
                    <Pressable style={styles.menuItem} onPress={() => router.push('/settings/settlement')}>
                        <Text style={styles.menuText}>Settlement Settings</Text>
                    </Pressable>
                    <Pressable style={styles.menuItem} onPress={() => router.push('/history')}>
                        <Text style={styles.menuText}>Transaction History</Text>
                    </Pressable>
                    <Pressable style={styles.menuItem} onPress={() => router.push('/admin/export')}>
                        <Text style={styles.menuText}>Export Transactions</Text>
                    </Pressable>
                </View>
            </ScrollView>
        </Screen>
    );
}

const styles = StyleSheet.create({
    screen: {
        flex: 1,
        padding: spacing.md,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: spacing.lg,
        paddingTop: spacing.sm,
    },
    backButton: {
        padding: spacing.sm,
        marginRight: spacing.md,
    },
    backText: {
        color: colors.text.secondary,
        fontSize: 16,
    },
    title: {
        ...typography.h2,
        color: colors.text.primary,
    },
    content: {
        paddingBottom: spacing.xxl,
    },
    card: {
        backgroundColor: colors.background.secondary,
        borderRadius: borderRadius.lg,
        padding: spacing.lg,
        marginBottom: spacing.lg,
        alignItems: 'center',
    },
    cardLabel: {
        ...typography.label,
        marginBottom: spacing.xs,
    },
    balanceAmount: {
        ...typography.h1,
        color: colors.accent.primary,
        marginBottom: spacing.xs,
    },
    tokenCount: {
        ...typography.bodySmall,
        color: colors.text.secondary,
        marginBottom: spacing.lg,
    },
    actionButtons: {
        flexDirection: 'row',
        gap: spacing.md,
        width: '100%',
    },
    actionBtn: {
        flex: 1,
    },
    section: {
        marginTop: spacing.md,
    },
    sectionTitle: {
        ...typography.h4,
        color: colors.text.secondary,
        marginBottom: spacing.md,
        marginLeft: spacing.sm,
    },
    menuItem: {
        backgroundColor: colors.background.secondary,
        padding: spacing.lg,
        borderRadius: borderRadius.md,
        marginBottom: spacing.sm,
    },
    menuText: {
        ...typography.body,
        color: colors.text.primary,
    },
});

import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '@/components/layout';
import { Button } from '@/components/ui';
import { colors, spacing, typography, borderRadius } from '@/theme';
import { useWalletStore, MintBalance } from '@/store/wallet.store';
import { useConfigStore } from '@/store/config.store';
import { useAlert } from '@/hooks/useAlert';

export default function AdminDashboard() {
    const router = useRouter();
    const { balance, proofs, getBalancesByMint, getTestnetBalance, getMainnetBalance, clearWallet } = useWalletStore();
    const { currency } = useConfigStore();
    const { confirm, success } = useAlert();

    const handleClearWallet = () => {
        if (balance === 0) {
            success('Wallet Empty', 'There are no tokens to clear.');
            return;
        }
        confirm(
            'Clear Wallet',
            `Are you sure you want to delete all ${proofs.length} tokens (${balance.toLocaleString()} sats)? This action cannot be undone.`,
            () => {
                clearWallet();
                success('Wallet Cleared', 'All tokens have been removed.');
            }
        );
    };

    const mintBalances = getBalancesByMint();
    const testnetBalance = getTestnetBalance();
    const mainnetBalance = getMainnetBalance();

    return (
        <Screen style={styles.screen}>
            {/* Back Button */}
            <Pressable onPress={() => router.back()} style={styles.backButton}>
                <Ionicons name="chevron-back" size={28} color="#fff" />
            </Pressable>

            <ScrollView contentContainerStyle={styles.content}>
                {/* Total Balance Card */}
                <View style={styles.card}>
                    <Text style={styles.cardLabel}>Total Balance</Text>
                    <Text style={styles.balanceAmount}>{balance.toLocaleString()} sats</Text>
                    <Text style={styles.tokenCount}>{proofs.length} tokens</Text>

                    {/* Balance Summary */}
                    {(mainnetBalance > 0 || testnetBalance > 0) && (
                        <View style={styles.balanceSummary}>
                            {mainnetBalance > 0 && (
                                <View style={styles.summaryItem}>
                                    <View style={[styles.badge, styles.mainnetBadge]}>
                                        <Text style={styles.badgeText}>MAINNET</Text>
                                    </View>
                                    <Text style={styles.summaryAmount}>{mainnetBalance.toLocaleString()} sats</Text>
                                </View>
                            )}
                            {testnetBalance > 0 && (
                                <View style={styles.summaryItem}>
                                    <View style={[styles.badge, styles.testnetBadge]}>
                                        <Text style={styles.badgeText}>TESTNET</Text>
                                    </View>
                                    <Text style={styles.summaryAmount}>{testnetBalance.toLocaleString()} sats</Text>
                                </View>
                            )}
                        </View>
                    )}

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

                {/* Balance by Mint */}
                {mintBalances.length > 0 && (
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Balance by Mint</Text>
                        {mintBalances.map((mint, index) => (
                            <MintBalanceCard key={mint.mintUrl + index} mint={mint} />
                        ))}
                    </View>
                )}

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

                {/* Danger Zone */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Danger Zone</Text>
                    <Pressable style={[styles.menuItem, styles.dangerItem]} onPress={handleClearWallet}>
                        <Text style={styles.dangerText}>Clear Wallet</Text>
                        <Text style={styles.dangerHint}>Remove all tokens (cannot be undone)</Text>
                    </Pressable>
                </View>
            </ScrollView>
        </Screen>
    );
}

function MintBalanceCard({ mint }: { mint: MintBalance }) {
    return (
        <View style={styles.mintCard}>
            <View style={styles.mintHeader}>
                <Text style={styles.mintName} numberOfLines={1}>
                    {mint.displayName}
                </Text>
                <View style={[styles.badge, mint.isTestnet ? styles.testnetBadge : styles.mainnetBadge]}>
                    <Text style={styles.badgeText}>{mint.isTestnet ? 'TEST' : 'MAIN'}</Text>
                </View>
            </View>
            <View style={styles.mintDetails}>
                <Text style={styles.mintBalance}>{mint.balance.toLocaleString()} sats</Text>
                <Text style={styles.mintProofs}>{mint.proofCount} tokens</Text>
            </View>
            <Text style={styles.mintUrl} numberOfLines={1}>{mint.mintUrl}</Text>
        </View>
    );
}

const styles = StyleSheet.create({
    screen: {
        flex: 1,
        padding: spacing.md,
        paddingTop: 0,
    },
    backButton: {
        padding: 12,
        paddingLeft: 0,
        marginBottom: spacing.sm,
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
        marginBottom: spacing.md,
    },
    balanceSummary: {
        flexDirection: 'row',
        gap: spacing.lg,
        marginBottom: spacing.lg,
        paddingTop: spacing.sm,
        borderTopWidth: 1,
        borderTopColor: colors.border.default,
        width: '100%',
        justifyContent: 'center',
    },
    summaryItem: {
        alignItems: 'center',
        gap: spacing.xs,
    },
    summaryAmount: {
        ...typography.body,
        color: colors.text.primary,
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
    // Mint card styles
    mintCard: {
        backgroundColor: colors.background.secondary,
        borderRadius: borderRadius.md,
        padding: spacing.md,
        marginBottom: spacing.sm,
    },
    mintHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: spacing.xs,
    },
    mintName: {
        ...typography.body,
        color: colors.text.primary,
        fontWeight: '600',
        flex: 1,
        marginRight: spacing.sm,
    },
    mintDetails: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: spacing.xs,
    },
    mintBalance: {
        ...typography.bodyLarge,
        color: colors.accent.primary,
        fontWeight: '600',
    },
    mintProofs: {
        ...typography.caption,
        color: colors.text.muted,
    },
    mintUrl: {
        ...typography.caption,
        color: colors.text.muted,
        fontFamily: 'monospace',
    },
    // Badge styles
    badge: {
        paddingHorizontal: spacing.sm,
        paddingVertical: 2,
        borderRadius: borderRadius.sm,
    },
    mainnetBadge: {
        backgroundColor: colors.accent.primary,
    },
    testnetBadge: {
        backgroundColor: colors.status.warning,
    },
    badgeText: {
        fontSize: 10,
        fontWeight: '700',
        color: colors.background.primary,
        textTransform: 'uppercase',
    },
    // Danger zone styles
    dangerItem: {
        borderWidth: 1,
        borderColor: colors.status.error,
        backgroundColor: 'transparent',
    },
    dangerText: {
        ...typography.body,
        color: colors.status.error,
        fontWeight: '600',
    },
    dangerHint: {
        ...typography.caption,
        color: colors.text.muted,
        marginTop: spacing.xs,
    },
});

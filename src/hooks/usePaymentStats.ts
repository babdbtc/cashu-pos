import { useMemo } from 'react';
import { usePaymentStore } from '@/store/payment.store';
import { useConfigStore } from '@/store/config.store';
import { Payment } from '@/types/payment';

interface StatsData {
    sales: number;
    sats: number;
    transactions: number;
    avgTransaction: number;
    avgSats: number;
}

interface PeriodStats {
    today: StatsData;
    week: StatsData;
    month: StatsData;
}

export interface PaymentStats {
    // Stats for this device only
    device: PeriodStats;
    // Stats for all devices (store-wide)
    store: PeriodStats;
    // Whether we have synced data from other terminals
    hasSyncedData: boolean;
    // Number of unique terminals in the data
    terminalCount: number;
}

export function usePaymentStats(): PaymentStats {
    const recentPayments = usePaymentStore((state) => state.recentPayments);
    const terminalId = useConfigStore((state) => state.terminalId);

    return useMemo(() => {
        const now = new Date();
        // Reset time to start of day
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

        // Start of week (Sunday)
        const weekStart = new Date(today);
        weekStart.setDate(today.getDate() - today.getDay());

        // Start of month
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

        const completedPayments = recentPayments.filter(p => p.state === 'completed');

        // Separate device-specific and all payments
        const devicePayments = completedPayments.filter(p =>
            !p.terminalId || p.terminalId === terminalId
        );

        // Count unique terminals
        const uniqueTerminals = new Set(
            completedPayments.map(p => p.terminalId).filter(Boolean)
        );
        const terminalCount = Math.max(1, uniqueTerminals.size);

        // Check if we have data from other terminals
        const hasSyncedData = completedPayments.some(p =>
            p.terminalId && p.terminalId !== terminalId
        );

        const calculateStats = (payments: Payment[]): StatsData => {
            const sales = payments.reduce((acc, p) => acc + (p.fiatAmount || 0), 0);
            const sats = payments.reduce((acc, p) => acc + (p.satsAmount || 0), 0);
            const transactions = payments.length;
            const avgTransaction = transactions > 0 ? sales / transactions : 0;
            const avgSats = transactions > 0 ? sats / transactions : 0;

            return { sales, sats, transactions, avgTransaction, avgSats };
        };

        const calculatePeriodStats = (payments: Payment[]): PeriodStats => {
            const todayPayments = payments.filter(p => new Date(p.createdAt) >= today);
            const weekPayments = payments.filter(p => new Date(p.createdAt) >= weekStart);
            const monthPayments = payments.filter(p => new Date(p.createdAt) >= monthStart);

            return {
                today: calculateStats(todayPayments),
                week: calculateStats(weekPayments),
                month: calculateStats(monthPayments),
            };
        };

        return {
            device: calculatePeriodStats(devicePayments),
            store: calculatePeriodStats(completedPayments),
            hasSyncedData,
            terminalCount,
        };
    }, [recentPayments, terminalId]);
}

import React from 'react';
import { ScrollView, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { formatDateRange } from '../../src/domain/finance';
import { useFinance } from '../../src/state/FinanceContext';
import { colors, styles } from '../../src/theme/theme';
import { formatMoney, ScreenHeader } from '../../src/components/ui';

export default function BudgetHistoryScreen() { const finance = useFinance(); const insets = useSafeAreaInsets(); return <View style={[styles.screen, { paddingTop: insets.top }]}><ScreenHeader title="Riwayat Budget" back onBack={() => router.back()} /><ScrollView contentContainerStyle={[styles.content, { paddingBottom: 40 }]}>{finance.budgetHistory.length === 0 ? <Text style={styles.muted}>Belum ada periode budget yang selesai.</Text> : finance.budgetHistory.map((period) => <View key={period.id} style={{ paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: colors.line }}><Text style={{ color: colors.ink, fontSize: 15, fontWeight: '700' }}>{formatDateRange(period.startDate, period.endDate)}</Text><Text style={[styles.muted, { marginTop: 8 }]}>Dana budget {formatMoney(period.budgetableMoneySnapshot)}</Text><Text style={styles.muted}>Tetap {formatMoney(period.fixedTotalSnapshot)}</Text><Text style={styles.muted}>Fleksibel {formatMoney(period.flexiblePoolSnapshot)}</Text></View>)}</ScrollView></View>; }

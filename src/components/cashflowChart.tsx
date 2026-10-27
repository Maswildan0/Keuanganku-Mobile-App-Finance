import React from 'react';
import { Pressable, Text, View, useWindowDimensions } from 'react-native';
import Svg, { G, Line, Rect, Text as SvgText } from 'react-native-svg';
import { formatCompactIDR, formatExactIDR, getNiceChartScale } from '../domain/finance';
import { Cashflow } from '../domain/models';
import { colors } from '../theme/theme';

export type CashflowChartItem = { date?: string; label?: string; day?: number; year?: number; income: number; expense: number; net_cashflow: number };
export type CashflowChartMode = 'expense' | 'income' | 'both';

function seriesLabel(mode: CashflowChartMode) { return mode === 'income' ? 'Pemasukan' : 'Pengeluaran'; }
function chartLabel(item: CashflowChartItem, isWeekly: boolean) { return isWeekly ? [item.label ?? '', String(item.day ?? '')] : [String(item.label ?? item.year ?? '')]; }

export function CashflowChart({ chart, mode, isWeekly, onSelect, selectedIndex }: { chart: CashflowChartItem[]; mode: CashflowChartMode; isWeekly: boolean; onSelect: (index: number) => void; selectedIndex: number | null }) {
  const { width: windowWidth } = useWindowDimensions();
  const width = Math.max(280, windowWidth - 40); const height = 220; const left = 50; const right = 8; const top = 14; const bottom = 42; const plotWidth = width - left - right; const plotHeight = height - top - bottom;
  const values = chart.flatMap((item) => mode === 'both' ? [item.income, item.expense] : [mode === 'income' ? item.income : item.expense]); const scale = getNiceChartScale(values); const groupWidth = chart.length ? plotWidth / chart.length : plotWidth; const barWidth = Math.min(mode === 'both' ? 16 : 24, groupWidth * (mode === 'both' ? 0.25 : 0.52)); const hasData = values.some((value) => value > 0); const labels = chart.map((item) => chartLabel(item, isWeekly));
  if (!hasData) return <View style={{ width, height, alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: colors.muted, fontSize: 12 }}>Belum ada transaksi pada periode ini.</Text></View>;
  return <View style={{ width, height, position: 'relative' }}><Svg width={width} height={height}><G>{scale.ticks.map((tick) => { const y = top + plotHeight - (tick / scale.max) * plotHeight; return <G key={tick}><Line x1={left} y1={y} x2={width - right} y2={y} stroke="#E7EBE5" strokeWidth="1" /><SvgText x={left - 7} y={y + 4} fill={colors.muted} fontSize="10" textAnchor="end">{formatCompactIDR(tick)}</SvgText></G>; })}{chart.map((item, index) => { const center = left + groupWidth * index + groupWidth / 2; const incomeHeight = item.income > 0 ? (item.income / scale.max) * plotHeight : 0; const expenseHeight = item.expense > 0 ? (item.expense / scale.max) * plotHeight : 0; const incomeX = mode === 'both' ? center - barWidth - 2 : center - barWidth / 2; const expenseX = mode === 'both' ? center + 2 : center - barWidth / 2; const selected = selectedIndex === index; return <G key={`${item.date ?? item.year ?? index}`}><Rect x={left + groupWidth * index} y={top} width={groupWidth} height={plotHeight} fill={selected ? 'rgba(37,92,77,0.05)' : 'transparent'} rx="4" /><Rect x={mode === 'income' ? incomeX : expenseX} y={top + plotHeight - (mode === 'income' ? incomeHeight : expenseHeight)} width={barWidth} height={mode === 'income' ? incomeHeight : expenseHeight} fill={mode === 'income' ? colors.accent : colors.negative} rx="3" />{mode === 'both' && <><Rect x={incomeX} y={top + plotHeight - incomeHeight} width={barWidth} height={incomeHeight} fill={colors.accent} rx="3" /><Rect x={expenseX} y={top + plotHeight - expenseHeight} width={barWidth} height={expenseHeight} fill={colors.negative} rx="3" /></>}{labels[index].map((label, line) => <SvgText key={`${label}-${line}`} x={center} y={height - bottom + 16 + line * 12} fill={colors.muted} fontSize="10" textAnchor="middle">{label}</SvgText>)}</G>; })}</G></Svg><View style={{ position: 'absolute', left, top, width: plotWidth, height: plotHeight + bottom, flexDirection: 'row' }}>{chart.map((item, index) => <Pressable key={`tap-${item.date ?? item.year ?? index}`} accessibilityRole="button" accessibilityLabel={`${isWeekly ? `${item.label ?? ''} ${item.day ?? ''}` : item.label ?? item.year ?? ''}, ${mode === 'both' ? `pemasukan ${formatExactIDR(item.income)}, pengeluaran ${formatExactIDR(item.expense)}` : `${seriesLabel(mode)} ${formatExactIDR(mode === 'income' ? item.income : item.expense)}`}`} onPress={() => onSelect(index)} style={{ width: groupWidth, height: plotHeight + bottom }} />)}</View></View>;
}

export function formatCashflowSummary(mode: CashflowChartMode, flow: Cashflow) {
  if (mode === 'income') return { primary: 'Pemasukan', primaryValue: formatExactIDR(flow.income), secondary: `Pengeluaran ${formatExactIDR(flow.expense)}` };
  if (mode === 'both') return { primary: 'Pemasukan', primaryValue: formatExactIDR(flow.income), secondary: `Pengeluaran ${formatExactIDR(flow.expense)}` };
  return { primary: 'Pengeluaran', primaryValue: formatExactIDR(flow.expense), secondary: `Pemasukan ${formatExactIDR(flow.income)}` };
}

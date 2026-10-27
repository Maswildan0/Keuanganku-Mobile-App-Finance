import React, { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FixedBudget } from '../../src/domain/models';
import { parseMoneyInput } from '../../src/domain/finance';
import { useFinance } from '../../src/state/FinanceContext';
import { colors, styles } from '../../src/theme/theme';
import { Field, ScreenHeader } from '../../src/components/ui';

export default function FixedBudgetForm() {
  const { id } = useLocalSearchParams<{ id?: string }>(); const finance = useFinance(); const insets = useSafeAreaInsets(); const existing = finance.fixedBudgets.find((item) => item.id === id);
  const [form, setForm] = useState<FixedBudget>(existing ?? { id: '', name: '', amount: 0, dueDay: 1, recurrence: 'monthly', active: true }); const [amountText, setAmountText] = useState(existing ? String(existing.amount) : ''); const [dueDayText, setDueDayText] = useState(String(existing?.dueDay ?? 1));
  const update = <K extends keyof FixedBudget>(key: K, value: FixedBudget[K]) => setForm((current) => ({ ...current, [key]: value }));
  async function save() {
    const amount = parseMoneyInput(amountText); const dueDay = Number(dueDayText.replace(/[^0-9]/g, ''));
    if (!form.name.trim()) { Alert.alert('Nama belum diisi', 'Masukkan nama kebutuhan tetap.'); return; }
    if (amount === null || amount < 0 || (amount === 0 && form.active)) { Alert.alert('Nominal belum valid', 'Budget aktif harus lebih besar dari nol.'); return; }
    if (!Number.isInteger(dueDay) || dueDay < 1 || dueDay > 31) { Alert.alert('Tanggal belum valid', 'Masukkan tanggal antara 1 dan 31.'); return; }
    try { await finance.saveFixedBudget({ ...form, amount, dueDay }); router.back(); } catch (error) { Alert.alert('Budget belum tersimpan', error instanceof Error ? error.message : 'Coba lagi.'); }
  }
  function remove() { if (!existing) return; Alert.alert(`Hapus budget "${existing.name}"?`, 'Budget ini akan dihapus dari perencanaan bulan berjalan.', [{ text: 'Batal', style: 'cancel' }, { text: 'Hapus', style: 'destructive', onPress: async () => { await finance.removeFixedBudget(existing.id); router.back(); } }]); }
  return <View style={[styles.screen, { paddingTop: insets.top }]}><ScreenHeader title={existing ? 'Edit budget tetap' : 'Budget tetap baru'} back onBack={() => router.back()} /><KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}><ScrollView contentContainerStyle={[styles.content, { gap: 16, paddingBottom: 40 }]} keyboardShouldPersistTaps="handled" keyboardDismissMode="interactive"><Text style={styles.muted}>Nominal tetap tidak berubah saat pemasukan berubah.</Text><Field label="Nama kebutuhan" autoFocus value={form.name} onChangeText={(value) => update('name', value)} placeholder="Contoh: Asuransi" /><Field label="Nominal per bulan" keyboardType="numeric" value={amountText} onChangeText={setAmountText} placeholder="0" /><Field label="Jatuh tempo (tanggal)" keyboardType="numeric" value={dueDayText} onChangeText={setDueDayText} placeholder="1" /><View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10 }}><View style={styles.rowMain}><Text style={styles.rowTitle}>Status budget</Text><Text style={styles.rowMeta}>{form.active ? 'Masuk dalam total kebutuhan tetap.' : 'Tidak masuk dalam perhitungan.'}</Text></View><Pressable onPress={() => update('active', !form.active)} style={{ paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, backgroundColor: form.active ? colors.softGreen : colors.softGray }}><Text style={{ color: form.active ? colors.accent : colors.muted, fontSize: 12, fontWeight: '700' }}>{form.active ? 'Aktif' : 'Nonaktif'}</Text></Pressable></View><Pressable onPress={() => void save()} style={styles.primaryButton}><Text style={styles.primaryButtonText}>Simpan budget</Text></Pressable>{existing && <Pressable onPress={remove} style={[styles.secondaryButton, { borderColor: '#E7C8C1' }]}><Text style={{ color: colors.negative, fontSize: 12, fontWeight: '700' }}>Hapus kebutuhan</Text></Pressable>}</ScrollView></KeyboardAvoidingView></View>;
}

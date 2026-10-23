import React, { useCallback, useEffect, useState } from 'react';
import { AppState, Pressable, Text, View } from 'react-native';
import { Stack } from 'expo-router';
import { SQLiteProvider } from 'expo-sqlite';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { migrateDbIfNeeded } from '../src/db/database';
import { FinanceProvider } from '../src/state/FinanceContext';
import { authenticateApp, isAppLockEnabled } from '../src/services/security';
import { colors, styles } from '../src/theme/theme';

function AppLockGate({ children }: React.PropsWithChildren) {
  const [locked, setLocked] = useState(false);
  const [enabled, setEnabled] = useState(false);
  useEffect(() => { let mounted = true; isAppLockEnabled().then(async (value) => { if (!mounted) return; setEnabled(value); if (value) setLocked(!(await authenticateApp())); }); const subscription = AppState.addEventListener('change', async (state) => { if (state === 'background' && enabled) setLocked(true); if (state === 'active' && enabled) setLocked(!(await authenticateApp())); }); return () => { mounted = false; subscription.remove(); }; }, [enabled]);
  if (!locked) return <>{children}</>;
  return <View style={[styles.screen, { alignItems: 'center', justifyContent: 'center', padding: 28 }]}><View style={styles.iconBox}><Text style={{ color: colors.accent, fontSize: 18 }}>●</Text></View><Text style={{ color: colors.ink, fontSize: 22, fontWeight: '800', marginTop: 16 }}>Arus terkunci</Text><Text style={[styles.muted, { textAlign: 'center', marginTop: 7, marginBottom: 22 }]}>Gunakan biometrik untuk melihat data keuanganmu.</Text><Pressable onPress={async () => setLocked(!(await authenticateApp()))} style={styles.primaryButton}><Text style={styles.primaryButtonText}>Buka dengan biometrik</Text></Pressable></View>;
}

function DatabaseFailure({ message }: { message: string }) { return <View style={[styles.screen, { alignItems: 'center', justifyContent: 'center', padding: 28 }]}><Text style={{ color: colors.ink, fontSize: 20, fontWeight: '800' }}>Data belum dapat dibuka</Text><Text style={[styles.muted, { textAlign: 'center', marginTop: 8 }]}>{message}</Text></View>; }

export default function RootLayout() {
  const [databaseError, setDatabaseError] = useState<string | null>(null);
  const handleDatabaseError = useCallback((error: Error) => setDatabaseError(error.message), []);
  return <SafeAreaProvider><StatusBar style="dark" backgroundColor={colors.background} /><SQLiteProvider databaseName="arus.db" onInit={migrateDbIfNeeded} onError={handleDatabaseError}>{databaseError ? <DatabaseFailure message={databaseError} /> : <FinanceProvider><AppLockGate><Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background }, animation: 'slide_from_right' }} /></AppLockGate></FinanceProvider>}</SQLiteProvider></SafeAreaProvider>;
}

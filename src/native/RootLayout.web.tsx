import React from 'react';
import { Text, View } from 'react-native';
import { Stack } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { FinanceProvider } from '../state/FinanceContext';
import { getFinanceRuntime } from '../state/platform';
import { colors } from '../theme/theme';

export default function WebRootLayout() { if (__DEV__) console.info(`[Keuanganku] Platform: web; Runtime: ${getFinanceRuntime('web')}; Initialization complete`); return <SafeAreaProvider><StatusBar style="dark" backgroundColor={colors.background} /><View style={{ flex: 1, alignItems: 'center', backgroundColor: '#E9EEEA' }}><View style={{ flex: 1, width: '100%', maxWidth: 430, backgroundColor: colors.background }}><View style={{ height: 24, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.softGray }}><Text style={{ color: colors.muted, fontSize: 10, fontWeight: '700', letterSpacing: 0.6 }}>WEB PREVIEW</Text></View><FinanceProvider><Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background }, animation: 'slide_from_right' }} /></FinanceProvider></View></View></SafeAreaProvider>; }

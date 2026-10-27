import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';

const LOCK_KEY = 'arus.app-lock-enabled';
export async function isAppLockEnabled() { try { return (await SecureStore.getItemAsync(LOCK_KEY)) === '1'; } catch { return false; } }
export async function canUseBiometrics() { try { const hardware = await LocalAuthentication.hasHardwareAsync(); const enrolled = await LocalAuthentication.isEnrolledAsync(); return hardware && enrolled; } catch { return false; } }
export async function setAppLockEnabled(enabled: boolean) { try { await SecureStore.setItemAsync(LOCK_KEY, enabled ? '1' : '0'); } catch { /* Unsupported secure storage should not prevent the app from opening. */ } }
export async function authenticateApp() { try { const result = await LocalAuthentication.authenticateAsync({ promptMessage: 'Buka Keuanganku', cancelLabel: 'Batal', disableDeviceFallback: false }); return result.success; } catch { return false; } }

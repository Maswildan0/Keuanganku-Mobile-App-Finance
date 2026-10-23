import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';

const LOCK_KEY = 'arus.app-lock-enabled';
export async function isAppLockEnabled() { return (await SecureStore.getItemAsync(LOCK_KEY)) === '1'; }
export async function canUseBiometrics() { const hardware = await LocalAuthentication.hasHardwareAsync(); const enrolled = await LocalAuthentication.isEnrolledAsync(); return hardware && enrolled; }
export async function setAppLockEnabled(enabled: boolean) { await SecureStore.setItemAsync(LOCK_KEY, enabled ? '1' : '0'); }
export async function authenticateApp() { const result = await LocalAuthentication.authenticateAsync({ promptMessage: 'Buka Arus', cancelLabel: 'Batal', disableDeviceFallback: false }); return result.success; }

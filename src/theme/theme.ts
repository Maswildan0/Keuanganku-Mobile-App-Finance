import { StyleSheet } from 'react-native';

export const colors = {
  background: '#F7F8F6', surface: '#FFFFFF', ink: '#20231F', muted: '#7C817B', line: '#E2E7E0', accent: '#255C4D', accentDark: '#16483B', positive: '#32725A', negative: '#BD6253', warning: '#B47628', softGreen: '#E4EEE8', softTan: '#F1E9DC', softGray: '#EFF2EC',
};
export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 };
export const radius = { sm: 8, md: 11, lg: 16 };
export const TAB_BAR_BASE_HEIGHT = 64;
export const TAB_BAR_SPACING = spacing.lg;
export const getTabBarHeight = (bottomInset: number) => TAB_BAR_BASE_HEIGHT + bottomInset;
export const getTabBarPaddingBottom = (bottomInset: number) => Math.max(bottomInset, spacing.sm);
export const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: 20, paddingBottom: 110 },
  section: { paddingVertical: 24, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line },
  sectionHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 },
  sectionTitle: { color: colors.ink, fontSize: 16, fontWeight: '700', letterSpacing: -0.2 },
  muted: { color: colors.muted, fontSize: 12 },
  eyebrow: { color: colors.muted, fontSize: 11, fontWeight: '700', letterSpacing: 1.2, textTransform: 'uppercase' },
  buttonText: { color: colors.accent, fontSize: 12, fontWeight: '700' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 11, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#EDF0EB' },
  rowMain: { flex: 1, gap: 4 },
  rowTitle: { color: colors.ink, fontSize: 13, fontWeight: '600' },
  rowMeta: { color: colors.muted, fontSize: 11 },
  iconBox: { width: 34, height: 34, borderRadius: 9, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.softGray },
  primaryButton: { minHeight: 46, borderRadius: 10, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16 },
  primaryButtonText: { color: '#FFF', fontSize: 13, fontWeight: '700' },
  secondaryButton: { minHeight: 42, borderRadius: 10, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16 },
  secondaryButtonText: { color: colors.accent, fontSize: 12, fontWeight: '700' },
});

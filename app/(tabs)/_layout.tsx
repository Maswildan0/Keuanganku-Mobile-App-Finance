import { Tabs } from 'expo-router';
import { Icon, useTabBarLayout } from '../../src/components/ui';
import { colors } from '../../src/theme/theme';

export default function TabsLayout() {
  const { tabBarHeight, tabBarPaddingBottom } = useTabBarLayout();
  return <Tabs screenOptions={{ headerShown: false, tabBarActiveTintColor: colors.accent, tabBarInactiveTintColor: '#9AA099', tabBarStyle: { height: tabBarHeight, paddingTop: 6, paddingBottom: tabBarPaddingBottom, borderTopColor: colors.line, backgroundColor: '#FFFFFF' }, tabBarLabelStyle: { fontSize: 10, fontWeight: '600' } }}>
    <Tabs.Screen name="index" options={{ title: 'Beranda', tabBarIcon: ({ color, size }) => <Icon name="home" size={size} color={color} /> }} />
    <Tabs.Screen name="transactions" options={{ title: 'Transaksi', tabBarIcon: ({ color, size }) => <Icon name="list" size={size} color={color} /> }} />
    <Tabs.Screen name="budget" options={{ title: 'Budget', tabBarIcon: ({ color, size }) => <Icon name="budget" size={size} color={color} /> }} />
    <Tabs.Screen name="profile" options={{ title: 'Profil', tabBarIcon: ({ color, size }) => <Icon name="user" size={size} color={color} /> }} />
  </Tabs>;
}

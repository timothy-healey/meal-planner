import { Text } from 'react-native';
import { Tabs } from 'expo-router';
import { colors, font } from '../../constants/tokens';

export default function TabLayout() {
  return (
    <Tabs
      initialRouteName="plan"
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.green,
        tabBarInactiveTintColor: colors.tabInactive,
        tabBarStyle: {
          backgroundColor: colors.cream,
          borderTopColor: colors.divider,
          borderTopWidth: 1,
        },
        tabBarLabelStyle: {
          fontFamily: font.family.bold,
          fontSize: font.size['2xs'],
        },
      }}
    >
      <Tabs.Screen name="index" options={{ href: null }} />
      <Tabs.Screen
        name="plan"
        options={{
          title: 'Plan',
          tabBarAccessibilityLabel: 'Plan',
          tabBarIcon: () => <Text style={{ fontSize: 18 }}>📅</Text>,
        }}
      />
      <Tabs.Screen
        name="shop"
        options={{
          title: 'Shop',
          tabBarAccessibilityLabel: 'Shop',
          tabBarIcon: () => <Text style={{ fontSize: 18 }}>🛒</Text>,
        }}
      />
      <Tabs.Screen
        name="recipes"
        options={{
          title: 'Recipes',
          tabBarAccessibilityLabel: 'Recipes',
          tabBarIcon: () => <Text style={{ fontSize: 18 }}>🍳</Text>,
        }}
      />
    </Tabs>
  );
}

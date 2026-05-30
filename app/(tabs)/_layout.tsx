import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
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
          tabBarIcon: ({ focused, color }) => (
            <Ionicons name={focused ? 'calendar' : 'calendar-outline'} size={22} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="shop"
        options={{
          title: 'Shop',
          tabBarAccessibilityLabel: 'Shop',
          tabBarIcon: ({ focused, color }) => (
            <Ionicons name={focused ? 'cart' : 'cart-outline'} size={22} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="recipes"
        options={{
          title: 'Recipes',
          tabBarAccessibilityLabel: 'Recipes',
          tabBarIcon: ({ focused, color }) => (
            <Ionicons name={focused ? 'restaurant' : 'restaurant-outline'} size={22} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="catalog"
        options={{
          title: 'Catalog',
          tabBarAccessibilityLabel: 'Catalog',
          tabBarIcon: ({ focused, color }) => (
            <Ionicons name={focused ? 'library' : 'library-outline'} size={22} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}

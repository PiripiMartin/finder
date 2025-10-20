import { Ionicons } from '@expo/vector-icons';
import { Tabs } from "expo-router";
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

export default function TabLayout() {
  const { theme } = useTheme();
  const { isGuest } = useAuth();
  
  return (
    <Tabs
      initialRouteName="index"
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: theme.colors.surface,
          borderTopWidth: 1,
          borderTopColor: theme.colors.border,
          paddingBottom: 15,
          paddingTop: 5,
          height: 70,
        },
        tabBarActiveTintColor: theme.colors.primary,
        tabBarInactiveTintColor: theme.colors.textSecondary,
      }}
    >
      <Tabs.Screen
        name="saved"
        options={{
          title: "",
          tabBarIcon: ({ color }) => (
            <Ionicons name="bookmark" size={20} color={color} />
          ),
          href: isGuest ? null : '/saved',
        }}
      />
      <Tabs.Screen
        name="index"
        options={{
          title: "",
          tabBarIcon: ({ color }) => (
            <Ionicons name="map" size={20} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "",
          tabBarIcon: ({ color }) => (
            <Ionicons name="people" size={20} color={color} />
          ),
          href: isGuest ? null : '/profile',
        }}
      />
    </Tabs>
  );
}

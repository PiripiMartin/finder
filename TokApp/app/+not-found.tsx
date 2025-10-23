import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useAuth } from './context/AuthContext';
import { useTheme } from './context/ThemeContext';

export default function NotFoundScreen() {
  const router = useRouter();
  const { isAuthenticated, isLoading } = useAuth();
  const { theme } = useTheme();

  useEffect(() => {
    // Redirect to appropriate screen after a brief moment
    if (!isLoading) {
      const timer = setTimeout(() => {
        if (isAuthenticated) {
          console.log('📍 [NotFound] Redirecting authenticated user to main app');
          router.replace('/(tabs)');
        } else {
          console.log('📍 [NotFound] Redirecting unauthenticated user to login');
          router.replace('/auth/login');
        }
      }, 500);

      return () => clearTimeout(timer);
    }
  }, [isAuthenticated, isLoading, router]);

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <ActivityIndicator size="large" color={theme.colors.primary} />
      <Text style={[styles.text, { color: theme.colors.textSecondary }]}>
        Loading...
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  text: {
    marginTop: 16,
    fontSize: 16,
  },
});



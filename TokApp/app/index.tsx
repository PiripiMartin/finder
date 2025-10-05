import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { useAuth } from './context/AuthContext';
import { useTheme } from './context/ThemeContext';

export default function RootIndex() {
  const router = useRouter();
  const { isAuthenticated, isGuest, isLoading, sessionToken } = useAuth();
  const { theme } = useTheme();
  
  useEffect(() => {
    try {
      console.log('🔍 [RootIndex] Auth state changed:', { 
        isAuthenticated, 
        isGuest, 
        isLoading, 
        hasToken: !!sessionToken 
      });
      
      if (!isLoading) {
        if (isAuthenticated && sessionToken) {
          console.log('✅ [RootIndex] User authenticated with valid token, redirecting to main app');
          // User is authenticated with a valid session token
          router.replace('/(tabs)');
        } else {
          console.log('❌ [RootIndex] User not authenticated or no valid token, redirecting to login');
          // User is not authenticated or has no valid session token
          // Always redirect to login to ensure proper authentication
          router.replace('/auth/login');
        }
      }
    } catch (error) {
      console.error('Navigation error:', error);
      // Fallback to login if navigation fails
      router.replace('/auth/login');
    }
  }, [isAuthenticated, isGuest, isLoading, sessionToken, router]);

  // Show loading spinner while checking authentication status
  return (
    <View style={[
      styles.container,
      { backgroundColor: theme.colors.background }
    ]}>
      <ActivityIndicator 
        size="large" 
        color={theme.colors.primary} 
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useAuth } from './context/AuthContext';
import { useTheme } from './context/ThemeContext';

export default function RootIndex() {
  const router = useRouter();
  const { isAuthenticated, isLoading, guestLogin } = useAuth();
  const { theme } = useTheme();
  const [showChoice, setShowChoice] = useState(false);

  useEffect(() => {
    try {
      console.log('🔍 [RootIndex] Auth state changed:', { isAuthenticated, isLoading, showChoice });
      if (!isLoading) {
        if (isAuthenticated) {
          console.log('✅ [RootIndex] User authenticated, redirecting to main app');
          // User is authenticated, redirect to main app
          router.replace('/(tabs)');
        } else {
          console.log('❌ [RootIndex] User not authenticated, showing choice screen');
          // User is not authenticated, show choice after a brief delay
          const timer = setTimeout(() => {
            setShowChoice(true);
          }, 1000);
          return () => clearTimeout(timer);
        }
      }
    } catch (error) {
      console.error('Navigation error:', error);
      // Fallback to showing choice if navigation fails
      setShowChoice(true);
    }
  }, [isAuthenticated, isLoading, router]);

  const handleGuestLogin = async () => {
    try {
      await guestLogin();
      router.replace('/(tabs)');
    } catch (error) {
      console.error('Guest login error:', error);
    }
  };

  const goToLogin = () => {
    router.replace('/auth/login');
  };

  // Show loading spinner while checking authentication status
  if (isLoading) {
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

  // Show choice between login and guest mode
  if (showChoice && !isAuthenticated) {
    return (
      <View style={[
        styles.container,
        { backgroundColor: theme.colors.background }
      ]}>
        <View style={styles.choiceContainer}>
          <Ionicons name="map" size={80} color={theme.colors.primary} />
          <Text style={[styles.title, { color: theme.colors.text }]}>Welcome to lai</Text>
          <Text style={[styles.subtitle, { color: theme.colors.textSecondary }]}>
            Discover amazing places around you
          </Text>
          
          <TouchableOpacity
            style={[styles.loginButton, { backgroundColor: theme.colors.primary }]}
            onPress={goToLogin}
          >
            <Text style={[styles.loginButtonText, { color: theme.colors.surface }]}>Login / Sign Up</Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[styles.guestButton, { borderColor: theme.colors.primary, backgroundColor: theme.colors.textSecondary }]}
            onPress={handleGuestLogin}
          >
            <Text style={[styles.guestButtonText, { color: theme.colors.surface }]}>Continue as Guest</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return null;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  choiceContainer: {
    alignItems: 'center',
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginTop: 10,
    marginBottom: 5,
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 20,
  },
  loginButton: {
    width: '100%',
    paddingVertical: 15,
    paddingHorizontal: 20,
    borderRadius: 10,
    alignItems: 'center',
    marginBottom: 10,
  },
  loginButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  guestButton: {
    width: '100%',
    paddingVertical: 15,
    paddingHorizontal: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: 'transparent',
    alignItems: 'center',
  },
  guestButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
  },
});

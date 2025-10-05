import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useTutorial } from '../context/TutorialContext';
import { getCurrentLocation, getDefaultCoordinates } from '../utils/location';

export default function LoginScreen() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  const router = useRouter();
  const { login, guestLogin } = useAuth();
  const { theme } = useTheme();
  const { recheckTutorialAfterLogin, tutorialFeatureEnabled, isLoading: tutorialLoading } = useTutorial();

  const handleLogin = async () => {
    if (!username.trim() || !password.trim()) {
      Alert.alert('Error', 'Please enter both username and password');
      return;
    }

    setIsLoading(true);
    try {
      console.log('🔐 [Login] Starting login process for username:', username);
      // Try to get current location, fall back to default coordinates
      let coordinates = await getCurrentLocation();
      if (!coordinates) {
        coordinates = getDefaultCoordinates();
      }
      
      console.log('📍 [Login] Using coordinates:', coordinates);
      const success = await login(username.trim(), password.trim(), coordinates);
      console.log('✅ [Login] Login result:', success);
      
      if (success) {
        console.log('🚀 [Login] Login successful, rechecking tutorial state');
        // Re-check tutorial state after successful login
        await recheckTutorialAfterLogin();
        router.replace('/(tabs)');
      } else {
        console.log('❌ [Login] Login failed, showing error alert');
        Alert.alert('Login Failed', 'Invalid username or password');
      }
    } catch (error) {
      console.error('💥 [Login] Login error:', error);
      Alert.alert('Error', 'An error occurred during login');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGuestLogin = async () => {
    try {
      await guestLogin();
      router.replace('/(tabs)');
    } catch (error) {
      Alert.alert('Error', 'An error occurred while entering guest mode');
    }
  };

  const goToCreateAccount = () => {
    router.push('/auth/create-account');
  };

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    content: {
      flex: 1,
      justifyContent: 'center',
      paddingHorizontal: 30,
    },
    title: {
      fontSize: 32,
      fontWeight: 'bold',
      textAlign: 'center',
      marginBottom: 40,
      color: theme.colors.text,
    },
    inputContainer: {
      marginBottom: 20,
    },
    label: {
      fontSize: 16,
      marginBottom: 8,
      color: theme.colors.text,
    },
    input: {
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: 8,
      paddingHorizontal: 16,
      paddingVertical: 12,
      fontSize: 16,
      backgroundColor: theme.colors.surface,
      color: theme.colors.text,
    },
    loginButton: {
      backgroundColor: theme.colors.primary,
      borderRadius: 8,
      paddingVertical: 16,
      alignItems: 'center',
      marginTop: 20,
      marginBottom: 20,
    },
    loginButtonText: {
      color: theme.colors.surface,
      fontSize: 18,
      fontWeight: '600',
    },
    createAccountButton: {
      paddingVertical: 16,
      alignItems: 'center',
    },
    createAccountText: {
      color: theme.colors.primary,
      fontSize: 16,
    },
    disabledButton: {
      backgroundColor: theme.colors.textSecondary,
      opacity: 0.6,
    },
    guestButton: {
      backgroundColor: theme.colors.textSecondary,
      borderRadius: 8,
      paddingVertical: 16,
      alignItems: 'center',
      marginTop: 20,
      marginBottom: 20,
    },
    guestButtonText: {
      color: theme.colors.surface,
      fontSize: 18,
      fontWeight: '600',
    },
  });

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Welcome Back</Text>
        
        <View style={styles.inputContainer}>
          <Text style={styles.label}>Username</Text>
          <TextInput
            style={styles.input}
            value={username}
            onChangeText={setUsername}
            placeholder="Enter your username"
            placeholderTextColor={theme.colors.textSecondary}
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>

        <View style={styles.inputContainer}>
          <Text style={styles.label}>Password</Text>
          <TextInput
            style={styles.input}
            value={password}
            onChangeText={setPassword}
            placeholder="Enter your password"
            placeholderTextColor={theme.colors.textSecondary}
            secureTextEntry
            autoCapitalize="none"
          />
        </View>

        <TouchableOpacity
          style={[styles.loginButton, isLoading && styles.disabledButton]}
          onPress={handleLogin}
          disabled={isLoading}
        >
          <Text style={styles.loginButtonText}>
            {isLoading ? 'Logging in...' : 'Login'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.createAccountButton}
          onPress={goToCreateAccount}
        >
          <Text style={styles.createAccountText}>
            Don't have an account? Create one
          </Text>
        </TouchableOpacity>

        {/* Only show guest button when tutorial feature flag is NOT enabled (not 200) and not loading */}
        {!tutorialLoading && !tutorialFeatureEnabled && (
          <TouchableOpacity
            style={styles.guestButton}
            onPress={handleGuestLogin}
            disabled={isLoading}
          >
            <Text style={styles.guestButtonText}>
              {isLoading ? 'Entering guest mode...' : 'Continue as Guest'}
            </Text>
          </TouchableOpacity>
        )}

      </ScrollView>
    </KeyboardAvoidingView>
  );
}

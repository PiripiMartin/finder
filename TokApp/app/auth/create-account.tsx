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
import { logger } from '../utils/logger';

export default function CreateAccountScreen() {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  const router = useRouter();
  const { createAccount } = useAuth();
  const { theme } = useTheme();

  // Log component mount
  React.useEffect(() => {
    logger.info('CreateAccount', 'Component mounted');
    logger.debug('CreateAccount', 'Current theme', {
      background: theme.colors.background,
      text: theme.colors.text,
      primary: theme.colors.primary,
      border: theme.colors.border,
      surface: theme.colors.surface
    });
    return () => {
      logger.info('CreateAccount', 'Component unmounting');
    };
  }, [theme]);

  // Log form field changes
  const handleUsernameChange = (text: string) => {
    logger.debug('CreateAccount', 'Username changed', { 
      from: username, 
      to: text, 
      length: text.length 
    });
    setUsername(text);
  };

  const handleEmailChange = (text: string) => {
    logger.debug('CreateAccount', 'Email changed', { 
      from: email, 
      to: text 
    });
    setEmail(text);
  };

  const handlePasswordChange = (text: string) => {
    logger.debug('CreateAccount', 'Password changed', { 
      length: text.length,
      hasSpecialChars: /[!@#$%^&*(),.?":{}|<>]/.test(text),
      hasNumbers: /\d/.test(text)
    });
    setPassword(text);
  };

  const handleConfirmPasswordChange = (text: string) => {
    logger.debug('CreateAccount', 'Confirm password changed', { 
      length: text.length,
      matchesPassword: text === password
    });
    setConfirmPassword(text);
  };

  const validateForm = () => {
    logger.info('CreateAccount', 'Starting form validation');
    logger.debug('CreateAccount', 'Form data', { 
      username: username.trim(), 
      email: email.trim(), 
      passwordLength: password.length,
      confirmPasswordLength: confirmPassword.length 
    });

    if (!username.trim()) {
      logger.warn('CreateAccount', 'Validation failed: Username is empty');
      Alert.alert('Error', 'Please enter a username');
      return false;
    }
    
    if (username.trim().length < 3) {
      logger.warn('CreateAccount', 'Validation failed: Username too short', { length: username.trim().length });
      Alert.alert('Error', 'Username must be at least 3 characters long');
      return false;
    }
    
    if (!email.trim()) {
      logger.warn('CreateAccount', 'Validation failed: Email is empty');
      Alert.alert('Error', 'Please enter an email address');
      return false;
    }
    
    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      logger.warn('CreateAccount', 'Validation failed: Invalid email format', { email: email.trim() });
      Alert.alert('Error', 'Please enter a valid email address');
      return false;
    }
    
    if (!password) {
      logger.warn('CreateAccount', 'Validation failed: Password is empty');
      Alert.alert('Error', 'Please enter a password');
      return false;
    }
    
    if (password.length < 6) {
      logger.warn('CreateAccount', 'Validation failed: Password too short', { length: password.length });
      Alert.alert('Error', 'Password must be at least 6 characters long');
      return false;
    }
    
    if (password !== confirmPassword) {
      logger.warn('CreateAccount', 'Validation failed: Passwords do not match');
      Alert.alert('Error', 'Passwords do not match');
      return false;
    }
    
    logger.info('CreateAccount', 'Form validation successful');
    return true;
  };

  const handleCreateAccount = async () => {
    logger.userAction('CreateAccount', 'Create account button pressed');
    
    if (!validateForm()) {
      logger.warn('CreateAccount', 'Form validation failed, aborting account creation');
      return;
    }

    logger.info('CreateAccount', 'Starting account creation process');
    logger.debug('CreateAccount', 'Account details', {
      username: username.trim(),
      email: email.trim(),
      passwordLength: password.length,
      timestamp: new Date().toISOString()
    });

    logger.debug('CreateAccount', 'Setting loading state to true');
    setIsLoading(true);
    
    try {
      logger.info('CreateAccount', 'Calling createAccount API');
      const startTime = Date.now();
      const success = await createAccount(username.trim(), password, email.trim());
      const endTime = Date.now();
      
      logger.info('CreateAccount', 'API call completed', { duration: endTime - startTime });
      
      if (success) {
        logger.info('CreateAccount', 'Account creation successful, navigating to tabs');
        // Navigation will be handled by the auth context
        router.replace('/(tabs)');
      } else {
        logger.warn('CreateAccount', 'Account creation failed - API returned false');
        Alert.alert('Account Creation Failed', 'Username or email may already exist or an error occurred');
      }
    } catch (error) {
      logger.error('CreateAccount', 'Error during account creation', {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        timestamp: new Date().toISOString()
      });
      Alert.alert('Error', 'An error occurred while creating your account');
    } finally {
      logger.debug('CreateAccount', 'Account creation process completed, setting loading to false');
      setIsLoading(false);
    }
  };

  const goToLogin = () => {
    logger.navigation('CreateAccount', 'create-account', 'login');
    router.push('/auth/login');
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
    createButton: {
      backgroundColor: '#34C759',
      borderRadius: 8,
      paddingVertical: 16,
      alignItems: 'center',
      marginTop: 20,
      marginBottom: 20,
    },
    createButtonText: {
      color: '#ffffff',
      fontSize: 18,
      fontWeight: '600',
    },
    loginButton: {
      paddingVertical: 16,
      alignItems: 'center',
    },
    loginText: {
      color: theme.colors.primary,
      fontSize: 16,
    },
    disabledButton: {
      backgroundColor: '#cccccc',
    },
  });

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Create Account</Text>
        
        <View style={styles.inputContainer}>
          <Text style={styles.label}>Username</Text>
          <TextInput
            style={styles.input}
            value={username}
            onChangeText={handleUsernameChange}
            placeholder="Choose a username"
            placeholderTextColor={theme.colors.textSecondary}
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>

        <View style={styles.inputContainer}>
          <Text style={styles.label}>Email</Text>
          <TextInput
            style={styles.input}
            value={email}
            onChangeText={handleEmailChange}
            placeholder="Enter your email address"
            placeholderTextColor={theme.colors.textSecondary}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
          />
        </View>

        <View style={styles.inputContainer}>
          <Text style={styles.label}>Password</Text>
          <TextInput
            style={styles.input}
            value={password}
            onChangeText={handlePasswordChange}
            placeholder="Choose a password"
            placeholderTextColor={theme.colors.textSecondary}
            secureTextEntry
            autoCapitalize="none"
          />
        </View>

        <View style={styles.inputContainer}>
          <Text style={styles.label}>Confirm Password</Text>
          <TextInput
            style={styles.input}
            value={confirmPassword}
            onChangeText={handleConfirmPasswordChange}
            placeholder="Confirm your password"
            placeholderTextColor={theme.colors.textSecondary}
            secureTextEntry
            autoCapitalize="none"
          />
        </View>

        <TouchableOpacity
          style={[styles.createButton, isLoading && styles.disabledButton]}
          onPress={handleCreateAccount}
          disabled={isLoading}
        >
          <Text style={styles.createButtonText}>
            {isLoading ? 'Creating Account...' : 'Create Account'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.loginButton}
          onPress={goToLogin}
        >
          <Text style={styles.loginText}>
            Already have an account? Login
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

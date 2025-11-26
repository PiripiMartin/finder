import { useLocalSearchParams, useRouter } from 'expo-router';
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
import { buildApiUrl } from '../config/api';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useTutorial } from '../context/TutorialContext';
import { getCurrentLocation, getDefaultCoordinates } from '../utils/location';

export default function ResetPasswordScreen() {
  const params = useLocalSearchParams<{
    identifierType: string;
    identifier: string;
    code: string;
  }>();
  
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  const router = useRouter();
  const { login } = useAuth();
  const { theme } = useTheme();
  const { recheckTutorialAfterLogin } = useTutorial();

  const identifierType = params.identifierType as 'username' | 'email';
  const identifier = params.identifier as string;
  const code = params.code as string;

  const validatePassword = (): boolean => {
    if (!newPassword.trim()) {
      Alert.alert('Error', 'Please enter a new password');
      return false;
    }

    if (newPassword.length < 6) {
      Alert.alert('Error', 'Password must be at least 6 characters long');
      return false;
    }

    if (newPassword !== confirmPassword) {
      Alert.alert('Error', 'Passwords do not match');
      return false;
    }

    return true;
  };

  const handleResetPassword = async () => {
    if (!validatePassword()) {
      return;
    }

    setIsLoading(true);
    try {
      const requestBody = {
        ...(identifierType === 'username' ? { username: identifier } : { email: identifier }),
        challengeCode: code,
        newPassword: newPassword.trim(),
      };

      const response = await fetch(buildApiUrl('/password-reset/complete'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      if (response.ok) {
        const data = await response.json();
        
        if (data.success) {
          // Password reset successful, now auto-login the user
          try {
            // Get user's location for login
            let coordinates = await getCurrentLocation();
            if (!coordinates) {
              coordinates = getDefaultCoordinates();
            }

            // Attempt login with the identifier (username or email) and new password
            // Note: The login function expects username, but we might have email
            // We'll use identifier as username for now - this works if user provided username
            const loginIdentifier = identifierType === 'username' ? identifier : identifier;
            const loginSuccess = await login(loginIdentifier, newPassword.trim(), coordinates);

            if (loginSuccess) {
              // Recheck tutorial state after successful login
              await recheckTutorialAfterLogin();
              
              Alert.alert(
                'Success',
                'Your password has been reset successfully!',
                [
                  {
                    text: 'OK',
                    onPress: () => {
                      // Navigate to main app
                      router.replace('/(tabs)');
                    },
                  },
                ]
              );
            } else {
              // Login failed, but password was reset - send to login screen
              Alert.alert(
                'Password Reset',
                'Your password has been reset successfully. Please log in.',
                [
                  {
                    text: 'OK',
                    onPress: () => {
                      router.replace('/auth/login');
                    },
                  },
                ]
              );
            }
          } catch (loginError) {
            console.error('Error during auto-login:', loginError);
            // If auto-login fails, still inform user of successful reset
            Alert.alert(
              'Password Reset',
              'Your password has been reset successfully. Please log in.',
              [
                {
                  text: 'OK',
                  onPress: () => {
                    router.replace('/auth/login');
                  },
                },
              ]
            );
          }
        }
      } else {
        const errorText = await response.text();
        
        // Handle specific error cases
        if (response.status === 401) {
          Alert.alert(
            'Invalid Code',
            'The verification code is invalid or has expired. Please request a new code.',
            [
              {
                text: 'Request New Code',
                onPress: () => {
                  router.back();
                  router.back();
                },
              },
              { text: 'Cancel', style: 'cancel' },
            ]
          );
        } else if (response.status === 404) {
          Alert.alert('Error', 'User not found. Please check your credentials.');
        } else {
          Alert.alert('Error', errorText || 'Failed to reset password. Please try again.');
        }
      }
    } catch (error) {
      console.error('Error resetting password:', error);
      Alert.alert('Error', 'An error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const goBack = () => {
    router.back();
  };

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    content: {
      flexGrow: 1,
      padding: 20,
      justifyContent: 'center',
    },
    title: {
      fontSize: 28,
      fontWeight: 'bold',
      color: theme.colors.text,
      marginBottom: 10,
      textAlign: 'center',
    },
    subtitle: {
      fontSize: 16,
      color: theme.colors.textSecondary,
      marginBottom: 30,
      textAlign: 'center',
    },
    inputContainer: {
      marginBottom: 20,
    },
    label: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.colors.text,
      marginBottom: 8,
    },
    input: {
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: 8,
      padding: 12,
      fontSize: 16,
      color: theme.colors.text,
      backgroundColor: theme.colors.surface,
      letterSpacing: 0,
    },
    resetButton: {
      backgroundColor: theme.colors.primary,
      padding: 16,
      borderRadius: 8,
      alignItems: 'center',
      marginTop: 10,
    },
    disabledButton: {
      opacity: 0.6,
    },
    resetButtonText: {
      color: '#FFFFFF',
      fontSize: 18,
      fontWeight: '600',
    },
    backButton: {
      marginTop: 20,
      alignItems: 'center',
    },
    backButtonText: {
      color: theme.colors.textSecondary,
      fontSize: 16,
    },
    passwordRequirements: {
      fontSize: 14,
      color: theme.colors.textSecondary,
      marginTop: 5,
      marginLeft: 4,
    },
  });

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Reset Password</Text>
        <Text style={styles.subtitle}>
          Enter your new password
        </Text>

        <View style={styles.inputContainer}>
          <Text style={styles.label}>New Password</Text>
          <TextInput
            style={styles.input}
            value={newPassword}
            onChangeText={setNewPassword}
            placeholder="Enter new password"
            placeholderTextColor={theme.colors.textSecondary}
            secureTextEntry
            autoCapitalize="none"
          />
          <Text style={styles.passwordRequirements}>
            Must be at least 6 characters
          </Text>
        </View>

        <View style={styles.inputContainer}>
          <Text style={styles.label}>Confirm Password</Text>
          <TextInput
            style={styles.input}
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            placeholder="Confirm new password"
            placeholderTextColor={theme.colors.textSecondary}
            secureTextEntry
            autoCapitalize="none"
          />
        </View>

        <TouchableOpacity
          style={[styles.resetButton, isLoading && styles.disabledButton]}
          onPress={handleResetPassword}
          disabled={isLoading}
        >
          <Text style={styles.resetButtonText}>
            {isLoading ? 'Resetting Password...' : 'Reset Password'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.backButton}
          onPress={goBack}
        >
          <Text style={styles.backButtonText}>
            Back
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}


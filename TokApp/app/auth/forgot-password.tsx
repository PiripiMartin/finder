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
import { buildApiUrl } from '../config/api';
import { useTheme } from '../context/ThemeContext';

type IdentifierType = 'username' | 'email';

export default function ForgotPasswordScreen() {
  const [identifierType, setIdentifierType] = useState<IdentifierType>('email');
  const [identifier, setIdentifier] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  const router = useRouter();
  const { theme } = useTheme();

  const handleSendCode = async () => {
    if (!identifier.trim()) {
      Alert.alert('Error', `Please enter your ${identifierType}`);
      return;
    }

    // Basic email validation if email is selected
    if (identifierType === 'email' && !identifier.includes('@')) {
      Alert.alert('Error', 'Please enter a valid email address');
      return;
    }

    setIsLoading(true);
    try {
      const requestBody = identifierType === 'username' 
        ? { username: identifier.trim() }
        : { email: identifier.trim() };

      const response = await fetch(buildApiUrl('/password-reset'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      if (response.ok) {
        const data = await response.json();
        
        if (data.success) {
          // Navigate to verify code screen
          router.push({
            pathname: '/auth/verify-code',
            params: {
              identifierType,
              identifier: identifier.trim(),
            },
          });
        } else if (data.error) {
          // Handle email sending failure
          Alert.alert('Error', data.error);
        }
      } else {
        const errorText = await response.text();
        Alert.alert('Error', errorText || 'Failed to send reset code. Please try again.');
      }
    } catch (error) {
      console.error('Error sending reset code:', error);
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
    selectorContainer: {
      flexDirection: 'row',
      marginBottom: 20,
      borderRadius: 8,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    selectorButton: {
      flex: 1,
      paddingVertical: 12,
      alignItems: 'center',
      backgroundColor: theme.colors.surface,
    },
    selectorButtonActive: {
      backgroundColor: theme.colors.primary,
    },
    selectorButtonText: {
      fontSize: 16,
      color: theme.colors.text,
      fontWeight: '500',
    },
    selectorButtonTextActive: {
      color: '#FFFFFF',
      fontWeight: '600',
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
    sendButton: {
      backgroundColor: theme.colors.primary,
      padding: 16,
      borderRadius: 8,
      alignItems: 'center',
      marginTop: 10,
    },
    disabledButton: {
      opacity: 0.6,
    },
    sendButtonText: {
      color: '#FFFFFF',
      fontSize: 18,
      fontWeight: '600',
    },
    backButton: {
      marginTop: 20,
      alignItems: 'center',
    },
    backButtonText: {
      color: theme.colors.primary,
      fontSize: 16,
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
          Enter your username or email to receive a verification code
        </Text>

        <View style={styles.selectorContainer}>
          <TouchableOpacity
            style={[
              styles.selectorButton,
              identifierType === 'email' && styles.selectorButtonActive,
            ]}
            onPress={() => {
              setIdentifierType('email');
              setIdentifier('');
            }}
          >
            <Text
              style={[
                styles.selectorButtonText,
                identifierType === 'email' && styles.selectorButtonTextActive,
              ]}
            >
              Email
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.selectorButton,
              identifierType === 'username' && styles.selectorButtonActive,
            ]}
            onPress={() => {
              setIdentifierType('username');
              setIdentifier('');
            }}
          >
            <Text
              style={[
                styles.selectorButtonText,
                identifierType === 'username' && styles.selectorButtonTextActive,
              ]}
            >
              Username
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.inputContainer}>
          <Text style={styles.label}>
            {identifierType === 'email' ? 'Email Address' : 'Username'}
          </Text>
          <TextInput
            style={styles.input}
            value={identifier}
            onChangeText={setIdentifier}
            placeholder={`Enter your ${identifierType}`}
            placeholderTextColor={theme.colors.textSecondary}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType={identifierType === 'email' ? 'email-address' : 'default'}
          />
        </View>

        <TouchableOpacity
          style={[styles.sendButton, isLoading && styles.disabledButton]}
          onPress={handleSendCode}
          disabled={isLoading}
        >
          <Text style={styles.sendButtonText}>
            {isLoading ? 'Sending Code...' : 'Send Code'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.backButton}
          onPress={goBack}
        >
          <Text style={styles.backButtonText}>
            Back to Login
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}


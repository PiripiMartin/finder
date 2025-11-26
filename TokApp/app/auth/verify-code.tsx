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
import { useTheme } from '../context/ThemeContext';

export default function VerifyCodeScreen() {
  const params = useLocalSearchParams<{ identifierType: string; identifier: string }>();
  const [code, setCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isResending, setIsResending] = useState(false);
  
  const router = useRouter();
  const { theme } = useTheme();

  const identifierType = params.identifierType as 'username' | 'email';
  const identifier = params.identifier as string;

  const handleVerifyCode = async () => {
    if (!code.trim() || code.trim().length !== 6) {
      Alert.alert('Error', 'Please enter the 6-digit code');
      return;
    }

    setIsLoading(true);
    try {
      // For now, we just verify the code format and navigate to reset password
      // The actual validation will happen when the user submits the new password
      router.push({
        pathname: '/auth/reset-password',
        params: {
          identifierType,
          identifier,
          code: code.trim(),
        },
      });
    } catch (error) {
      console.error('Error verifying code:', error);
      Alert.alert('Error', 'An error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendCode = async () => {
    setIsResending(true);
    try {
      const requestBody = identifierType === 'username' 
        ? { username: identifier }
        : { email: identifier };

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
          Alert.alert('Success', 'A new code has been sent to your email');
          setCode('');
        } else if (data.error) {
          Alert.alert('Error', data.error);
        }
      } else {
        const errorText = await response.text();
        Alert.alert('Error', errorText || 'Failed to resend code. Please try again.');
      }
    } catch (error) {
      console.error('Error resending code:', error);
      Alert.alert('Error', 'An error occurred. Please try again.');
    } finally {
      setIsResending(false);
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
      marginBottom: 10,
      textAlign: 'center',
    },
    identifierText: {
      fontSize: 16,
      color: theme.colors.text,
      fontWeight: '600',
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
      fontSize: 24,
      color: theme.colors.text,
      backgroundColor: theme.colors.surface,
      textAlign: 'center',
      letterSpacing: 8,
    },
    verifyButton: {
      backgroundColor: theme.colors.primary,
      padding: 16,
      borderRadius: 8,
      alignItems: 'center',
      marginTop: 10,
    },
    disabledButton: {
      opacity: 0.6,
    },
    verifyButtonText: {
      color: '#FFFFFF',
      fontSize: 18,
      fontWeight: '600',
    },
    resendButton: {
      marginTop: 20,
      alignItems: 'center',
    },
    resendButtonText: {
      color: theme.colors.primary,
      fontSize: 16,
    },
    backButton: {
      marginTop: 15,
      alignItems: 'center',
    },
    backButtonText: {
      color: theme.colors.textSecondary,
      fontSize: 16,
    },
  });

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Verify Code</Text>
        <Text style={styles.subtitle}>
          We sent a 6-digit code to
        </Text>
        <Text style={styles.identifierText}>
          {identifier}
        </Text>

        <View style={styles.inputContainer}>
          <Text style={styles.label}>Verification Code</Text>
          <TextInput
            style={styles.input}
            value={code}
            onChangeText={(text) => {
              // Only allow numbers and limit to 6 digits
              const numericText = text.replace(/[^0-9]/g, '');
              setCode(numericText.slice(0, 6));
            }}
            placeholder="000000"
            placeholderTextColor={theme.colors.textSecondary}
            keyboardType="number-pad"
            maxLength={6}
          />
        </View>

        <TouchableOpacity
          style={[styles.verifyButton, isLoading && styles.disabledButton]}
          onPress={handleVerifyCode}
          disabled={isLoading}
        >
          <Text style={styles.verifyButtonText}>
            {isLoading ? 'Verifying...' : 'Verify Code'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.resendButton}
          onPress={handleResendCode}
          disabled={isResending}
        >
          <Text style={styles.resendButtonText}>
            {isResending ? 'Resending...' : "Didn't receive a code? Resend"}
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


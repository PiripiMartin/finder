import React from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

interface AuthWrapperProps {
  children: React.ReactNode;
}

export default function AuthWrapper({ children }: AuthWrapperProps) {
  const { isAuthenticated, isLoading } = useAuth();
  const { theme } = useTheme();

  if (isLoading) {
    return (
      <View style={[
        styles.loadingContainer,
        { backgroundColor: theme === 'dark' ? '#1a1a1a' : '#FFFFFF' }
      ]}>
        <ActivityIndicator 
          size="large" 
          color={theme === 'dark' ? '#4E8886' : '#4E8886'} 
        />
      </View>
    );
  }

  if (!isAuthenticated) {
    // This will be handled by the router, but we can return null here
    return null;
  }

  return <>{children}</>;
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

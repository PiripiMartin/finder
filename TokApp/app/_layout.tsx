import { Stack, useRouter } from "expo-router";
import { useEffect } from 'react';
import { Linking, LogBox } from 'react-native';
import { ErrorBoundary } from './components/ErrorBoundary';
import { AuthProvider } from './context/AuthContext';
import { LocationProvider } from './context/LocationContext';
import { ThemeProvider } from './context/ThemeContext';
import { DeepLinkHandler } from './utils/deepLinkHandler';

export default function RootLayout() {
  const router = useRouter();

  useEffect(() => {
    // Ignore specific warnings that can cause crashes on iOS
    LogBox.ignoreLogs([
      'Non-serializable values were found in the navigation state',
      'AsyncStorage has been extracted from react-native core',
      'ViewPropTypes will be removed from React Native',
      'ColorPropType will be removed from React Native',
    ]);

    // Handle deep links when app is already running
    const handleDeepLink = async (url: string) => {
      try {
        console.log('Deep link received:', url);
        
        // Use the DeepLinkHandler to parse and handle TikTok shares
        await DeepLinkHandler.handleTikTokShare(url);
      } catch (error) {
        console.error('Error handling deep link:', error);
      }
    };

    // Listen for incoming links
    const subscription = Linking.addEventListener('url', (event) => {
      handleDeepLink(event.url);
    });

    // Handle initial URL if app was opened via deep link
    Linking.getInitialURL().then((url) => {
      if (url) {
        handleDeepLink(url);
      }
    });

    return () => {
      subscription.remove();
    };
  }, []);

  return (
    <ErrorBoundary>
      <ThemeProvider>
        <AuthProvider>
          <LocationProvider>
            <Stack screenOptions={{ headerShown: false }}>
              <Stack.Screen name="(tabs)" />
              <Stack.Screen name="_location" />
              <Stack.Screen name="auth" />
            </Stack>
          </LocationProvider>
        </AuthProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

import { Stack, useRouter } from "expo-router";
import { useEffect } from 'react';
import { Linking } from 'react-native';
import { AuthProvider } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { DeepLinkHandler } from './utils/deepLinkHandler';

export default function RootLayout() {
  const router = useRouter();

  useEffect(() => {
    // Handle deep links when app is already running
    const handleDeepLink = async (url: string) => {
      console.log('Deep link received:', url);
      
      // Use the DeepLinkHandler to parse and handle TikTok shares
      await DeepLinkHandler.handleTikTokShare(url);
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
    <ThemeProvider>
      <AuthProvider>
        <Stack 
          screenOptions={{ 
            headerShown: false,
            animation: 'slide_from_left',
          }}
        >
          <Stack.Screen name="auth" />
          <Stack.Screen name="(tabs)" />
          <Stack.Screen 
            name="_location" 
            options={{
              animation: 'slide_from_left',
            }}
          />
        </Stack>
      </AuthProvider>
    </ThemeProvider>
  );
}

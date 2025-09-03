import { Stack, useRouter } from "expo-router";
import { useEffect, useRef } from 'react';
import { AppState, Linking, LogBox } from 'react-native';
import { ErrorBoundary } from './components/ErrorBoundary';
import { AuthProvider } from './context/AuthContext';
import { LocationProvider, useLocationContext } from './context/LocationContext';
import { ShareProvider } from './context/ShareContext';
import { ThemeProvider } from './context/ThemeContext';
import { TutorialProvider } from './context/TutorialContext';
import { DeepLinkHandler } from './utils/deepLinkHandler';

// Component to handle app state changes with access to LocationContext
function AppStateHandler() {
  const { refreshLocations } = useLocationContext();
  const appState = useRef(AppState.currentState);

  useEffect(() => {
    const handleAppStateChange = (nextAppState: any) => {
      if (appState.current.match(/inactive|background/) && nextAppState === 'active') {
        console.log('🔄 [AppStateHandler] App has come to the foreground, triggering refresh');
        refreshLocations();
      }
      appState.current = nextAppState;
    };

    const appStateListener = AppState.addEventListener('change', handleAppStateChange);

    return () => {
      appStateListener.remove();
    };
  }, [refreshLocations]);

  return null; // This component doesn't render anything
}

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

  // Moved app state handling to separate component that has access to LocationContext

  return (
    <ErrorBoundary>
      <ThemeProvider>
        <AuthProvider>
          <TutorialProvider>
            <LocationProvider>
              <AppStateHandler />
              <ShareProvider>
                <Stack screenOptions={{ headerShown: false }}>
                  <Stack.Screen name="(tabs)" />
                  <Stack.Screen name="_location" />
                  <Stack.Screen name="auth" />
                </Stack>
              </ShareProvider>
            </LocationProvider>
          </TutorialProvider>
        </AuthProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

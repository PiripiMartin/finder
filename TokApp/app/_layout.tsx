import { Stack, useRouter } from "expo-router";
import { useEffect, useRef } from 'react';
import { AppState, Linking, LogBox } from 'react-native';
import { ErrorBoundary } from './components/ErrorBoundary';
import { AuthProvider, useAuth } from './context/AuthContext';
import { LocationProvider, useLocationContext } from './context/LocationContext';
import { ShareProvider } from './context/ShareContext';
import { ThemeProvider } from './context/ThemeContext';
import { TutorialProvider } from './context/TutorialContext';
import { DeepLinkHandler } from './utils/deepLinkHandler';

// Component to handle app state changes with access to LocationContext and AuthContext
function AppStateHandler() {
  const { refreshLocations } = useLocationContext();
  const appState = useRef(AppState.currentState);

  useEffect(() => {
    const handleAppStateChange = (nextAppState: any) => {
      if (appState.current.match(/inactive|background/) && nextAppState === 'active') {
        console.log('🔄 [AppStateHandler] App has come to the foreground, triggering refresh');
        refreshLocations();
        // Note: Authentication status is already checked continuously through the AuthContext
        // The AuthProvider automatically handles token validation on app startup
        // Additional auth checks on foreground would be handled by individual screens as needed
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

// Component to handle deep links with access to AuthContext
function DeepLinkListener() {
  const { sessionToken } = useAuth();
  const router = useRouter();

  useEffect(() => {
    const handleDeepLink = async (url: string) => {
      try {
        console.log('🔗 [DeepLinkListener] Deep link received:', url);
        
        // Check if it's a folder share link first
        if (url.startsWith('lai://folder/')) {
          // Navigate to a valid route first to prevent unmatched route error
          router.replace('/(tabs)');
          
          // Then show the folder follow dialog after a brief delay
          setTimeout(() => {
            DeepLinkHandler.handleFolderShare(url, sessionToken, router);
          }, 300);
          return true;
        }
        
        // Use the DeepLinkHandler to parse and handle TikTok shares
        await DeepLinkHandler.handleTikTokShare(url);
        return false;
      } catch (error) {
        console.error('❌ [DeepLinkListener] Error handling deep link:', error);
        return false;
      }
    };

    // Check initial URL immediately
    Linking.getInitialURL().then((url) => {
      if (url && url.startsWith('lai://folder/')) {
        handleDeepLink(url);
      }
    });

    // Listen for incoming links
    const subscription = Linking.addEventListener('url', (event) => {
      handleDeepLink(event.url);
    });

    return () => {
      subscription.remove();
    };
  }, [sessionToken, router]);

  return null;
}

export default function RootLayout() {
  useEffect(() => {
    // Ignore specific warnings that can cause crashes on iOS
    LogBox.ignoreLogs([
      'Non-serializable values were found in the navigation state',
      'AsyncStorage has been extracted from react-native core',
      'ViewPropTypes will be removed from React Native',
      'ColorPropType will be removed from React Native',
      'Unmatched Route',
    ]);
  }, []);

  return (
    <ErrorBoundary>
      <ThemeProvider>
        <AuthProvider>
          <TutorialProvider>
            <LocationProvider>
              <DeepLinkListener />
              <AppStateHandler />
              <ShareProvider>
                <Stack 
                  screenOptions={{ headerShown: false }}
                >
                  <Stack.Screen name="index" />
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





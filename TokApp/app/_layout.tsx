import { Stack, useRouter } from "expo-router";
import { useEffect, useRef, useState } from 'react';
import { AppState, Linking, LogBox } from 'react-native';
import { ErrorBoundary } from './components/ErrorBoundary';
import { AuthProvider, useAuth } from './context/AuthContext';
import { LocationProvider, useLocationContext } from './context/LocationContext';
import { ShareProvider } from './context/ShareContext';
import { ThemeProvider } from './context/ThemeContext';
import { TutorialProvider } from './context/TutorialContext';
import { DeepLinkHandler } from './utils/deepLinkHandler';
import NotificationModal from './components/NotificationModal';
import { API_CONFIG } from './config/api';

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
          console.log('📂 [DeepLinkListener] Detected folder share link');
          
          // Wait a bit to ensure the app is ready, then navigate to tabs
          setTimeout(() => {
            console.log('📂 [DeepLinkListener] Navigating to main app');
            router.replace('/(tabs)');
            
            // Then show the folder follow dialog after a brief delay
            setTimeout(() => {
              console.log('📂 [DeepLinkListener] Handling folder share');
              DeepLinkHandler.handleFolderShare(url, sessionToken, router);
            }, 500);
          }, 100);
          return true;
        }
        
        // Check if it's a TikTok share link
        if (url.includes('tiktok.com') || url.includes('vm.tiktok.com')) {
          console.log('🎵 [DeepLinkListener] Detected TikTok share link');
          await DeepLinkHandler.handleTikTokShare(url);
          return true;
        }
        
        // For any other deep link, navigate to main app
        console.log('🔗 [DeepLinkListener] Unknown deep link format, navigating to main app');
        router.replace('/(tabs)');
        return false;
      } catch (error) {
        console.error('❌ [DeepLinkListener] Error handling deep link:', error);
        // On error, try to navigate to a safe route
        try {
          router.replace('/(tabs)');
        } catch (navError) {
          console.error('❌ [DeepLinkListener] Failed to navigate to fallback route:', navError);
        }
        return false;
      }
    };

    // Check initial URL when app opens from a deep link
    Linking.getInitialURL().then((url) => {
      if (url) {
        console.log('🔗 [DeepLinkListener] Initial URL:', url);
        // Only handle custom scheme URLs (lai://)
        if (url.startsWith('lai://')) {
          handleDeepLink(url);
        }
      }
    }).catch((error) => {
      console.error('❌ [DeepLinkListener] Error getting initial URL:', error);
    });

    // Listen for incoming links while app is running
    const subscription = Linking.addEventListener('url', (event) => {
      console.log('🔗 [DeepLinkListener] URL event:', event.url);
      // Only handle custom scheme URLs (lai://)
      if (event.url.startsWith('lai://')) {
        handleDeepLink(event.url);
      }
    });

    return () => {
      subscription.remove();
    };
  }, [sessionToken, router]);

  return null;
}

// Component to handle notifications with access to AuthContext
function NotificationHandler() {
  const { sessionToken, isAuthenticated } = useAuth();
  const [notifications, setNotifications] = useState<any[]>([]);
  const [showModal, setShowModal] = useState(false);

  // Fetch notifications when user is authenticated
  useEffect(() => {
    if (isAuthenticated && sessionToken) {
      fetchNotifications();
    }
  }, [isAuthenticated, sessionToken]);

  const fetchNotifications = async () => {
    try {
      console.log('🔔 [NotificationHandler] Fetching notifications...');
      
      const response = await fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.NOTIFICATIONS}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${sessionToken}`,
        },
      });

      if (!response.ok) {
        console.log('🔔 [NotificationHandler] Failed to fetch notifications:', response.status);
        return;
      }

      const data = await response.json();
      console.log('🔔 [NotificationHandler] Fetched notifications:', data.length);
      
      if (data && data.length > 0) {
        setNotifications(data);
        setShowModal(true);
      }
    } catch (error) {
      console.error('🔔 [NotificationHandler] Error fetching notifications:', error);
      // Silently fail - don't block app startup
    }
  };

  const handleDismiss = async (notificationIds: number[]) => {
    console.log('🔔 [NotificationHandler] Marking notifications as seen:', notificationIds);
    
    // Close modal immediately
    setShowModal(false);
    setNotifications([]);

    // Send mark as seen request (fire and forget)
    try {
      fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.NOTIFICATIONS_SEEN}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${sessionToken}`,
        },
        body: JSON.stringify({ notificationIds }),
      }).then(() => {
        console.log('🔔 [NotificationHandler] Notifications marked as seen');
      }).catch((error) => {
        console.error('🔔 [NotificationHandler] Error marking notifications as seen:', error);
      });
    } catch (error) {
      console.error('🔔 [NotificationHandler] Error in mark as seen:', error);
    }
  };

  return (
    <NotificationModal
      visible={showModal}
      notifications={notifications}
      onDismiss={handleDismiss}
    />
  );
}

export default function RootLayout() {
  useEffect(() => {
    // Ignore specific warnings that can cause crashes on iOS
    LogBox.ignoreLogs([
      'Non-serializable values were found in the navigation state',
      'AsyncStorage has been extracted from react-native core',
      'ViewPropTypes will be removed from React Native',
      'ColorPropType will be removed from React Native',
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
              <NotificationHandler />
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





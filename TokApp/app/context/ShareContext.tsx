import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import React, { createContext, useContext, useEffect, useState } from 'react';
import { Alert, AppState, Platform } from 'react-native';
import ShareMenu from 'react-native-share-menu';
import ShareExtensionBridge from '../utils/ShareExtensionBridge';

interface ShareContextType {
  sharedContent: any | null;
  isProcessingShare: boolean;
  clearSharedContent: () => void;
  handleSharedContent: (content: any) => void;
}

const ShareContext = createContext<ShareContextType | undefined>(undefined);

export function ShareProvider({ children }: { children: React.ReactNode }) {
  const [sharedContent, setSharedContent] = useState<any | null>(null);
  const [isProcessingShare, setIsProcessingShare] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const handleShare = (share: any) => {
      console.log('📤 [ShareContext] Received share:', share);
      if (share && (share.data || share.mimeType)) {
        handleSharedContent(share);
      }
    };

    // Check for data from share extension
    const checkShareExtensionData = async () => {
      try {
        if (Platform.OS === 'ios' && ShareExtensionBridge) {
          // Use native bridge to get data from UserDefaults
          const sharedData = await ShareExtensionBridge.getSharedData();
          if (sharedData && typeof sharedData === 'object') {
            console.log('📤 [ShareContext] Found share extension data:', sharedData);
            handleSharedContent(sharedData);
          }
        }
        
        // Fallback to AsyncStorage for Android or if native bridge fails
        const sharedDataStr = await AsyncStorage.getItem('SharedExtensionData');
        if (sharedDataStr) {
          const sharedData = JSON.parse(sharedDataStr);
          console.log('📤 [ShareContext] Found share extension data (AsyncStorage):', sharedData);
          await AsyncStorage.removeItem('SharedExtensionData');
          handleSharedContent(sharedData);
        }
      } catch (error) {
        console.error('Error checking share extension data:', error);
      }
    };

    // Check immediately and when app becomes active
    checkShareExtensionData();
    
    const handleAppStateChange = (nextAppState: string) => {
      if (nextAppState === 'active') {
        checkShareExtensionData();
      }
    };

    ShareMenu.getInitialShare(handleShare);
    const listener = ShareMenu.addNewShareListener(handleShare);
    const appStateListener = AppState.addEventListener('change', handleAppStateChange);

    return () => {
      listener.remove();
      appStateListener.remove();
    };
  }, []);

  const handleSharedContent = async (content: any) => {
    setIsProcessingShare(true);
    
    try {
      console.log('🔄 [ShareContext] Processing shared content:', content);
      
      // Extract URL from different possible formats
      let sharedUrl = null;
      let sharedText = null;
      
      if (content.data) {
        // react-native-share-menu format
        if (typeof content.data === 'string') {
          if (content.data.includes('http')) {
            const urlMatch = content.data.match(/(https?:\/\/[^\s]+)/);
            if (urlMatch) {
              sharedUrl = urlMatch[1];
              sharedText = content.data;
            }
          } else {
            sharedText = content.data;
          }
        } else {
          sharedUrl = content.data;
        }
      } else if (content.url) {
        sharedUrl = content.url;
      } else if (content.text && content.text.includes('http')) {
        // Extract URL from text
        const urlMatch = content.text.match(/(https?:\/\/[^\s]+)/);
        if (urlMatch) {
          sharedUrl = urlMatch[1];
          sharedText = content.text;
        }
      } else if (content.text) {
        sharedText = content.text;
      }
      
      // Check if it's a TikTok URL
      const isTikTokUrl = sharedUrl && (
        sharedUrl.includes('tiktok.com') || 
        sharedUrl.includes('vm.tiktok.com') ||
        sharedUrl.includes('vt.tiktok.com')
      );
      
      const processedContent = {
        ...content,
        url: sharedUrl,
        text: sharedText,
        isTikTokUrl,
        timestamp: Date.now()
      };
      
      setSharedContent(processedContent);
      
      // Show confirmation to user
      Alert.alert(
        'Content Shared',
        isTikTokUrl 
          ? 'TikTok video received! You can now add it to a location on the map.'
          : 'Content received! You can now use it in the app.',
        [
          {
            text: 'OK',
            onPress: () => {
              // Navigate to the map view
              router.replace('/(tabs)');
            }
          }
        ]
      );
      
      console.log('✅ [ShareContext] Shared content processed:', processedContent);
      
    } catch (error) {
      console.error('❌ [ShareContext] Error processing shared content:', error);
      Alert.alert(
        'Error',
        'Failed to process shared content. Please try again.',
        [{ text: 'OK' }]
      );
    } finally {
      setIsProcessingShare(false);
    }
  };

  const clearSharedContent = () => {
    setSharedContent(null);
  };

  const value: ShareContextType = {
    sharedContent,
    isProcessingShare,
    clearSharedContent,
    handleSharedContent,
  };

  return (
    <ShareContext.Provider value={value}>
      {children}
    </ShareContext.Provider>
  );
}

export function useShare() {
  const context = useContext(ShareContext);
  if (context === undefined) {
    throw new Error('useShare must be used within a ShareProvider');
  }
  return context;
}

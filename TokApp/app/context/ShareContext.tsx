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
      console.log('🔍 [ShareContext] Checking for share extension data...');
      try {
        if (Platform.OS === 'ios' && ShareExtensionBridge) {
          console.log('📱 [ShareContext] iOS detected, using native bridge');
          // Use native bridge to get data from UserDefaults
          const sharedData = await ShareExtensionBridge.getSharedData();
          console.log('🔍 [ShareContext] Native bridge returned:', sharedData);
          
          if (sharedData && typeof sharedData === 'object' && sharedData !== null) {
            console.log('✅ [ShareContext] Found share extension data via native bridge:', sharedData);
            handleSharedContent(sharedData);
            return; // Exit early if we found data
          } else {
            console.log('❌ [ShareContext] No data from native bridge');
          }
        } else {
          console.log('🤖 [ShareContext] Not iOS or no native bridge available');
        }
        
        // Fallback to AsyncStorage for Android or if native bridge fails
        console.log('💾 [ShareContext] Checking AsyncStorage for shared data...');
        const sharedDataStr = await AsyncStorage.getItem('SharedExtensionData');
        if (sharedDataStr) {
          const sharedData = JSON.parse(sharedDataStr);
          console.log('✅ [ShareContext] Found share extension data (AsyncStorage):', sharedData);
          await AsyncStorage.removeItem('SharedExtensionData');
          handleSharedContent(sharedData);
        } else {
          console.log('❌ [ShareContext] No data in AsyncStorage');
        }
      } catch (error) {
        console.error('❌ [ShareContext] Error checking share extension data:', error);
      }
    };

    // Check immediately and when app becomes active
    checkShareExtensionData();
    
    const handleAppStateChange = (nextAppState: string) => {
      if (nextAppState === 'active') {
        console.log('📱 [ShareContext] App became active, checking for shared content');
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
    console.log('🚀 [ShareContext] Starting to handle shared content');
    setIsProcessingShare(true);
    
    try {
      console.log('🔄 [ShareContext] Processing shared content:', JSON.stringify(content, null, 2));
      
      // Extract URL from different possible formats
      let sharedUrl = null;
      let sharedText = null;
      
      console.log('🔍 [ShareContext] Analyzing content format...');
      
      if (content.data) {
        console.log('📦 [ShareContext] Content has data field');
        // react-native-share-menu format
        if (typeof content.data === 'string') {
          console.log('📝 [ShareContext] Data is string type');
          if (content.data.includes('http')) {
            console.log('🔗 [ShareContext] Data contains HTTP URL');
            const urlMatch = content.data.match(/(https?:\/\/[^\s]+)/);
            if (urlMatch) {
              sharedUrl = urlMatch[1];
              sharedText = content.data;
              console.log('✅ [ShareContext] Extracted URL from data:', sharedUrl);
            }
          } else {
            sharedText = content.data;
            console.log('📝 [ShareContext] Data is plain text:', sharedText.substring(0, 100) + '...');
          }
        } else {
          sharedUrl = content.data;
          console.log('🔗 [ShareContext] Data is direct URL:', sharedUrl);
        }
      } else if (content.url) {
        sharedUrl = content.url;
        console.log('🔗 [ShareContext] Using content.url:', sharedUrl);
      } else if (content.text && content.text.includes('http')) {
        console.log('📝 [ShareContext] Content has text with HTTP');
        // Extract URL from text
        const urlMatch = content.text.match(/(https?:\/\/[^\s]+)/);
        if (urlMatch) {
          sharedUrl = urlMatch[1];
          sharedText = content.text;
          console.log('✅ [ShareContext] Extracted URL from text:', sharedUrl);
        }
      } else if (content.text) {
        sharedText = content.text;
        console.log('📝 [ShareContext] Content is plain text:', sharedText.substring(0, 100) + '...');
      }
      
      // Check if it's a TikTok URL
      const isTikTokUrl = sharedUrl && (
        sharedUrl.includes('tiktok.com') || 
        sharedUrl.includes('vm.tiktok.com') ||
        sharedUrl.includes('vt.tiktok.com')
      );
      
      if (isTikTokUrl) {
        console.log('🎵 [ShareContext] TikTok URL detected!');
      } else if (sharedUrl) {
        console.log('🔗 [ShareContext] Regular URL detected');
      } else {
        console.log('📝 [ShareContext] Text content only');
      }
      
      const processedContent = {
        ...content,
        url: sharedUrl,
        text: sharedText,
        isTikTokUrl,
        timestamp: Date.now()
      };
      
      console.log('📦 [ShareContext] Processed content object:', JSON.stringify(processedContent, null, 2));
      setSharedContent(processedContent);
      console.log('💾 [ShareContext] Shared content state updated');
      
      // Show confirmation to user
      const alertTitle = 'Content Shared';
      const alertMessage = isTikTokUrl 
        ? 'TikTok video received! You can now add it to a location on the map.'
        : 'Content received! You can now use it in the app.';
      
      console.log('🚨 [ShareContext] Showing alert:', alertTitle, '-', alertMessage);
      
      Alert.alert(
        alertTitle,
        alertMessage,
        [
          {
            text: 'OK',
            onPress: () => {
              console.log('👆 [ShareContext] User tapped OK, navigating to map');
              // Navigate to the map view
              router.replace('/(tabs)');
            }
          }
        ]
      );
      
      console.log('✅ [ShareContext] Shared content processed successfully:', processedContent);
      
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

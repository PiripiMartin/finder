import { Alert } from 'react-native';
import { API_CONFIG } from '../config/api';

export interface TikTokShareData {
  videoId?: string;
  username?: string;
  url?: string;
  type: 'video' | 'profile' | 'unknown';
}

export interface FolderShareData {
  folderId: string;
  type: 'folder';
  shareType: 'follow' | 'co-own';
}

export class DeepLinkHandler {
  static parseTikTokShare(url: string): TikTokShareData | null {
    try {
      // Handle lai:// scheme
      if (url.startsWith('lai://')) {
        const path = url.replace('lai://', '');
        
        // Handle share extension callback
        if (path === 'share') {
          // The actual data is stored in UserDefaults by the share extension
          // We'll handle it in the ShareContext
          return {
            type: 'unknown',
            url: url
          };
        }
        
        if (path.startsWith('share/')) {
          const shareData = path.replace('share/', '');
          return {
            videoId: shareData,
            type: 'video'
          };
        }
      }
      
      // Handle TikTok URLs (when users share FROM TikTok TO your app)
      if (url.includes('tiktok.com')) {
        // Extract video ID from TikTok URL
        const videoMatch = url.match(/\/video\/(\d+)/);
        if (videoMatch) {
          return {
            videoId: videoMatch[1],
            url: url,
            type: 'video'
          };
        }
        
        // Extract username from TikTok URL
        const usernameMatch = url.match(/@([^\/]+)/);
        if (usernameMatch) {
          return {
            username: usernameMatch[1],
            url: url,
            type: 'profile'
          };
        }
      }
      
      return null;
    } catch (error) {
      console.error('Error parsing TikTok share URL:', error);
      return null;
    }
  }

  static async handleTikTokShare(url: string): Promise<void> {
    try {
      const shareData = this.parseTikTokShare(url);
      
      if (shareData) {
        console.log('TikTok content shared TO your app:', shareData);
        
        // If this is a share extension callback, check for UserDefaults data
        if (url === 'lai://share') {
          await this.handleShareExtensionCallback();
        }
        
        // Here you can implement your logic to handle the shared content
        if (shareData.type === 'video') {
          console.log('TikTok video shared:', shareData.videoId);
          // You could:
          // - Save this video to favorites
          // - Navigate to a specific screen
          // - Add it to a collection
          // - Show a notification
        } else if (shareData.type === 'profile') {
          console.log('TikTok profile shared:', shareData.username);
          // You could:
          // - Follow this user
          // - Show their content
          // - Add to a list
        }
      }
    } catch (error) {
      console.error('Error handling TikTok share:', error);
    }
  }

  static async handleShareExtensionCallback(): Promise<void> {
    try {
      // Note: In a real implementation, you'd need to use a native module
      // to access UserDefaults from the app group. For now, we'll rely on
      // the ShareContext to handle this via AsyncStorage
      console.log('Share extension callback received');
    } catch (error) {
      console.error('Error handling share extension callback:', error);
    }
  }

  static parseFolderShare(url: string): FolderShareData | null {
    try {
      if (url.startsWith('lai://folder/')) {
        const path = url.replace('lai://folder/', '');
        
        // Check if it's a co-own link (ends with /join-owner)
        if (path.endsWith('/join-owner')) {
          const folderId = path.replace('/join-owner', '');
          if (folderId && !isNaN(Number(folderId))) {
            return {
              folderId,
              type: 'folder',
              shareType: 'co-own'
            };
          }
        } else {
          // It's a follow link
          if (path && !isNaN(Number(path))) {
            return {
              folderId: path,
              type: 'folder',
              shareType: 'follow'
            };
          }
        }
      }
      return null;
    } catch (error) {
      console.error('Error parsing folder share URL:', error);
      return null;
    }
  }

  static async handleFolderShare(url: string, sessionToken: string | null, router?: any): Promise<void> {
    try {
      const folderData = this.parseFolderShare(url);
      if (!folderData) {
        console.log('Not a folder share link');
        return;
      }

      if (!sessionToken) {
        Alert.alert(
          'Login Required',
          folderData.shareType === 'co-own' 
            ? 'Please login to join collaborative folders'
            : 'Please login to follow folders',
          [{ text: 'OK' }]
        );
        return;
      }

      // Determine endpoint based on share type
      const endpoint = folderData.shareType === 'co-own'
        ? `${API_CONFIG.BASE_URL}/folders/${folderData.folderId}/join-as-owner`
        : `${API_CONFIG.BASE_URL}/folders/${folderData.folderId}/follow`;

      // Call API to follow or join the folder
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${sessionToken}`,
        },
      });

      if (response.ok) {
        const successMessage = folderData.shareType === 'co-own'
          ? 'You are now a co-owner of this folder!'
          : 'You are now following this folder!';
        
        Alert.alert(
          'Success',
          successMessage,
          [
            {
              text: 'OK',
              onPress: () => {
                // Navigate to saved folders page
                if (router) {
                  router.push('/(tabs)/saved');
                }
              }
            }
          ]
        );
      } else if (response.status === 400) {
        const text = await response.text();
        if (text.includes('already following') || text.includes('already owner')) {
          const alreadyMessage = folderData.shareType === 'co-own'
            ? 'You are already a co-owner of this folder'
            : 'You are already following this folder';
          
          Alert.alert(
            'Info',
            alreadyMessage,
            [
              {
                text: 'View Folder',
                onPress: () => {
                  if (router) {
                    router.push('/(tabs)/saved');
                  }
                }
              },
              { text: 'Cancel', style: 'cancel' }
            ]
          );
        } else {
          const errorMessage = folderData.shareType === 'co-own'
            ? 'Failed to join folder'
            : 'Failed to follow folder';
          Alert.alert('Error', errorMessage);
        }
      } else if (response.status === 404) {
        Alert.alert('Error', 'Folder not found');
      } else {
        const errorMessage = folderData.shareType === 'co-own'
          ? 'Failed to join folder'
          : 'Failed to follow folder';
        Alert.alert('Error', errorMessage);
      }
    } catch (error) {
      console.error('Error handling folder share:', error);
      Alert.alert('Error', 'Something went wrong');
    }
  }

  // This is just for testing - you can remove it in production
  static generateTestUrl(videoId: string): string {
    return `lai://share/${videoId}`;
  }
}

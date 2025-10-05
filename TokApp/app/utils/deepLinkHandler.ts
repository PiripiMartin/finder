

export interface TikTokShareData {
  videoId?: string;
  username?: string;
  url?: string;
  type: 'video' | 'profile' | 'unknown';
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

  // This is just for testing - you can remove it in production
  static generateTestUrl(videoId: string): string {
    return `lai://share/${videoId}`;
  }
}

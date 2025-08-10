
export interface TikTokShareData {
  videoId?: string;
  username?: string;
  url?: string;
  type: 'video' | 'profile' | 'unknown';
}

export class DeepLinkHandler {
  static parseTikTokShare(url: string): TikTokShareData | null {
    try {
      // Handle tokapp:// scheme (for testing)
      if (url.startsWith('tokapp://')) {
        const path = url.replace('tokapp://', '');
        
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

  // This is just for testing - you can remove it in production
  static generateTestUrl(videoId: string): string {
    return `tokapp://share/${videoId}`;
  }
}

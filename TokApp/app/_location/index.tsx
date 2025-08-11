import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Dimensions, Linking, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { getMapPointsUrl } from '../config/api';

const { width } = Dimensions.get('window');
const tileWidth = (width - 30) / 2; // Less padding within video grid

interface LocationData {
  id: string;
  name: string;
  description: string;
  address: string;
  category: string;
  rating: number;
  hours: string;
  phone: string;
  website: string;
  tiktokVideos: string[];
}

interface VideoPost {
  id: string;
  url: string;
  title?: string;
  description?: string;
}

// Mock location data - you can replace with real data
const mockLocationData: { [key: string]: LocationData } = {
  '1': {
    id: '1',
    name: 'Coffee Haven',
    description: 'A cozy coffee shop known for its artisanal brews and creative latte art. Perfect spot for coffee enthusiasts and remote workers.',
    address: '123 Main Street, Downtown, City',
    category: 'Coffee Shop',
    rating: 4.8,
    hours: 'Mon-Fri: 7AM-7PM, Sat-Sun: 8AM-6PM',
    phone: '(555) 123-4567',
    website: 'coffeehaven.com',
    tiktokVideos: ['1', '2', '3', '4', '5', '6']
  },
  '2': {
    id: '2',
    name: 'Bubble Tea Paradise',
    description: 'The ultimate destination for bubble tea lovers with over 50 unique flavors and customizable toppings.',
    address: '456 Oak Avenue, Midtown, City',
    category: 'Bubble Tea',
    rating: 4.6,
    hours: 'Daily: 10AM-10PM',
    phone: '(555) 234-5678',
    website: 'bubbleteaparadise.com',
    tiktokVideos: ['7', '8', '9', '10', '11', '12']
  },
  '3': {
    id: '3',
    name: 'Tea Garden',
    description: 'Traditional tea house offering authentic tea ceremonies and premium loose-leaf teas from around the world.',
    address: '789 Pine Street, Uptown, City',
    category: 'Tea House',
    rating: 4.9,
    hours: 'Tue-Sun: 11AM-8PM, Closed Monday',
    phone: '(555) 345-6789',
    website: 'teagarden.com',
    tiktokVideos: ['13', '14', '15', '16', '17', '18']
  }
};

export default function Location() {
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const { theme } = useTheme();
  const { sessionToken } = useAuth();
  const [locationData, setLocationData] = useState<LocationData | null>(null);
  const [selectedVideo, setSelectedVideo] = useState<string | null>(null);
  const [videos, setVideos] = useState<VideoPost[]>([]);
  const [isLoadingVideos, setIsLoadingVideos] = useState(false);
  const [videosError, setVideosError] = useState<string | null>(null);

  // Fetch videos for the current location
  const fetchLocationVideos = async (locationId: string) => {
    try {
      setIsLoadingVideos(true);
      setVideosError(null);
      
      console.log('🎬 [fetchLocationVideos] Starting video fetch for location ID:', locationId);
      const apiUrl = getMapPointsUrl(Number(locationId));
      console.log('🌐 [fetchLocationVideos] API URL:', apiUrl);
      
      const response = await fetch(apiUrl, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${sessionToken || ''}`,
        },
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      console.log('Location videos API response:', data);
      
      // Extract videos from the API response
      // Assuming the API returns an array of posts with topPost data
      const fetchedVideos: VideoPost[] = data.map((item: any) => ({
        id: String(item.id || item.topPost?.id || Math.random().toString()),
        url: item.topPost?.url || item.url || '',
        title: item.topPost?.title || item.title || '',
        description: item.topPost?.description || item.description || ''
      })).filter((video: VideoPost) => video.url); // Only include videos with valid URLs
      
      console.log('Processed videos:', fetchedVideos);
      setVideos(fetchedVideos);
      
    } catch (error) {
      console.error('Error fetching location videos:', error);
      setVideosError(error instanceof Error ? error.message : 'Failed to fetch videos');
      // Fallback to empty videos array
      setVideos([]);
    } finally {
      setIsLoadingVideos(false);
    }
  };

  useEffect(() => {
    console.log('=== Location Page Loaded ===');
    console.log('Location page received ID:', id);
    console.log('Session token available:', !!sessionToken);
    console.log('Timestamp:', new Date().toISOString());
    
    if (id) {
      console.log('🔍 Looking up location data for ID:', id);
      const data = mockLocationData[id as string];
      console.log('Found location data:', data);
      
      if (data) {
        console.log('✅ Setting location data and fetching videos');
        setLocationData(data);
        // Fetch videos for this location
        fetchLocationVideos(data.id);
      } else {
        // If no data found, use a default location but fetch videos for the actual ID
        console.log('⚠️ No data found for ID, using default location data but fetching videos for actual ID:', id);
        setLocationData(mockLocationData['1']);
        // Always fetch videos for the actual location ID from the URL
        fetchLocationVideos(id as string);
      }
    } else {
      // If no ID provided, use default location
      console.log('⚠️ No ID provided, using default location');
      setLocationData(mockLocationData['1']);
      fetchLocationVideos('1');
    }
  }, [id, sessionToken]);

  const handleVideoPress = (videoUrl: string) => {
    if (videoUrl) {
      setSelectedVideo(videoUrl);
    }
  };

  const closeVideo = () => {
    setSelectedVideo(null);
  };

  const openDirections = () => {
    if (locationData) {
      const address = encodeURIComponent(locationData.address);
      
      if (Platform.OS === 'ios') {
        // Use Apple Maps on iOS
        const url = `http://maps.apple.com/?daddr=${address}`;
        Linking.openURL(url);
      } else {
        // Use Google Maps on Android
        const url = `https://www.google.com/maps/dir/?api=1&destination=${address}`;
        Linking.openURL(url);
      }
    }
  };

  if (!locationData) {
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <Text style={[styles.loadingText, { color: theme.colors.text }]}>Loading...</Text>
        <TouchableOpacity 
          style={[styles.loadingButton, { backgroundColor: theme.colors.primary }]}
          onPress={() => setLocationData(mockLocationData['1'])}
        >
          <Text style={[styles.loadingButtonText, { color: '#ffffff' }]}>Load Demo Location</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: theme.colors.surface }]}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.colors.text }]}>{locationData.name}</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Hero Section */}
        <View style={[styles.heroSection, { backgroundColor: theme.colors.surface }]}>
          <View style={styles.heroContent}>
            <Text style={[styles.locationName, { color: theme.colors.text }]}>{locationData.name}</Text>
            <Text style={[styles.category, { color: theme.colors.primary }]}>{locationData.category}</Text>
            <View style={styles.ratingContainer}>
              <Ionicons name="star" size={16} color="#FFD700" />
              <Text style={[styles.rating, { color: theme.colors.text }]}>{locationData.rating}</Text>
            </View>
          </View>
        </View>

        {/* Description Section */}
        <View style={[styles.section, { backgroundColor: theme.colors.surface }]}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>About</Text>
          <Text style={[styles.description, { color: theme.colors.textSecondary }]}>{locationData.description}</Text>
        </View>

        {/* Contact Info Section */}
        <View style={[styles.section, { backgroundColor: theme.colors.surface }]}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Contact & Hours</Text>
          
          <View style={styles.contactItem}>
            <Ionicons name="location" size={20} color={theme.colors.primary} />
            <Text style={[styles.contactText, { color: theme.colors.textSecondary }]}>{locationData.address}</Text>
          </View>
          
          <View style={styles.contactItem}>
            <Ionicons name="time" size={20} color={theme.colors.primary} />
            <Text style={[styles.contactText, { color: theme.colors.textSecondary }]}>{locationData.hours}</Text>
          </View>
          
          <View style={styles.contactItem}>
            <Ionicons name="call" size={20} color={theme.colors.primary} />
            <Text style={[styles.contactText, { color: theme.colors.textSecondary }]}>{locationData.phone}</Text>
          </View>
          
          <View style={styles.contactItem}>
            <Ionicons name="globe" size={20} color={theme.colors.primary} />
            <Text style={[styles.contactText, { color: theme.colors.textSecondary }]}>{locationData.website}</Text>
          </View>
          
          {/* Directions Button */}
          <TouchableOpacity 
            style={[styles.directionsButton, { backgroundColor: theme.colors.primary }]}
            onPress={openDirections}
          >
            <Ionicons name="navigate" size={20} color="#ffffff" />
            <Text style={styles.directionsButtonText}>Get Directions</Text>
          </TouchableOpacity>
        </View>

        {/* TikTok Videos Section */}
        <View style={[styles.section, { backgroundColor: theme.colors.surface }]}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>TikTok Videos</Text>
          <View style={styles.videoGrid}>
            {isLoadingVideos ? (
              <View style={[styles.videoTile, { backgroundColor: theme.colors.background, shadowColor: theme.colors.shadow, justifyContent: 'center', alignItems: 'center' }]}>
                <Ionicons name="refresh" size={24} color={theme.colors.primary} />
                <Text style={[styles.loadingText, { color: theme.colors.textSecondary }]}>Loading videos...</Text>
              </View>
            ) : videosError ? (
              <View style={[styles.videoTile, { backgroundColor: theme.colors.background, shadowColor: theme.colors.shadow, justifyContent: 'center', alignItems: 'center' }]}>
                <Ionicons name="alert-circle" size={24} color="#ff6b6b" />
                <Text style={[styles.errorText, { color: theme.colors.textSecondary }]}>Failed to load videos</Text>
                <TouchableOpacity 
                  style={[styles.retryButton, { backgroundColor: theme.colors.primary }]}
                  onPress={() => locationData && fetchLocationVideos(locationData.id)}
                >
                  <Text style={styles.retryButtonText}>Retry</Text>
                </TouchableOpacity>
              </View>
            ) : videos.length === 0 ? (
              <View style={[styles.videoTile, { backgroundColor: theme.colors.background, shadowColor: theme.colors.shadow, justifyContent: 'center', alignItems: 'center' }]}>
                <Ionicons name="videocam-off" size={24} color={theme.colors.textSecondary} />
                <Text style={[styles.noVideosText, { color: theme.colors.textSecondary }]}>No videos available</Text>
              </View>
            ) : (
              videos.map((video, index) => (
                <TouchableOpacity 
                  key={video.id} 
                  style={[styles.videoTile, { backgroundColor: theme.colors.background, shadowColor: theme.colors.shadow }]}
                  onPress={() => handleVideoPress(video.url)}
                >
                  <View style={styles.videoThumbnail}>
                    <WebView
                      source={{
                        html: `
                          <!DOCTYPE html>
                          <html>
                          <head>
                            <meta name="viewport" content="width=device-width, initial-scale=1.0">
                            <style>
                              body { 
                                margin: 0; 
                                padding: 0; 
                                background: #000; 
                                display: flex;
                                justify-content: center;
                                align-items: center;
                                height: 100vh;
                              }
                              iframe { 
                                border: none; 
                                display: block;
                                width: 100%;
                                height: 100%;
                              }
                            </style>
                          </head>
                          <body>
                            <iframe 
                              src="${video.url}" 
                              allow="fullscreen" 
                              title="TikTok Video">
                            </iframe>
                          </body>
                          </html>
                        `
                      }}
                      style={styles.videoThumbnail}
                      allowsInlineMediaPlayback={true}
                      mediaPlaybackRequiresUserAction={false}
                      javaScriptEnabled={true}
                      domStorageEnabled={true}
                      scrollEnabled={false}
                      bounces={false}
                    />
                  </View>
                </TouchableOpacity>
              ))
            )}
          </View>
        </View>
      </ScrollView>

      {/* Full Screen Video Modal */}
      {selectedVideo && (
        <View style={styles.videoModal}>
          <View style={[styles.videoModalContent, { backgroundColor: theme.colors.surface }]}>
            <TouchableOpacity style={styles.closeVideoButton} onPress={closeVideo}>
              <Ionicons name="close" size={24} color={theme.colors.text} />
            </TouchableOpacity>
            <WebView
              key={selectedVideo}
              source={{ 
                html: `
                  <!DOCTYPE html>
                  <html>
                  <head>
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                    <style>
                      body { 
                        margin: 0; 
                        padding: 0; 
                        background: #000; 
                        display: flex;
                        justify-content: center;
                        align-items: center;
                        height: 100vh;
                      }
                      iframe { 
                        border: none; 
                        display: block;
                        width: 100%;
                        height: 100%;
                      }
                    </style>
                  </head>
                  <body>
                    <iframe 
                      src="${selectedVideo}" 
                      allow="fullscreen" 
                      title="TikTok Video">
                    </iframe>
                  </body>
                  </html>
                `
              }}
              style={styles.fullScreenVideo}
              allowsInlineMediaPlayback={true}
              mediaPlaybackRequiresUserAction={false}
              javaScriptEnabled={true}
              domStorageEnabled={true}
            />
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    flex: 1,
    textAlign: 'center',
  },
  headerSpacer: {
    width: 40,
  },
  scrollView: {
    flex: 1,
  },
  heroSection: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  heroContent: {
    alignItems: 'center',
  },
  locationName: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  category: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  rating: {
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 4,
  },
  section: {
    paddingHorizontal: 15,
    paddingVertical: 20,
    marginTop: 10,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  description: {
    fontSize: 16,
    lineHeight: 24,
  },
  contactItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  contactText: {
    fontSize: 16,
    marginLeft: 12,
    flex: 1,
  },
  videoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginLeft: -5,
    marginRight: -5,
  },
  videoTile: {
    width: tileWidth,
    marginBottom: 15,
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  videoThumbnail: {
    width: '100%',
    height: tileWidth * 1.5,
    borderRadius: 8,
    overflow: 'hidden',
  },
  videoNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#666',
  },
  videoTitle: {
    fontSize: 14,
    fontWeight: '600',
    padding: 12,
  },
  videoModal: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  videoModalContent: {
    width: '90%',
    height: '80%',
    borderRadius: 12,
    overflow: 'hidden',
    position: 'relative',
  },
  closeVideoButton: {
    position: 'absolute',
    top: 16,
    right: 16,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
  },
  fullScreenVideo: {
    flex: 1,
  },
  loadingText: {
    fontSize: 16,
    textAlign: 'center',
    marginTop: 10,
  },
  loadingButton: {
    marginTop: 20,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    alignSelf: 'center',
  },
  loadingButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  directionsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    marginTop: 15,
  },
  directionsButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  errorText: {
    fontSize: 16,
    marginTop: 10,
    textAlign: 'center',
  },
  retryButton: {
    marginTop: 15,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  noVideosText: {
    fontSize: 16,
    marginTop: 10,
    textAlign: 'center',
  },
});

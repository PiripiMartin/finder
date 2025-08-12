import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { useRouter } from "expo-router";
import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Dimensions, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import MapView, { Marker, PROVIDER_GOOGLE, Region } from 'react-native-maps';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import { getApiUrl, getMapPointsUrl } from '../config/api';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { MapPoint } from '../mapData';
import { DeepLinkHandler } from '../utils/deepLinkHandler';
import { videoUrls } from '../videoData';

// Function to calculate distance between two coordinates in meters
const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
  const R = 6371e3; // Earth's radius in meters
  const φ1 = lat1 * Math.PI / 180;
  const φ2 = lat2 * Math.PI / 180;
  const Δφ = (lat2 - lat1) * Math.PI / 180;
  const Δλ = (lon2 - lon1) * Math.PI / 180;

  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) *
    Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
};

// Function to calculate emoji scale based on distance
const getEmojiScale = (distance: number): number => {
  // Base scale is 1.0
  // Closer emojis get slightly bigger (up to 1.3x)
  // Farther emojis get slightly smaller (down to 0.8x)
  const maxDistance = 3000; // 3km - beyond this, emojis are at minimum size
  const minDistance = 200; // 200m - closer than this, emojis are at maximum size
  
  if (distance <= minDistance) return 1.3;
  if (distance >= maxDistance) return 0.8;
  
  // Use exponential decay for more natural drop-off
  const scaleRange = 1.3 - 0.8;
  const distanceRange = maxDistance - minDistance;
  const normalizedDistance = (distance - minDistance) / distanceRange;
  
  // Exponential curve for more aggressive drop-off in the middle range
  const exponentialFactor = Math.pow(normalizedDistance, 1.5);
  
  return 1.3 - (exponentialFactor * scaleRange);
};

export default function Index() {
  const router = useRouter();
  const mapRef = useRef<MapView>(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const buttonAnim = useRef(new Animated.Value(0)).current;
  const [userLocation, setUserLocation] = useState<Region | null>(null);
  const [selectedVideo, setSelectedVideo] = useState<string | null>(null);
  const [isVideoVisible, setIsVideoVisible] = useState(false);
  const [videoPosition, setVideoPosition] = useState({ x: 0, y: 0 });
  const [selectedMarkerId, setSelectedMarkerId] = useState<string | null>(null);
  const { theme } = useTheme();
  const { sessionToken, logout } = useAuth();
  const insets = useSafeAreaInsets();

  // Filter state
  const [activeFilter, setActiveFilter] = useState<string | null>(null);
  
  // API state
  const [mapPoints, setMapPoints] = useState<MapPoint[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState(0);
  const REFRESH_INTERVAL = 10000; // 10 seconds in milliseconds

  // Shake animation refs for each marker
  const shakeAnims = useRef<{ [key: string]: Animated.Value }>({}).current;

  // Pre-fetch location videos for performance
  const [locationVideos, setLocationVideos] = useState<{ [key: string]: any[] }>({});
  const [isLoadingVideos, setIsLoadingVideos] = useState<{ [key: string]: boolean }>({});

  // Fetch videos for a specific location
  const fetchLocationVideos = async (locationId: string) => {
    // Skip if already loading or already fetched
    if (isLoadingVideos[locationId] || locationVideos[locationId]) {
      console.log('🎬 [fetchLocationVideos] Skipping fetch for location', locationId, '- already loading or cached');
      return;
    }

    try {
      console.log('🎬 [fetchLocationVideos] Starting video fetch for location ID:', locationId);
      setIsLoadingVideos(prev => ({ ...prev, [locationId]: true }));
      
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
      console.log('🎬 [fetchLocationVideos] API response for location', locationId, ':', data);
      
      // Extract videos from the API response
      const fetchedVideos = data.map((item: any) => ({
        id: String(item.id || item.topPost?.id || Math.random().toString()),
        url: item.topPost?.url || item.url || '',
        title: item.topPost?.title || item.title || '',
        description: item.topPost?.description || item.description || ''
      })).filter((video: any) => video.url);
      
      console.log('🎬 [fetchLocationVideos] Processed videos for location', locationId, ':', fetchedVideos);
      setLocationVideos(prev => ({ ...prev, [locationId]: fetchedVideos }));
      
    } catch (error) {
      console.error('🎬 [fetchLocationVideos] Error fetching videos for location', locationId, ':', error);
      // Set empty array to prevent retry attempts
      setLocationVideos(prev => ({ ...prev, [locationId]: [] }));
    } finally {
      setIsLoadingVideos(prev => ({ ...prev, [locationId]: false }));
    }
  };

  // Fetch map points from API
  const fetchMapPoints = async () => {
    try {
      // Check if enough time has passed since last refresh
      const now = Date.now();
      if (now - lastRefresh < REFRESH_INTERVAL) {
        console.log(`⏰ [fetchMapPoints] Skipping refresh - only ${Math.round((now - lastRefresh) / 1000)}s since last refresh`);
        return;
      }
      
      setIsLoading(true);
      setError(null);
      
      // Check if we have user location before making the API call
      if (!userLocation) {
        console.log('No user location available, skipping API call');
        setIsLoading(false);
        return;
      }
      
      // Build the API URL with coordinates
      const apiUrl = `${getApiUrl('MAP_POINTS')}?lat=${userLocation.latitude}&lon=${userLocation.longitude}`;
      console.log('Fetching map points from:', apiUrl);
      
      // Create a timeout promise
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Request timeout')), 5000); // 5 second timeout
      });
      
      // Fetch map points from API
      const fetchPromise = fetch(apiUrl, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${sessionToken || ''}`,
        },
      });
      
      // Race between fetch and timeout
      const response = await Promise.race([fetchPromise, timeoutPromise]) as Response;
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      console.log('API response data:', data);
      
      // Safely extract and validate the data
      const savedLocations = Array.isArray(data.savedLocations) ? data.savedLocations : [];
      const recommendedLocations = Array.isArray(data.recommendedLocations) ? data.recommendedLocations : [];
      
      console.log('🔍 [fetchMapPoints] API Response Data:', {
        savedLocations: {
          count: savedLocations.length,
          data: savedLocations
        },
        recommendedLocations: {
          count: recommendedLocations.length,
          data: recommendedLocations
        }
      });
      
      // Combine saved and recommended locations
      const allLocations = [...savedLocations, ...recommendedLocations];
      
      console.log('📊 [fetchMapPoints] Combined Locations:', {
        totalCount: allLocations.length,
        allLocations: allLocations
      });
      
      
      
      // Transform locations to MapPoint format with error handling
      console.log('🔄 [fetchMapPoints] Starting data transformation...');
      
      const transformedMapPoints: MapPoint[] = allLocations.map((item: any, index: number) => {
        console.log(`📍 [fetchMapPoints] Processing item ${index}:`, item);
        
        // Validate required fields
        if (!item.location || !item.location.id || !item.location.latitude || !item.location.longitude) {
          console.warn('❌ [fetchMapPoints] Invalid location data:', item);
          return null;
        }
        
        const transformedItem = {
          id: String(item.location.id), // Ensure ID is a string
          title: item.location.title || 'Unknown Location',
          description: item.location.description || '',
          emoji: item.location.emoji || '📍',
          latitude: Number(item.location.latitude),
          longitude: Number(item.location.longitude),
          videoUrl: item.topPost?.url || '',
        };
        
        console.log(`✅ [fetchMapPoints] Transformed item ${index}:`, transformedItem);
        return transformedItem;
      }).filter(Boolean) as MapPoint[]; // Remove null entries
      
      console.log('🎯 [fetchMapPoints] Final transformed map points:', {
        totalCount: transformedMapPoints.length,
        mapPoints: transformedMapPoints
      });
      
     
      setMapPoints(transformedMapPoints);
      setError(null); // Clear any previous errors
      setLastRefresh(Date.now()); // Update last refresh timestamp
      console.log('🎉 [fetchMapPoints] Successfully fetched data from API, total points:', transformedMapPoints.length);
      console.log('📱 [fetchMapPoints] State updated with map points:', transformedMapPoints);
      
    } catch (err) {
      console.error('Error fetching map points:', err);
      
      // Use fallback data if API fails
      const fallbackData = {
        recommendedLocations: [
          {
            location: {
              id: "125",
              title: "Rooftop Bar",
              description: "Amazing city views and cocktails",
              emoji: "🧩",
              latitude: -37.8100,
              longitude: 144.9600
            },
            topPost: {
              id: 458,
              url: "https://www.tiktok.com/player/v1/7519892034644135182?loop=1&autoplay=1&controls=0&volume_control=1&description=0&rel=0&native_context_menu=0&closed_caption=0&progress_bar=0&timestamp=0",
              postedBy: 991,
              mapPointId: 125,
              postedAt: "2024-01-16T18:45:00.000Z"
            }
          },
          {
            location: {
              id: "126",
              title: "Street Art Alley",
              description: "Colorful murals and graffiti",
              emoji: "🧩",
              latitude: -37.8150,
              longitude: 144.9650
            },
            topPost: {
              id: 459,
              url: "https://www.tiktok.com/player/v1/7487245729363266822?loop=1&autoplay=1&controls=0&volume_control=1&description=0&rel=0&native_context_menu=0&closed_caption=0&progress_bar=0&timestamp=0",
              postedBy: 442,
              mapPointId: 126,
              postedAt: "2024-01-16T18:45:00.000Z"
            }
          },
          {
            location: {
              id: "127",
              title: "Downtown Coffee Shop",
              description: "Best espresso in the city with great wifi",
              emoji: "🍉",
              latitude: -37.8136,
              longitude: 144.9631
            },
            topPost: {
              id: 456,
              url: "https://www.tiktok.com/player/v1/7522762748745452818?loop=1&autoplay=1&controls=0&volume_control=1&description=0&rel=0&native_context_menu=0&closed_caption=0&progress_bar=0&timestamp=0",
              postedBy: 789,
              mapPointId: 127,
              postedAt: "2024-01-15T14:30:00.000Z"
            }
          },
          {
            location: {
              id: "128",
              title: "Central Park Bench",
              description: "Peaceful spot for lunch breaks",
              emoji: "☕",
              latitude: -37.8200,
              longitude: 144.9700
            },
            topPost: {
              id: 457,
              url: "https://www.tiktok.com/player/v1/7519892034644135182?loop=1&autoplay=1&controls=0&volume_control=1&description=0&rel=0&native_context_menu=0&closed_caption=0&progress_bar=0&timestamp=0",
              postedBy: 789,
              mapPointId: 128,
              postedAt: "2024-01-14T12:15:00.000Z"
            }
          }
        ]
      };
      
      // Use fallback data
      const fallbackMapPoints: MapPoint[] = fallbackData.recommendedLocations.map((item: any) => ({
        id: item.location.id,
        title: item.location.title,
        description: item.location.description,
        emoji: item.location.emoji,
        latitude: item.location.latitude,
        longitude: item.location.longitude,
        videoUrl: item.topPost.url,
      }));
      
      setMapPoints(fallbackMapPoints);
      setError('Using offline data - network unavailable');
      
    } finally {
      setIsLoading(false);
    }
  };

  // Load map points when user location is available
  useEffect(() => {
    if (userLocation) {
      fetchMapPoints();
    }
  }, [userLocation]);

  // Function to manually refresh data (bypasses interval check)
  const handleRefresh = async () => {
    try {
      console.log('🔄 [handleRefresh] Manual refresh requested');
      setIsLoading(true);
      setError(null);
      
      // Check if we have user location before making the API call
      if (!userLocation) {
        console.log('No user location available, skipping API call');
        setIsLoading(false);
        return;
      }
      
      // Build the API URL with coordinates
      const apiUrl = `${getApiUrl('MAP_POINTS')}?lat=${userLocation.latitude}&lon=${userLocation.longitude}`;
      console.log('Manual refresh - Fetching map points from:', apiUrl);
      
      // Create a timeout promise
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Request timeout')), 5000); // 5 second timeout
      });
      
      // Fetch map points from API
      const fetchPromise = fetch(apiUrl, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${sessionToken || ''}`,
        },
      });
      
      // Race between fetch and timeout
      const response = await Promise.race([fetchPromise, timeoutPromise]) as Response;
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      console.log('Manual refresh - API response data:', data);
      
      // Safely extract and validate the data
      const savedLocations = Array.isArray(data.savedLocations) ? data.savedLocations : [];
      const recommendedLocations = Array.isArray(data.recommendedLocations) ? data.recommendedLocations : [];
      
      // Combine saved and recommended locations
      const allLocations = [...savedLocations, ...recommendedLocations];
      
      
      
      // Transform locations to MapPoint format with error handling
      const transformedMapPoints: MapPoint[] = allLocations.map((item: any) => {
        // Validate required fields
        if (!item.location || !item.location.id || !item.location.latitude || !item.location.longitude) {
          console.warn('Invalid location data:', item);
          return null;
        }
        
        return {
          id: String(item.location.id), // Ensure ID is a string
          title: item.location.title || 'Unknown Location',
          description: item.location.description || '',
          emoji: item.location.emoji || '📍',
          latitude: Number(item.location.latitude),
          longitude: Number(item.location.longitude),
          videoUrl: item.topPost?.url || '',
        };
      }).filter(Boolean) as MapPoint[]; // Remove null entries
      
      setMapPoints(transformedMapPoints);
      setError(null); // Clear any previous errors
      setLastRefresh(Date.now()); // Update last refresh timestamp
      console.log('Manual refresh - Successfully fetched data from API, total points:', transformedMapPoints.length);
      
    } catch (err) {
      console.error('Manual refresh - Error fetching map points:', err);
      setError(err instanceof Error ? err.message : 'Unknown error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  // Helper function to get label for emoji
  const getEmojiLabel = (emoji: string): string => {
    const emojiLabels: { [key: string]: string } = {
      '☕': 'Coffee',
      '🧋': 'Bubble Tea',
      '𫖖': 'Tea',
      '🍰': 'Dessert',
      '🍕': 'Pizza',
      '🍜': 'Noodles',
      '🍣': 'Sushi',
      '🍔': 'Burgers',
      '🍸': 'Cocktails',
      '🎨': 'Art',
      '🌳': 'Nature',
    };
    return emojiLabels[emoji] || 'Unknown';
  };

  // Get unique marker types from emojis
  const markerTypes = useMemo(() => {
    const emojiCounts: { [key: string]: number } = {};
    
    mapPoints.forEach(point => {
      if (emojiCounts[point.emoji]) {
        emojiCounts[point.emoji]++;
      } else {
        emojiCounts[point.emoji] = 1;
      }
    });
    
    // Convert to array format and add some default types if needed
    const types = Object.entries(emojiCounts).map(([emoji, count]) => ({
      emoji,
      label: getEmojiLabel(emoji),
      count
    }));
    
    // Add default types if no data yet
    if (types.length === 0) {
      return [
        { emoji: '☕', label: 'Coffee', count: 0 },
        { emoji: '🧋', label: 'Bubble Tea', count: 0 },
        { emoji: '𫖖', label: 'Tea', count: 0 },
        { emoji: '🍰', label: 'Dessert', count: 0 },
        { emoji: '🍕', label: 'Pizza', count: 0 },
        { emoji: '🍜', label: 'Noodles', count: 0 },
        { emoji: '🍣', label: 'Sushi', count: 0 },
        { emoji: '🍔', label: 'Burgers', count: 0 },
      ];
    }
    
    return types;
  }, [mapPoints]);

  // Filtered map points based on active filter
  const filteredMapPoints = activeFilter
    ? mapPoints.filter(point => point.emoji === activeFilter)
    : mapPoints;

  // Clear selection if selected marker is no longer visible after filtering
  useEffect(() => {
    if (selectedMarkerId && !filteredMapPoints.find(point => point.id === selectedMarkerId)) {
      setSelectedMarkerId(null);
      setIsVideoVisible(false);
    }
  }, [filteredMapPoints, selectedMarkerId]);

  // Function to trigger shake animation for a marker
  const triggerShake = (pointId: string) => {
    if (!shakeAnims[pointId]) {
      shakeAnims[pointId] = new Animated.Value(0);
    }
    
    Animated.sequence([
      Animated.timing(shakeAnims[pointId], {
        toValue: 1,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.timing(shakeAnims[pointId], {
        toValue: -1,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.timing(shakeAnims[pointId], {
        toValue: 1,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.timing(shakeAnims[pointId], {
        toValue: 0,
        duration: 100,
        useNativeDriver: true,
      }),
    ]).start();
  };

  // Randomly trigger shake animations
  useEffect(() => {
    const shakeInterval = setInterval(() => {
      const randomIndex = Math.floor(Math.random() * filteredMapPoints.length);
      if (filteredMapPoints[randomIndex]) {
        triggerShake(filteredMapPoints[randomIndex].id);
      }
    }, 3000); // Shake every 3 seconds

    return () => clearInterval(shakeInterval);
  }, [filteredMapPoints]);
  
  const handleMarkerPress = (pointId: string, event: any) => {
    console.log('Marker pressed:', pointId);
    console.log('Current selectedMarkerId:', selectedMarkerId);
    
    // Find the selected point
    const selectedPoint = mapPoints.find(point => point.id === pointId);
    if (!selectedPoint) return;
    
    console.log('Setting selectedMarkerId to:', pointId);
    setSelectedMarkerId(pointId);
    
    // 🚀 PERFORMANCE OPTIMIZATION: Start fetching videos immediately when marker is pressed
    console.log('🚀 [handleMarkerPress] Starting video pre-fetch for location:', pointId);
    fetchLocationVideos(pointId);
    
    // Use the videoUrl from the API response if available, otherwise fall back to videoData
    let videoUrl = selectedPoint.videoUrl;
    
    if (!videoUrl) {
      // Fallback to static video data if no videoUrl in API response
      const fallbackVideo = videoUrls[pointId];
      if (fallbackVideo) {
        videoUrl = fallbackVideo;
      }
    }
    
    if (videoUrl) {
      setSelectedVideo(videoUrl);
      setIsVideoVisible(true);
      
      // Pan camera to the clicked marker - position it in the top middle of the screen
      if (selectedPoint && mapRef.current) {
        // Calculate the offset to position the marker in the top middle
        const screenHeight = Dimensions.get('window').height;
        const screenWidth = Dimensions.get('window').width;
        
        // Calculate the latitude offset to move the marker to the top third of the screen
        // Subtract the offset to move the marker up on the screen
        const latitudeOffset = 0.003; // Reduced offset to move it lower down
        
        mapRef.current.animateToRegion({
          latitude: selectedPoint.latitude - latitudeOffset,
          longitude: selectedPoint.longitude,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        }, 1000);
      }
      
      // Get marker position for video placement
      const { pageX, pageY } = event.nativeEvent;
      setVideoPosition({ x: pageX, y: pageY });
      
      // Animate video fade in
      fadeAnim.setValue(0);
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }).start();
    }
  };

  const closeVideo = () => {
    // Start fade-out animation
    Animated.timing(fadeAnim, {
      toValue: 0,
      duration: 300,
      useNativeDriver: true,
    }).start(() => {
      setIsVideoVisible(false);
      setSelectedVideo(null);
    });

    // Stop button animation
    buttonAnim.stopAnimation();
  };

  useEffect(() => {
    (async () => {
      // Request location permissions
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        return;
      }
      
      // Get current location
      let location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      
      const region: Region = {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        latitudeDelta: 0.01, // Closer zoom for user location
        longitudeDelta: 0.01,
      };
      
      setUserLocation(region);
    })();
  }, []);

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {/* Full-screen map */}
      <MapView
        ref={mapRef}
        provider={Platform.OS === 'ios' ? undefined : PROVIDER_GOOGLE}
        style={styles.map}
        initialRegion={userLocation || {
          latitude: -37.8136,
          longitude: 144.9631,
          latitudeDelta: 0.0922,
          longitudeDelta: 0.0421,
        }}
        region={userLocation || undefined}
        showsUserLocation={true}
        showsMyLocationButton={false}
        followsUserLocation={true}
        moveOnMarkerPress={false}
      >
        {/* Loading indicator */}
        {isLoading && (
          <View style={styles.loadingOverlay}>
            <Text style={styles.loadingText}>Loading locations...</Text>
          </View>
        )}
        
        {/* Error indicator */}
        {error && (
          <View style={styles.errorOverlay}>
            <Text style={styles.errorText}>Error: {error}</Text>
            <TouchableOpacity style={styles.retryButton} onPress={fetchMapPoints}>
              <Text style={styles.retryButtonText}>Retry</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Render all map points as markers */}
        {filteredMapPoints.map((point: MapPoint) => {
          // Calculate distance from user to this marker
          let distanceScale = 1.0;
          if (userLocation) {
            const distance = calculateDistance(
              userLocation.latitude,
              userLocation.longitude,
              point.latitude,
              point.longitude
            );
            distanceScale = getEmojiScale(distance);
          }
          
          // Combine distance scale with selection scale
          const finalScale = point.id === selectedMarkerId ? 
            distanceScale * 1.2 : // Selected markers get 20% bigger than their distance scale
            distanceScale;
          
          if (point.id === selectedMarkerId) {
            console.log(`Marker ${point.id} selected, distanceScale: ${distanceScale}, finalScale: ${finalScale}`);
          }
          
          return (
            <Marker
              key={point.id}
              coordinate={{
                latitude: point.latitude,
                longitude: point.longitude,
              }}
              tracksViewChanges={false}
              onPress={(event) => {
                handleMarkerPress(point.id, event);
              }}
            >
              <Animated.View
                style={{
                  width: 64, // Increased from 48 to 64
                  height: 64, // Increased from 48 to 64
                  alignItems: 'center',
                  justifyContent: 'center',
                  transform: [
                    {
                      scale: finalScale,
                    },
                  ],
                }}
              >
                <Animated.Text 
                  style={[
                    styles.markerEmoji,
                    {
                      transform: [
                        {
                          translateX: shakeAnims[point.id] ? shakeAnims[point.id].interpolate({
                            inputRange: [-1, 0, 1],
                            outputRange: [-3, 0, 3],
                          }) : 0,
                        },
                      ],
                    }
                  ]}
                >
                  {point.emoji}
                </Animated.Text>
                
                {/* Custom Label - Only show when selected */}
                {point.id === selectedMarkerId && (
                  <View style={[
                    styles.customLabel,
                    {
                      top: -30, // Moved down (was -70)
                      left: -60, // Wider label (was -40)
                      right: -60, // Wider label (was -40)
                    }
                  ]}>
                    <Text style={styles.labelTitle}>{point.title}</Text>
                    <Text style={styles.labelDescription}>{point.description}</Text>
                  </View>
                )}
              </Animated.View>
            </Marker>
          );
        })}
      </MapView>

      {/* Custom Location Button - Top Left */}
      <TouchableOpacity 
        style={[
          styles.locationButton,
          {
            top: insets.top + 20,
            left: insets.left + 20,
          }
        ]}
        onPress={() => {
          if (userLocation && mapRef.current) {
            mapRef.current.animateToRegion(userLocation, 1000);
          }
          // Unselect the emoji and hide marker labels
          setSelectedMarkerId(null);
        }}
      >
        <Ionicons name="navigate" size={24} color="#007AFF" />
      </TouchableOpacity>

      {/* Refresh Button - Top Right */}
      <TouchableOpacity 
        style={[
          styles.refreshButton,
          {
            top: insets.top + 20,
            right: insets.right + 20,
          }
        ]}
        onPress={handleRefresh}
        disabled={isLoading}
      >
        <Ionicons 
          name="refresh" 
          size={24} 
          color={isLoading ? "#999" : "#007AFF"} 
        />
      </TouchableOpacity>

      {/* Test Deep Link Button - Top Center */}
      <TouchableOpacity 
        style={[
          styles.testButton,
          {
            top: insets.top + 20,
            left: '50%',
            marginLeft: -20, // Center the button
          }
        ]}
        onPress={() => {
          const testUrl = "tokapp://share/123456789";
          console.log('Testing deep link:', testUrl);
          DeepLinkHandler.handleTikTokShare(testUrl);
        }}
      >
        <Ionicons name="link" size={24} color="#007AFF" />
      </TouchableOpacity>

      {/* Clear Token Button - Top Center Right */}
      <TouchableOpacity 
        style={[
          styles.clearButton,
          {
            top: insets.top + 20,
            left: '50%',
            marginLeft: 20, // Position to the right of test button
          }
        ]}
        onPress={() => {
          logout();
          console.log('Session token cleared');
        }}
      >
        <Ionicons name="log-out" size={24} color="#FF3B30" />
      </TouchableOpacity>

      {/* Filter Buttons - Bottom */}
      <View style={[
        styles.filterContainer,
        {
          bottom: insets.bottom - 28,
        }
      ]}>
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterScrollContent}
        >
          {/* All Filter Button */}
          <TouchableOpacity
            style={[
              styles.filterButton,
              {
                backgroundColor: activeFilter === null ? theme.colors.primary : theme.colors.surface,
                borderColor: activeFilter === null ? theme.colors.primary : theme.colors.border,
              }
            ]}
            onPress={() => setActiveFilter(null)}
          >
            <Text style={[
              styles.filterButtonText,
              { color: activeFilter === null ? '#ffffff' : theme.colors.text }
            ]}>
              All
            </Text>
          </TouchableOpacity>

          {/* Type-specific Filter Buttons */}
          {markerTypes.map((type) => (
            <TouchableOpacity
              key={type.emoji}
              style={[
                styles.filterButton,
                {
                  backgroundColor: activeFilter === type.emoji ? theme.colors.primary : theme.colors.surface,
                  borderColor: activeFilter === type.emoji ? theme.colors.primary : theme.colors.border,
                }
              ]}
              onPress={() => setActiveFilter(activeFilter === type.emoji ? null : type.emoji)}
            >
              <Text style={styles.filterEmoji}>{type.emoji}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Picture-in-Picture Video */}
      {isVideoVisible && selectedVideo && (
        <Animated.View 
          style={[
            styles.videoOverlay, 
            { 
              left: 15, // Hardcoded 50px from left edge
              bottom: insets.bottom + 20, // Position above the filters
              opacity: fadeAnim,
            }
          ]}
        >
          {/* Shop Button with Arrow */}
          <TouchableOpacity
            style={[styles.shopButton, { backgroundColor: '#ffffff' }]}
            onPress={() => {
              // Log the "Check it out" process
              console.log('=== "Check it out" Button Tapped ===');
              console.log('Selected Marker ID:', selectedMarkerId);
              console.log('Selected Video:', selectedVideo);
              console.log('User Location:', userLocation);
              console.log('Timestamp:', new Date().toISOString());
              
              // Navigate to location page
              console.log('Navigating to location page with ID:', selectedMarkerId);
              router.push(`/_location?id=${selectedMarkerId}`);
              
              console.log('Navigation initiated successfully');
            }}
          >
            <Animated.View
              style={{
                transform: [
                  {
                    translateX: buttonAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0, 8], // Move 8px to the right
                    }),
                  },
                ],
              }}
            >
              <Text style={styles.shopButtonText}>→ Check it out</Text>
            </Animated.View>
          </TouchableOpacity>
          
          <View style={[styles.videoContainer, { backgroundColor: theme.colors.surface }]}>
            <TouchableOpacity style={styles.closeButton} onPress={closeVideo}>
              <Text style={[styles.closeButtonText, { color: theme.colors.text }]}>✕</Text>
            </TouchableOpacity>
            <WebView
              key={`${selectedVideo}-${Date.now()}`}
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
                      }
                    </style>
                  </head>
                  <body>
                    <iframe 
                      height="300" 
                      width="400" 
                      src="${selectedVideo}" 
                      allow="fullscreen" 
                      title="TikTok Video">
                    </iframe>
                  </body>
                  </html>
                `
              }}
              style={styles.video}
              allowsInlineMediaPlayback={true}
              mediaPlaybackRequiresUserAction={false}
              javaScriptEnabled={true}
              domStorageEnabled={true}
              scalesPageToFit={true}
              bounces={false}
              scrollEnabled={false}
              onError={(syntheticEvent) => {
                const { nativeEvent } = syntheticEvent;
              }}
              onHttpError={(syntheticEvent) => {
                const { nativeEvent } = syntheticEvent;
              }}
            />
          </View>
        </Animated.View>
      )}

      
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  map: {
    width: Dimensions.get('window').width,
    height: Dimensions.get('window').height,
  },
  customMarker: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 6,
    borderWidth: 1,
    borderColor: '#007AFF',
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 3,
  },
  markerEmoji: {
    fontSize: 32,
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
  },
  videoOverlay: {
    position: 'absolute',
    zIndex: 1000,
  },
  videoContainer: {
    width: 165,
    height: 298, // Match the iframe dimensions
    borderRadius: 8,
    overflow: 'hidden',
    position: 'relative',
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 6,
  },
  video: {
    flex: 1,
    width: '100%',
    height: '100%',
    backgroundColor: '#000',
    borderRadius: 8,
  },
  closeButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
  },
  closeButtonText: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  shopButton: {
    width: 165,
    height: 40,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 6,
  },
  shopButtonText: {
    color: '#000000',
    fontSize: 16,
    fontWeight: 'bold',
  },
  debugInfo: {
    position: 'absolute',
    top: 10,
    left: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    padding: 10,
    borderRadius: 5,
    zIndex: 100,
  },
  debugText: {
    fontSize: 12,
    color: '#ffffff',
  },
  locationButton: {
    position: 'absolute',
    backgroundColor: 'white',
    borderRadius: 20,
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 3,
  },
  refreshButton: {
    position: 'absolute',
    backgroundColor: 'white',
    borderRadius: 20,
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 3,
  },
  testButton: {
    position: 'absolute',
    backgroundColor: 'white',
    borderRadius: 20,
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 3,
  },
  clearButton: {
    position: 'absolute',
    backgroundColor: 'white',
    borderRadius: 20,
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 3,
  },
  filterContainer: {
    position: 'absolute',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
    paddingHorizontal: 20,
    zIndex: 10,
  },
  filterScrollContent: {
    alignItems: 'center',
    paddingHorizontal: 10,
  },
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 15,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  filterEmoji: {
    fontSize: 18,
    marginRight: 5,
  },
  filterButtonText: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    zIndex: 100,
  },
  loadingText: {
    fontSize: 18,
    color: '#333',
  },
  errorOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    zIndex: 100,
  },
  errorText: {
    fontSize: 18,
    color: '#ff0000',
    textAlign: 'center',
    padding: 20,
  },
  retryButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  customLabel: {
    position: 'absolute',
    backgroundColor: '#ffffff',
    padding: 8,
    borderRadius: 6,
    zIndex: 1000,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 3,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  labelTitle: {
    color: '#000000',
    fontSize: 10, // Smaller font
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 1,
  },
  labelDescription: {
    color: '#666666',
    fontSize: 8, // Smaller font
    textAlign: 'center',
    lineHeight: 10,
  },
});

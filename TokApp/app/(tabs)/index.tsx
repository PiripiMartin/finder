import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { useRouter } from "expo-router";
import { useEffect, useRef, useState } from 'react';
import { Animated, Dimensions, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import MapView, { Marker, PROVIDER_GOOGLE, Region } from 'react-native-maps';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import { useTheme } from '../context/ThemeContext';
import { MapPoint, mapPoints } from '../mapData';
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
  const insets = useSafeAreaInsets();
  
  // Filter state
  const [activeFilter, setActiveFilter] = useState<string | null>(null);
  
  // Get unique marker types from emojis
  const markerTypes = [
    { emoji: '☕', label: 'Coffee' },
    { emoji: '🧋', label: 'Bubble Tea' },
    { emoji: '𫖖', label: 'Tea' },
    { emoji: '🍰', label: 'Dessert' },
    { emoji: '🍕', label: 'Pizza' },
    { emoji: '🍜', label: 'Noodles' },
    { emoji: '🍣', label: 'Sushi' },
    { emoji: '🍔', label: 'Burgers' },
  ];
  
  // Filtered map points based on active filter
  const filteredMapPoints = activeFilter 
    ? mapPoints.filter(point => point.emoji === activeFilter)
    : mapPoints;
  
  const handleMarkerPress = (pointId: string, event: any) => {
    const videoUrl = videoUrls[pointId];
    
    // Pan camera to the clicked marker - position it in the top middle of the screen
    const selectedPoint = mapPoints.find(point => point.id === pointId);
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
    
    // If tapping the same marker, do nothing (keep it selected)
    if (selectedMarkerId === pointId) {
      return;
    }
    
    // Set the selected marker ID for visual feedback
    setSelectedMarkerId(pointId);
    
    if (videoUrl) {
      setSelectedVideo(videoUrl);
      setIsVideoVisible(true);
      
      // Start fade-in animation
      fadeAnim.setValue(0);
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 1100,
        useNativeDriver: true,
      }).start();

      // Start button animation
      buttonAnim.setValue(0);
      Animated.loop(
        Animated.sequence([
          Animated.timing(buttonAnim, {
            toValue: 1,
            duration: 1500,
            useNativeDriver: true,
          }),
          Animated.timing(buttonAnim, {
            toValue: 0,
            duration: 1500,
            useNativeDriver: true,
          }),
        ])
      ).start();
      
      // Calculate video position based on screen dimensions
      if (event.nativeEvent) {
        const screenHeight = Dimensions.get('window').height;
        const videoHeight = 298; // Height of video container
        const margin = 20;
        
        // Place video in bottom left, above the filters
        const x = margin;
        // Remove y calculation since we're using bottom positioning now
        
        setVideoPosition({ x, y: 0 }); // y is no longer used
      }
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
        region={userLocation || undefined} // This will center the map on user location when available
        showsUserLocation={true}
        showsMyLocationButton={false}
        followsUserLocation={true}
        moveOnMarkerPress={false}
      >
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
          
          return (
            <Marker
              key={point.id}
              coordinate={{
                latitude: point.latitude,
                longitude: point.longitude,
              }}
              title={point.title}
              description={point.description}
              tracksViewChanges={false}
              onPress={(event) => {
                handleMarkerPress(point.id, event);
              }}
            >
              <Animated.View
                style={{
                  width: 48,
                  height: 48,
                  alignItems: 'center',
                  justifyContent: 'center',
                  transform: [
                    {
                      scale: finalScale,
                    },
                  ],
                }}
              >
                <Text style={styles.markerEmoji}>
                  {point.emoji}
                </Text>
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
        }}
      >
        <Ionicons name="navigate" size={24} color="#007AFF" />
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
              left: videoPosition.x, 
              bottom: insets.bottom + 20, // Position above the filters
              opacity: fadeAnim,
            }
          ]}
        >
          {/* Shop Button with Arrow */}
          <TouchableOpacity
            style={[styles.shopButton, { backgroundColor: '#ffffff' }]}
            onPress={() => {
              // Navigate to location page
              router.push(`/_location?id=${selectedMarkerId}`);
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
});

import * as Location from 'expo-location';
import { useRouter } from "expo-router";
import { useEffect, useRef, useState } from 'react';
import { Animated, Dimensions, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import MapView, { Marker, PROVIDER_GOOGLE, Region } from 'react-native-maps';
import { WebView } from 'react-native-webview';
import { useTheme } from '../context/ThemeContext';
import { MapPoint, mapPoints } from '../mapData';
import { videoUrls } from '../videoData';

export default function Index() {
  const router = useRouter();
  const mapRef = useRef<MapView>(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const [userLocation, setUserLocation] = useState<Region | null>(null);
  const [selectedVideo, setSelectedVideo] = useState<string | null>(null);
  const [isVideoVisible, setIsVideoVisible] = useState(false);
  const [videoPosition, setVideoPosition] = useState({ x: 0, y: 0 });
  const [selectedMarkerId, setSelectedMarkerId] = useState<string | null>(null);
  const { theme } = useTheme();
  
  // Create animated values for each marker
  const markerAnimations = useRef<{ [key: string]: Animated.Value }>({}).current;
  const [animatingMarkers, setAnimatingMarkers] = useState<Set<string>>(new Set());

  const handleMarkerPress = (pointId: string, event: any) => {
    const videoUrl = videoUrls[pointId];
    
    // If tapping the same marker, shrink it back to normal size
    if (selectedMarkerId === pointId) {
      setAnimatingMarkers(prev => new Set([...prev, pointId]));
      Animated.timing(markerAnimations[pointId], {
        toValue: 1,
        duration: 900,
        useNativeDriver: true,
      }).start(() => {
        setAnimatingMarkers(prev => {
          const newSet = new Set(prev);
          newSet.delete(pointId);
          return newSet;
        });
      });
      setSelectedMarkerId(null);
      return;
    }
    
    // Reset the previously selected marker first
    if (selectedMarkerId && selectedMarkerId !== pointId && markerAnimations[selectedMarkerId]) {
      setAnimatingMarkers(prev => new Set([...prev, selectedMarkerId]));
      Animated.timing(markerAnimations[selectedMarkerId], {
        toValue: 1,
        duration: 900,
        useNativeDriver: true,
      }).start(() => {
        setAnimatingMarkers(prev => {
          const newSet = new Set(prev);
          newSet.delete(selectedMarkerId);
          return newSet;
        });
      });
    }
    
    // Animate the selected marker
    if (markerAnimations[pointId]) {
      setAnimatingMarkers(prev => new Set([...prev, pointId]));
      Animated.timing(markerAnimations[pointId], {
        toValue: 1.1,
        duration: 900,
        useNativeDriver: true,
      }).start(() => {
        setAnimatingMarkers(prev => {
          const newSet = new Set(prev);
          newSet.delete(pointId);
          return newSet;
        });
      });
    }
    
    // Always set the selected marker ID for visual feedback
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
      
      // Calculate video position based on screen dimensions
      if (event.nativeEvent) {
        const screenHeight = Dimensions.get('window').height;
        const videoHeight = 298; // Height of video container
        const margin = 20;
        
        // Place video in bottom left, moved up
        const x = margin;
        const y = screenHeight - videoHeight - 130; // Moved up by reducing bottom margin
        
        setVideoPosition({ x, y });
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
      setSelectedMarkerId(null);
      
      // Reset all marker animations
      const markersToReset = Object.keys(markerAnimations);
      if (markersToReset.length > 0) {
        setAnimatingMarkers(new Set(markersToReset));
        markersToReset.forEach((id) => {
          if (markerAnimations[id]) {
            Animated.timing(markerAnimations[id], {
              toValue: 1,
              duration: 900,
              useNativeDriver: true,
            }).start(() => {
              setAnimatingMarkers(prev => {
                const newSet = new Set(prev);
                newSet.delete(id);
                return newSet;
              });
            });
          }
        });
      }
    });
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
        provider={PROVIDER_GOOGLE}
        style={styles.map}
        initialRegion={userLocation || {
          latitude: -37.8136,
          longitude: 144.9631,
          latitudeDelta: 0.0922,
          longitudeDelta: 0.0421,
        }}
        region={userLocation || undefined} // This will center the map on user location when available
        showsUserLocation={true}
        showsMyLocationButton={true}
        followsUserLocation={true}
        moveOnMarkerPress={false}
      >
        {/* Render all map points as markers */}
        {mapPoints.map((point: MapPoint) => {
          // Ensure animated value exists for this marker (only create once)
          if (!markerAnimations[point.id]) {
            markerAnimations[point.id] = new Animated.Value(1);
          }
          
          return (
            <Marker
              key={`marker-${point.id}`}
              coordinate={{
                latitude: point.latitude,
                longitude: point.longitude,
              }}
              title={point.title}
              description={point.description}
              tracksViewChanges={animatingMarkers.has(point.id)}
              onPress={(event) => {
                handleMarkerPress(point.id, event);
              }}
            >
              <Animated.Text
                style={[
                  styles.markerEmoji,
                  {
                    transform: [
                      {
                        scale: markerAnimations[point.id],
                      },
                    ],
                    textAlign: 'center',
                  },
                ]}
              >
                {point.emoji}
              </Animated.Text>
            </Marker>
          );
        })}
      </MapView>

      {/* Picture-in-Picture Video */}
      {isVideoVisible && selectedVideo && (
        <Animated.View 
          style={[
            styles.videoOverlay, 
            { 
              left: videoPosition.x, 
              top: videoPosition.y,
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
            <Text style={styles.shopButtonText}>→ Check it out</Text>
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
});

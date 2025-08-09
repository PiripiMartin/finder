import * as Location from 'expo-location';
import { useRouter } from "expo-router";
import { useEffect, useRef, useState } from 'react';
import { Animated, Dimensions, Platform, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import MapView, { Marker, PROVIDER_GOOGLE, Region } from 'react-native-maps';
import { WebView } from 'react-native-webview';
import { useTheme } from '../context/ThemeContext';
import { MapPoint, mapPoints } from '../mapData';
import { videoUrls } from '../videoData';

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
        showsMyLocationButton={true}
        followsUserLocation={true}
        moveOnMarkerPress={false}
      >
        {/* Render all map points as markers */}
        {mapPoints.map((point: MapPoint) => {
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
                      scale: point.id === selectedMarkerId ? 1.1 : 1.0,
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
});

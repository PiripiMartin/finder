import * as Location from 'expo-location';
import { useRouter } from "expo-router";
import { useEffect, useRef, useState } from 'react';
import { Dimensions, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import MapView, { Marker, PROVIDER_GOOGLE, Region } from 'react-native-maps';
import { WebView } from 'react-native-webview';
import { useTheme } from './context/ThemeContext';
import { MapPoint, mapPoints } from './mapData';
import { videoUrls } from './videoData';

const { width } = Dimensions.get('window');

export default function Index() {
  const router = useRouter();
  const mapRef = useRef<MapView>(null);
  const [userLocation, setUserLocation] = useState<Region | null>(null);
  const [locationPermission, setLocationPermission] = useState<boolean>(false);
  const [selectedVideo, setSelectedVideo] = useState<string | null>(null);
  const [isVideoVisible, setIsVideoVisible] = useState(false);
  const [selectedMarkerPosition, setSelectedMarkerPosition] = useState({ x: 0, y: 0 });
  const [videoPosition, setVideoPosition] = useState({ x: 0, y: 0 });
  const { theme } = useTheme();

  const handleMarkerPress = (pointId: string, event: any) => {
    const videoUrl = videoUrls[pointId];
    console.log('Marker pressed:', pointId, 'Video URL:', videoUrl);
    if (videoUrl) {
      setSelectedVideo(videoUrl);
      setIsVideoVisible(true);
      
      // Get marker position for video placement
      if (event.nativeEvent) {
        const coordinate = event.nativeEvent.coordinate;
        setSelectedMarkerPosition({
          x: coordinate.longitude,
          y: coordinate.latitude,
        });
        
        // Calculate video position based on marker screen position
        const screenWidth = Dimensions.get('window').width;
        const screenHeight = Dimensions.get('window').height;
        const videoWidth = 165; // Width of video container
        const videoHeight = 298; // Height of video container
        const margin = 20;
        
        // Place video in bottom left
        const x = margin;
        const y = screenHeight - videoHeight - 80; // Moved up by reducing bottom margin
        
        setVideoPosition({ x, y });
      }
    }
  };

  const closeVideo = () => {
    setIsVideoVisible(false);
    setSelectedVideo(null);
  };

  useEffect(() => {
    (async () => {
      // Request location permissions
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        console.log('Location permission denied');
        return;
      }
      
      setLocationPermission(true);
      
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
        {mapPoints.map((point: MapPoint) => (
          <Marker
            key={point.id}
            coordinate={{
              latitude: point.latitude,
              longitude: point.longitude,
            }}
            title={point.title}
            description={point.description}
            tracksViewChanges={false}
            onPress={(event) => handleMarkerPress(point.id, event)}
          >
            <View style={[styles.customMarker, { backgroundColor: theme.colors.surface, borderColor: theme.colors.primary, shadowColor: theme.colors.shadow }]}>
              <Text style={styles.markerEmoji}>{point.emoji}</Text>
            </View>
          </Marker>
        ))}
      </MapView>

      {/* Picture-in-Picture Video */}
      {isVideoVisible && selectedVideo && (
        <View style={[styles.videoOverlay, { left: videoPosition.x, top: videoPosition.y }]}>
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
                console.warn('WebView error: ', nativeEvent);
              }}
              onHttpError={(syntheticEvent) => {
                const { nativeEvent } = syntheticEvent;
                console.warn('WebView HTTP error: ', nativeEvent);
              }}
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
    fontSize: 18,
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
});

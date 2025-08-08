import * as Location from 'expo-location';
import { useRouter } from "expo-router";
import { useEffect, useState } from 'react';
import { Dimensions, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import MapView, { Marker, PROVIDER_GOOGLE, Region } from 'react-native-maps';
import { WebView } from 'react-native-webview';
import { useTheme } from './context/ThemeContext';
import { MapPoint, mapPoints } from './mapData';
import { videoUrls } from './videoData';

const { width } = Dimensions.get('window');

export default function Index() {
  const router = useRouter();
  const [userLocation, setUserLocation] = useState<Region | null>(null);
  const [locationPermission, setLocationPermission] = useState<boolean>(false);
  const [selectedVideo, setSelectedVideo] = useState<string | null>(null);
  const [isVideoVisible, setIsVideoVisible] = useState(false);
  const [selectedMarkerPosition, setSelectedMarkerPosition] = useState({ x: 0, y: 0 });
  const { theme } = useTheme();

  const handleMarkerPress = (pointId: string, event: any) => {
    const videoUrl = videoUrls[pointId];
    if (videoUrl) {
      setSelectedVideo(videoUrl);
      setIsVideoVisible(true);
      
      // Get marker position for video placement
      if (event.nativeEvent) {
        setSelectedMarkerPosition({
          x: event.nativeEvent.coordinate.x,
          y: event.nativeEvent.coordinate.y,
        });
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
        <View style={styles.videoOverlay}>
          <View style={[styles.videoContainer, { backgroundColor: theme.colors.surface }]}>
            <TouchableOpacity style={styles.closeButton} onPress={closeVideo}>
              <Text style={[styles.closeButtonText, { color: theme.colors.text }]}>✕</Text>
            </TouchableOpacity>
            <WebView
              source={{ 
                uri: selectedVideo,
                headers: {
                  'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0 Mobile/15E148 Safari/604.1'
                }
              }}
              style={styles.video}
              allowsInlineMediaPlayback={true}
              mediaPlaybackRequiresUserAction={false}
              javaScriptEnabled={true}
              domStorageEnabled={true}
              userAgent="Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0 Mobile/15E148 Safari/604.1"
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
    top: 50,
    right: 20,
    zIndex: 1000,
  },
  videoContainer: {
    width: 200,
    height: 300, // Better size for TikTok embeds
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

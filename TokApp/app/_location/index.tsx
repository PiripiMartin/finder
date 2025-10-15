import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Dimensions, Linking, Modal, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import { WebView } from 'react-native-webview';
import { API_CONFIG, getMapPointsUrl, getEditLocationUrl } from '../config/api';
import { useAuth } from '../context/AuthContext';
import { useLocationContext } from '../context/LocationContext';
import { useTheme } from '../context/ThemeContext';

const { width } = Dimensions.get('window');
const tileWidth = (width - 30) / 2; // Less padding within video grid

interface LocationData {
  id: string;
  title: string;
  description: string;
  emoji: string;
  latitude: number;
  longitude: number;
  isValidLocation: number;
  websiteUrl: string | null;
  phoneNumber: string | null;
  address: string | null;
  createdAt: string;
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
    title: 'Coffee Haven',
    description: 'A cozy coffee shop known for its artisanal brews and creative latte art. Perfect spot for coffee enthusiasts and remote workers.',
    emoji: '☕',
    latitude: -37.8136,
    longitude: 144.9631,
    isValidLocation: 1,
    websiteUrl: 'coffeehaven.com',
    phoneNumber: '(555) 123-4567',
    address: '123 Main Street, Downtown, City',
    createdAt: '2025-01-10T03:14:49.000Z',
    tiktokVideos: ['1', '2', '3', '4', '5', '6']
  },
  '2': {
    id: '2',
    title: 'Bubble Tea Paradise',
    description: 'The ultimate destination for bubble tea lovers with over 50 unique flavors and customizable toppings.',
    emoji: '🧋',
    latitude: -37.7950,
    longitude: 144.9500,
    isValidLocation: 1,
    websiteUrl: 'bubbleteaparadise.com',
    phoneNumber: '(555) 234-5678',
    address: '456 Oak Avenue, Midtown, City',
    createdAt: '2025-01-10T03:14:49.000Z',
    tiktokVideos: ['7', '8', '9', '10', '11', '12']
  },
  '3': {
    id: '3',
    title: 'Tea Garden',
    description: 'Traditional tea house offering authentic tea ceremonies and premium loose-leaf teas from around the world.',
    emoji: '🫖',
    latitude: -37.8300,
    longitude: 144.9800,
    isValidLocation: 1,
    websiteUrl: 'teagarden.com',
    phoneNumber: '(555) 345-6789',
    address: '789 Pine Street, Uptown, City',
    createdAt: '2025-01-10T03:14:49.000Z',
    tiktokVideos: ['13', '14', '15', '16', '17', '18']
  }
};

export default function Location() {
  const router = useRouter();
  const { id, needsCoordinates } = useLocalSearchParams();
  const { theme } = useTheme();
  const { sessionToken } = useAuth();
  const { findLocationById, removeLocation, addBlockedLocation, refreshLocations } = useLocationContext();
  const [locationData, setLocationData] = useState<LocationData | null>(null);
  const [selectedVideo, setSelectedVideo] = useState<string | null>(null);
  const [videos, setVideos] = useState<VideoPost[]>([]);
  const [isLoadingVideos, setIsLoadingVideos] = useState(false);
  const [videosError, setVideosError] = useState<string | null>(null);
  const [isSelectingCoords, setIsSelectingCoords] = useState(false);
  const [selectedCoords, setSelectedCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [isSubmittingCoords, setIsSubmittingCoords] = useState(false);
  const [submitCoordsError, setSubmitCoordsError] = useState<string | null>(null);
  const [showReportModal, setShowReportModal] = useState(false);
  const [isBlockingLocation, setIsBlockingLocation] = useState(false);
  const [isEditModalVisible, setIsEditModalVisible] = useState(false);
  const [editFormData, setEditFormData] = useState({
    title: '',
    description: '',
    emoji: '',
    address: '',
    websiteUrl: '',
    phoneNumber: '',
  });
  const [isSavingEdit, setIsSavingEdit] = useState(false);

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
    console.log('📍 [Location] Page accessed with location ID:', id);
    console.log('🚀 [Location] This could be from map marker tap or saved locations list');
    console.log('🗺️ [Location] needsCoordinates flag:', needsCoordinates);
    
    if (id) {
      console.log('🔍 Looking up location data for ID:', id);
      
      // Try to find the location in the stored locations first
      // This will be populated from the API call in the index page
      const storedLocation = findLocationById(id as string);
      
      if (storedLocation) {
        console.log('✅ Found location in stored data:', storedLocation);
        // Transform StoredLocation to LocationData format
        const transformedLocation: LocationData = {
          id: String(storedLocation.location.id),
          title: storedLocation.location.title,
          description: storedLocation.location.description,
          emoji: storedLocation.location.emoji,
          latitude: storedLocation.location.latitude || 0,
          longitude: storedLocation.location.longitude || 0,
          isValidLocation: storedLocation.location.isValidLocation,
          websiteUrl: storedLocation.location.websiteUrl,
          phoneNumber: storedLocation.location.phoneNumber,
          address: storedLocation.location.address,
          createdAt: storedLocation.location.createdAt,
          tiktokVideos: [storedLocation.topPost.url], // Use the topPost URL as the video
        };
        setLocationData(transformedLocation);
        fetchLocationVideos(transformedLocation.id);
      } else {
        // Fallback to mock data if not found in stored locations
        console.log('⚠️ Location not found in stored data, using mock data as fallback');
        const mockData = mockLocationData[id as string];
        if (mockData) {
          setLocationData(mockData);
          fetchLocationVideos(mockData.id);
        } else {
          // If no mock data either, use default
          setLocationData(mockLocationData['1']);
          fetchLocationVideos(id as string);
        }
      }
    } else {
      // If no ID provided, use default location
      console.log('⚠️ No ID provided, using default location');
      setLocationData(mockLocationData['1']);
      fetchLocationVideos('1');
    }
    // Enter coordinate selection mode if requested via query param
    setIsSelectingCoords(needsCoordinates === 'true');
  }, [id, sessionToken]);

  const handleMapPressForCoords = (event: any) => {
    const { latitude, longitude } = event.nativeEvent.coordinate;
    console.log('📍 [Location] User selected coords:', { latitude, longitude });
    setSelectedCoords({ latitude, longitude });
  };

  const submitSelectedCoordinates = async () => {
    if (!selectedCoords || !id) return;
    try {
      setIsSubmittingCoords(true);
      setSubmitCoordsError(null);
      const url = `${API_CONFIG.BASE_URL}/map/${id}/coords`;
      console.log('🌐 [Location] Submitting selected coords to:', url, selectedCoords);
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${sessionToken || ''}`,
        },
        body: JSON.stringify({ latitude: selectedCoords.latitude, longitude: selectedCoords.longitude }),
      });
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      console.log('✅ [Location] Coords submitted successfully');
      // Go back to previous screen (Saved) which can be refreshed by user
      router.back();
    } catch (err) {
      console.error('❌ [Location] Failed to submit coords', err);
      setSubmitCoordsError(err instanceof Error ? err.message : 'Failed to submit coordinates');
    } finally {
      setIsSubmittingCoords(false);
    }
  };

  const handleVideoPress = (videoUrl: string) => {
    if (videoUrl) {
      setSelectedVideo(videoUrl);
    }
  };

  const closeVideo = () => {
    setSelectedVideo(null);
  };

  const openDirections = () => {
    if (locationData && locationData.address) {
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

  const handleReportLocation = () => {
    setShowReportModal(true);
  };

  const handleBlockLocation = async () => {
    if (!locationData || !sessionToken) return;
    
    try {
      setIsBlockingLocation(true);
      
      const url = `https://ptvalert.xyz/api/map/${locationData.id}/block`;
      console.log('🚫 [Location] Blocking location:', url);
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${sessionToken}`,
        },
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      console.log('✅ [Location] Location blocked successfully');
      
      // Remove the blocked location from local state to hide it from the map
      if (removeLocation) {
        removeLocation(locationData.id);
      }
      
      // Add location to blocked list
      if (addBlockedLocation) {
        console.log(`🔔 [Location] Adding location ${locationData.id} to blocked list`);
        addBlockedLocation(locationData.id);
      } else {
        console.log(`⚠️ [Location] addBlockedLocation function not available`);
      }
      
      // Show success message and go back
      Alert.alert(
        'Location Blocked',
        'This location has been blocked and will no longer appear on the map.',
        [
          {
            text: 'OK',
            onPress: () => router.back()
          }
        ]
      );
      
    } catch (error) {
      console.error('❌ [Location] Failed to block location:', error);
      Alert.alert(
        'Error',
        'Failed to block location. Please try again.',
        [{ text: 'OK' }]
      );
    } finally {
      setIsBlockingLocation(false);
    }
  };

  const handleEditPress = () => {
    if (!locationData) return;
    // Pre-fill form with current data
    setEditFormData({
      title: locationData.title,
      description: locationData.description,
      emoji: locationData.emoji,
      address: locationData.address || '',
      websiteUrl: locationData.websiteUrl || '',
      phoneNumber: locationData.phoneNumber || '',
    });
    setIsEditModalVisible(true);
  };

  const handleSaveEdit = async () => {
    if (!locationData || !sessionToken) return;
    
    try {
      setIsSavingEdit(true);
      
      const url = getEditLocationUrl(parseInt(locationData.id));
      console.log('✏️ [Location] Editing location:', url);
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${sessionToken}`,
        },
        body: JSON.stringify(editFormData),
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const result = await response.json();
      console.log('✅ [Location] Edit successful:', result);
      
      // Update local location data immediately
      setLocationData({
        ...locationData,
        title: editFormData.title,
        description: editFormData.description,
        emoji: editFormData.emoji,
        address: editFormData.address,
        websiteUrl: editFormData.websiteUrl,
        phoneNumber: editFormData.phoneNumber,
      });
      
      // Close modal
      setIsEditModalVisible(false);
      
      // Refresh locations via context (for map and saved list)
      refreshLocations();
      
      // Show success alert
      Alert.alert('Success', 'Location updated successfully!');
      
    } catch (error) {
      console.error('❌ [Location] Error editing location:', error);
      Alert.alert('Error', 'Failed to update location. Please try again.');
    } finally {
      setIsSavingEdit(false);
    }
  };

  const handleCancelEdit = () => {
    setIsEditModalVisible(false);
  };

  if (!locationData) {
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <Text style={[styles.loadingText, { color: theme.colors.text }]}>Loading...</Text>
        <TouchableOpacity 
          style={[styles.loadingButton, { backgroundColor: theme.colors.primary }]}
          onPress={() => setLocationData(mockLocationData['1'])}
        >
          <Text style={[styles.loadingButtonText, { color: '#FFF0F0' }]}>Load Demo Location</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Coordinate selection mode UI
  if (isSelectingCoords) {
    const initialRegion = {
      latitude: -37.8136, // Default center (e.g., Melbourne CBD)
      longitude: 144.9631,
      latitudeDelta: 0.05,
      longitudeDelta: 0.05,
    };

    return (
      <View style={[styles.container, { backgroundColor: theme.colors.background }]}>        
        {/* Header */}
        <View style={[styles.header, { backgroundColor: theme.colors.surface }]}>          
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color={theme.colors.text} />
          </TouchableOpacity>
          <View style={styles.headerSpacer} />
        </View>

        {/* Instruction Banner */}
        <View style={{ paddingHorizontal: 16, paddingBottom: 8 }}>
          <Text style={{ color: theme.colors.text }}>
            Tap on the map to set this location's coordinates.
          </Text>
          {submitCoordsError && (
            <Text style={{ color: '#ff6b6b', marginTop: 6 }}>{submitCoordsError}</Text>
          )}
        </View>

        <View style={{ flex: 1 }}>
          <MapView
            style={{ flex: 1 }}
            initialRegion={initialRegion}
            onPress={handleMapPressForCoords}
          >
            {selectedCoords && (
              <Marker coordinate={selectedCoords} />
            )}
          </MapView>
        </View>

        {/* Save Button */}
        <View style={{ padding: 16 }}>
          <TouchableOpacity
            disabled={!selectedCoords || isSubmittingCoords}
            onPress={submitSelectedCoordinates}
            style={{
              opacity: !selectedCoords || isSubmittingCoords ? 0.6 : 1,
              backgroundColor: theme.colors.primary,
              paddingVertical: 14,
              borderRadius: 10,
              alignItems: 'center',
            }}
          >
            <Text style={{ color: '#FFF0F0', fontWeight: 'bold', fontSize: 16 }}>
              {isSubmittingCoords ? 'Saving…' : 'Save Coordinates'}
            </Text>
          </TouchableOpacity>
        </View>
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
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Hero Section */}
        <View style={[styles.heroSection, { backgroundColor: theme.colors.surface }]}>
          <View style={styles.heroContent}>
            <Text style={[styles.locationName, { color: theme.colors.text }]}>{locationData.title}</Text>
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
            <Text style={[styles.contactText, { color: theme.colors.textSecondary }]}>Mon-Fri: 9AM-6PM</Text>
          </View>
          
          <View style={styles.contactItem}>
            <Ionicons name="call" size={20} color={theme.colors.primary} />
            <Text style={[styles.contactText, { color: theme.colors.textSecondary }]}>{locationData.phoneNumber || 'Not available'}</Text>
          </View>
          
          <View style={styles.contactItem}>
            <Ionicons name="globe" size={20} color={theme.colors.primary} />
            <Text style={[styles.contactText, { color: theme.colors.textSecondary }]}>{locationData.websiteUrl || 'Not available'}</Text>
          </View>
          
          {/* Directions Button */}
          <TouchableOpacity 
            style={[styles.directionsButton, { backgroundColor: theme.colors.primary }]}
            onPress={openDirections}
          >
            <Ionicons name="navigate" size={20} color="#FFF0F0" />
            <Text style={styles.directionsButtonText}>Get Directions</Text>
          </TouchableOpacity>

          {/* Edit Button */}
          <TouchableOpacity 
            style={[styles.editButton, { backgroundColor: theme.colors.primary }]}
            onPress={handleEditPress}
          >
            <Ionicons name="pencil" size={20} color="#FFF0F0" />
            <Text style={styles.editButtonText}>Edit Location</Text>
          </TouchableOpacity>
        </View>

        {/* TikTok Videos Section - Only show for authenticated users */}
        {sessionToken && (
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
        )}
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

      {/* Report Location Modal */}
      <Modal
        visible={showReportModal}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setShowReportModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.colors.surface }]}>
            <Text style={[styles.modalTitle, { color: theme.colors.text }]}>Report Submitted</Text>
            <Text style={[styles.modalText, { color: theme.colors.textSecondary }]}>
              Thanks, we'll acknowledge the report.
            </Text>
            <TouchableOpacity
              style={[styles.modalButton, { backgroundColor: theme.colors.primary }]}
              onPress={() => setShowReportModal(false)}
            >
              <Text style={[styles.modalButtonText, { color: '#FFF0F0' }]}>OK</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Edit Location Modal */}
      <Modal
        visible={isEditModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={handleCancelEdit}
      >
        <View style={styles.editModalOverlay}>
          <ScrollView 
            style={[styles.editModalContent, { backgroundColor: theme.colors.surface }]}
            showsVerticalScrollIndicator={false}
          >
            <Text style={[styles.editModalTitle, { color: theme.colors.text }]}>Edit Location</Text>
            
            {/* Title Input */}
            <Text style={[styles.editFormLabel, { color: theme.colors.text }]}>Title</Text>
            <TextInput
              style={[styles.editFormInput, { 
                backgroundColor: theme.colors.background,
                color: theme.colors.text,
                borderColor: theme.colors.border || '#835858'
              }]}
              value={editFormData.title}
              onChangeText={(text) => setEditFormData({ ...editFormData, title: text })}
              placeholder="Enter location title"
              placeholderTextColor={theme.colors.textSecondary}
            />

            {/* Description Input */}
            <Text style={[styles.editFormLabel, { color: theme.colors.text }]}>Description</Text>
            <TextInput
              style={[styles.editFormInput, styles.editFormTextArea, { 
                backgroundColor: theme.colors.background,
                color: theme.colors.text,
                borderColor: theme.colors.border || '#835858'
              }]}
              value={editFormData.description}
              onChangeText={(text) => setEditFormData({ ...editFormData, description: text })}
              placeholder="Enter description"
              placeholderTextColor={theme.colors.textSecondary}
              multiline
              numberOfLines={4}
            />

            {/* Emoji Input */}
            <Text style={[styles.editFormLabel, { color: theme.colors.text }]}>Emoji</Text>
            <TextInput
              style={[styles.editFormInput, { 
                backgroundColor: theme.colors.background,
                color: theme.colors.text,
                borderColor: theme.colors.border || '#835858'
              }]}
              value={editFormData.emoji}
              onChangeText={(text) => setEditFormData({ ...editFormData, emoji: text })}
              placeholder="Enter emoji (e.g., 🍕)"
              placeholderTextColor={theme.colors.textSecondary}
            />

            {/* Address Input */}
            <Text style={[styles.editFormLabel, { color: theme.colors.text }]}>Address</Text>
            <TextInput
              style={[styles.editFormInput, { 
                backgroundColor: theme.colors.background,
                color: theme.colors.text,
                borderColor: theme.colors.border || '#835858'
              }]}
              value={editFormData.address}
              onChangeText={(text) => setEditFormData({ ...editFormData, address: text })}
              placeholder="Enter address"
              placeholderTextColor={theme.colors.textSecondary}
            />

            {/* Website URL Input */}
            <Text style={[styles.editFormLabel, { color: theme.colors.text }]}>Website URL</Text>
            <TextInput
              style={[styles.editFormInput, { 
                backgroundColor: theme.colors.background,
                color: theme.colors.text,
                borderColor: theme.colors.border || '#835858'
              }]}
              value={editFormData.websiteUrl}
              onChangeText={(text) => setEditFormData({ ...editFormData, websiteUrl: text })}
              placeholder="Enter website URL"
              placeholderTextColor={theme.colors.textSecondary}
              keyboardType="url"
              autoCapitalize="none"
            />

            {/* Phone Number Input */}
            <Text style={[styles.editFormLabel, { color: theme.colors.text }]}>Phone Number</Text>
            <TextInput
              style={[styles.editFormInput, { 
                backgroundColor: theme.colors.background,
                color: theme.colors.text,
                borderColor: theme.colors.border || '#835858'
              }]}
              value={editFormData.phoneNumber}
              onChangeText={(text) => setEditFormData({ ...editFormData, phoneNumber: text })}
              placeholder="Enter phone number"
              placeholderTextColor={theme.colors.textSecondary}
              keyboardType="phone-pad"
            />

            {/* Action Buttons */}
            <View style={styles.editModalButtons}>
              <TouchableOpacity
                style={[styles.editModalButton, { backgroundColor: theme.colors.textSecondary }]}
                onPress={handleCancelEdit}
                disabled={isSavingEdit}
              >
                <Text style={[styles.editModalButtonText, { color: '#FFF0F0' }]}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.editModalButton, { backgroundColor: theme.colors.primary }]}
                onPress={handleSaveEdit}
                disabled={isSavingEdit}
              >
                <Text style={[styles.editModalButtonText, { color: '#FFF0F0' }]}>
                  {isSavingEdit ? 'Saving...' : 'Save'}
                </Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </Modal>
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
    paddingBottom: 12,
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
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#835858',
  },
  heroContent: {
    alignItems: 'center',
  },
  locationName: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 0,
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
    color: '#835858',
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
    color: '#FFF0F0',
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
    color: '#FFF0F0',
    fontSize: 16,
    fontWeight: 'bold',
  },
  noVideosText: {
    fontSize: 16,
    marginTop: 10,
    textAlign: 'center',
  },
  actionButtonsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 10,
    gap: 8,
  },
  actionButtonText: {
    color: '#FFF0F0',
    fontSize: 16,
    fontWeight: 'bold',
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContent: {
    width: '80%',
    padding: 20,
    borderRadius: 15,
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  modalText: {
    fontSize: 18,
    textAlign: 'center',
    marginBottom: 20,
  },
  modalButton: {
    paddingVertical: 12,
    paddingHorizontal: 25,
    borderRadius: 10,
  },
  modalButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  loginPromptTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginTop: 15,
    marginBottom: 5,
  },
  loginPromptSubtitle: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 20,
  },
  loginPromptButton: {
    paddingVertical: 12,
    paddingHorizontal: 25,
    borderRadius: 10,
  },
  loginPromptButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 14,
    borderRadius: 10,
    marginTop: 10,
    gap: 8,
  },
  editButtonText: {
    color: '#FFF0F0',
    fontSize: 16,
    fontWeight: '600',
  },
  editModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  editModalContent: {
    width: '100%',
    maxWidth: 500,
    borderRadius: 16,
    padding: 20,
    maxHeight: '80%',
  },
  editModalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  editFormLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
    marginTop: 12,
  },
  editFormInput: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
  },
  editFormTextArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  editModalButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 20,
  },
  editModalButton: {
    flex: 1,
    padding: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  editModalButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
});

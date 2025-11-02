import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Dimensions, Image, KeyboardAvoidingView, Linking, Modal, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
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

// Helper function to detect video platform from URL
const getVideoPlatform = (url: string): 'tiktok' | 'instagram' | 'unknown' => {
  if (url.includes('tiktok.com') || url.includes('vm.tiktok.com')) return 'tiktok';
  if (url.includes('instagram.com') || url.includes('instagr.am')) return 'instagram';
  return 'unknown';
};

export default function Location() {
  const router = useRouter();
  const { id, needsCoordinates, readonly, source, locationData: locationDataParam } = useLocalSearchParams();
  const { theme } = useTheme();
  const { sessionToken } = useAuth();
  const { findLocationById, removeLocation, addBlockedLocation, refreshLocations } = useLocationContext();
  
  // Check if this is a readonly view (from followed folders)
  const isReadOnly = readonly === 'true';
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
  
  // Send invitation state
  const [showSendModal, setShowSendModal] = useState(false);
  const [friends, setFriends] = useState<any[]>([]);
  const [isLoadingFriends, setIsLoadingFriends] = useState(false);
  const [selectedFriendId, setSelectedFriendId] = useState<number | null>(null);
  const [invitationMessage, setInvitationMessage] = useState('');
  const [isSendingInvitation, setIsSendingInvitation] = useState(false);
  const [friendSearchQuery, setFriendSearchQuery] = useState('');
  
  // Review creation state
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [reviewRating, setReviewRating] = useState(0);
  const [reviewText, setReviewText] = useState('');
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);

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
      
      // Sort videos by platform priority (TikTok first) then by date (newest first)
      const sortedVideos = fetchedVideos.sort((a, b) => {
        const platformA = getVideoPlatform(a.url);
        const platformB = getVideoPlatform(b.url);
        
        // TikTok videos get priority (appear first)
        if (platformA === 'tiktok' && platformB !== 'tiktok') return -1;
        if (platformA !== 'tiktok' && platformB === 'tiktok') return 1;
        
        // If same platform, maintain original order (or could sort by date if available)
        return 0;
      });
      
      setVideos(sortedVideos);
      
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
    console.log('📦 [Location] locationData param:', locationDataParam);
    
    if (id) {
      console.log('🔍 Looking up location data for ID:', id);
      
      // First, check if location data was passed directly (from reviews/activity)
      if (locationDataParam) {
        try {
          const passedData = JSON.parse(decodeURIComponent(locationDataParam as string));
          console.log('✅ Using passed location data from navigation:', passedData);
          
          const passedLocation = passedData.location;
          const passedTopPosts = passedData.topPosts || [];
          
          // Transform the passed location data to LocationData format
          const transformedLocation: LocationData = {
            id: String(passedLocation.id),
            title: passedLocation.title,
            description: passedLocation.description,
            emoji: passedLocation.emoji,
            latitude: passedLocation.latitude || 0,
            longitude: passedLocation.longitude || 0,
            isValidLocation: passedLocation.isValidLocation,
            websiteUrl: passedLocation.websiteUrl,
            phoneNumber: passedLocation.phoneNumber,
            address: passedLocation.address,
            createdAt: passedLocation.createdAt,
            tiktokVideos: [], // Will be set from topPosts
          };
          setLocationData(transformedLocation);
          
          // Use the topPosts that were passed instead of fetching
          if (passedTopPosts.length > 0) {
            console.log('📦 Using passed topPosts instead of fetching:', passedTopPosts);
            const fetchedVideos: VideoPost[] = passedTopPosts.map((item: any) => ({
              id: String(item.id),
              url: item.url || '',
              title: item.title || '',
              description: item.description || ''
            })).filter((video: VideoPost) => video.url);
            
            // Sort videos by platform priority (TikTok first)
            const sortedVideos = fetchedVideos.sort((a, b) => {
              const platformA = getVideoPlatform(a.url);
              const platformB = getVideoPlatform(b.url);
              if (platformA === 'tiktok' && platformB !== 'tiktok') return -1;
              if (platformA !== 'tiktok' && platformB === 'tiktok') return 1;
              return 0;
            });
            
            setVideos(sortedVideos);
          } else {
            // No topPosts passed, fetch them
            fetchLocationVideos(transformedLocation.id);
          }
          
          setIsSelectingCoords(needsCoordinates === 'true');
          return;
        } catch (error) {
          console.error('❌ Failed to parse passed location data:', error);
          // Fall through to other methods
        }
      }
      
      // Try to find the location in the stored locations (user's saved locations)
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
  }, [id, sessionToken, locationDataParam]);

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

  const openDirections = async () => {
    if (!locationData || !locationData.address) return;
    
    const address = encodeURIComponent(locationData.address);
    try {
      const pref = await AsyncStorage.getItem('DEFAULT_MAPS_APP');
      const useGoogle = pref === 'google';
      if (useGoogle) {
        const url = `https://www.google.com/maps/dir/?api=1&destination=${address}`;
        Linking.openURL(url);
      } else {
        const url = `http://maps.apple.com/?daddr=${address}`;
        Linking.openURL(url);
      }
    } catch {
      // Fallback to platform default
      if (Platform.OS === 'ios') {
        const url = `http://maps.apple.com/?daddr=${address}`;
        Linking.openURL(url);
      } else {
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

  // Fetch friends list
  const fetchFriends = async () => {
    try {
      setIsLoadingFriends(true);
      console.log('👥 [Location] Fetching friends list...');

      const response = await fetch(`${API_CONFIG.BASE_URL}/friends`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${sessionToken}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch friends: ${response.status}`);
      }

      const data = await response.json();
      console.log('👥 [Location] Fetched friends:', data.length);
      setFriends(data);
    } catch (error) {
      console.error('👥 [Location] Error fetching friends:', error);
      Alert.alert('Error', 'Failed to load friends list');
    } finally {
      setIsLoadingFriends(false);
    }
  };

  // Send location invitation
  const sendInvitation = async () => {
    if (!selectedFriendId || !locationData) {
      Alert.alert('Error', 'Please select a friend');
      return;
    }

    try {
      setIsSendingInvitation(true);
      console.log('📤 [Location] Sending invitation...');

      const response = await fetch(`${API_CONFIG.BASE_URL}/location-invitation`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${sessionToken}`,
        },
        body: JSON.stringify({
          recipientUserId: selectedFriendId,
          mapPointId: parseInt(locationData.id),
          message: invitationMessage.trim() || '',
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || `Failed to send invitation: ${response.status}`);
      }

      console.log('📤 [Location] Invitation sent successfully');
      
      // Reset modal state
      setShowSendModal(false);
      setSelectedFriendId(null);
      setInvitationMessage('');
      
      Alert.alert('Success', 'Location invitation sent!');
    } catch (error) {
      console.error('📤 [Location] Error sending invitation:', error);
      Alert.alert(
        'Error',
        error instanceof Error ? error.message : 'Failed to send invitation'
      );
    } finally {
      setIsSendingInvitation(false);
    }
  };

  // Open send modal
  const handleOpenSendModal = () => {
    setShowSendModal(true);
    setFriendSearchQuery('');
    setSelectedFriendId(null);
    setInvitationMessage('');
    fetchFriends();
  };

  // Filter friends based on search query
  const filteredFriends = friends.filter(friend => 
    friend.username.toLowerCase().includes(friendSearchQuery.toLowerCase()) ||
    (friend.email && friend.email.toLowerCase().includes(friendSearchQuery.toLowerCase()))
  );

  // Submit review
  const submitReview = async () => {
    if (!locationData || !sessionToken) return;

    // Validation
    if (reviewRating < 1 || reviewRating > 5) {
      Alert.alert('Error', 'Please select a rating (1-5 stars)');
      return;
    }

    try {
      setIsSubmittingReview(true);
      console.log('📝 [Location] Submitting review...');

      const response = await fetch(`${API_CONFIG.BASE_URL}/location-review`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${sessionToken}`,
        },
        body: JSON.stringify({
          mapPointId: parseInt(locationData.id),
          rating: reviewRating,
          review: reviewText.trim() || '',
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || `Failed to submit review: ${response.status}`);
      }

      console.log('📝 [Location] Review submitted successfully');
      
      // Reset and close modal
      setShowReviewModal(false);
      setReviewRating(0);
      setReviewText('');
      
      Alert.alert('Success', 'Your review has been submitted!');
    } catch (error) {
      console.error('📝 [Location] Error submitting review:', error);
      Alert.alert(
        'Error',
        error instanceof Error ? error.message : 'Failed to submit review'
      );
    } finally {
      setIsSubmittingReview(false);
    }
  };

  const handleDeleteLocation = async () => {
    if (!locationData || !sessionToken) return;
    
    Alert.alert(
      'Delete Location',
      'Are you sure you want to delete this location? This action cannot be undone.',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              console.log('🗑️ [Location] Deleting location:', locationData.id);
              
              const response = await fetch(`${API_CONFIG.BASE_URL}/map/${locationData.id}`, {
                method: 'DELETE',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${sessionToken}`,
                },
              });
              
              if (!response.ok) {
                throw new Error(`Failed to delete location: ${response.status}`);
              }
              
              console.log('✅ [Location] Location deleted successfully');
              
              // Refresh locations via context
              refreshLocations();
              
              // Navigate back
              router.back();
              
              Alert.alert('Success', 'Location deleted successfully!');
              
            } catch (error) {
              console.error('❌ [Location] Error deleting location:', error);
              Alert.alert('Error', 'Failed to delete location. Please try again.');
            }
          },
        },
      ]
    );
  };

  if (!locationData) {
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <Text style={[styles.loadingText, { color: theme.colors.text }]}>Loading...</Text>
        <TouchableOpacity 
          style={[styles.loadingButton, { backgroundColor: theme.colors.primary }]}
          onPress={() => setLocationData(mockLocationData['1'])}
        >
          <Text style={[styles.loadingButtonText, { color: '#FFFFFF' }]}>Load Demo Location</Text>
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
        <View style={[styles.header, { backgroundColor: theme.colors.background }]}>          
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
            <Text style={{ color: '#FFFFFF', fontWeight: 'bold', fontSize: 16 }}>
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
      <View style={[styles.header, { backgroundColor: theme.colors.background }]}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={theme.colors.text} />
        </TouchableOpacity>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Hero Section */}
        <View style={[styles.heroSection, { backgroundColor: theme.colors.background }]}>
          <View style={styles.heroContent}>
            <Text style={[styles.locationName, { color: theme.colors.text }]}>{locationData.title}</Text>
            {/* Action Icons */}
            <View style={styles.actionIconsContainer}>
              {!isReadOnly && (
                <TouchableOpacity 
                  style={styles.actionIcon}
                  onPress={handleOpenSendModal}
                >
                  <Ionicons name="paper-plane-outline" size={28} color={theme.colors.primary} />
                </TouchableOpacity>
              )}
              {!isReadOnly && (
                <TouchableOpacity 
                  style={styles.actionIcon}
                  onPress={handleEditPress}
                >
                  <Ionicons name="pencil" size={28} color={theme.colors.primary} />
                </TouchableOpacity>
              )}
              {!isReadOnly && (
                <TouchableOpacity 
                  style={styles.actionIcon}
                  onPress={handleDeleteLocation}
                >
                  <Ionicons name="trash-outline" size={28} color="#ff6b6b" />
                </TouchableOpacity>
              )}
            </View>
            
            {/* Review Button */}
            {!isReadOnly && (
              <TouchableOpacity 
                style={[styles.reviewButton, { backgroundColor: theme.colors.primary }]}
                onPress={() => setShowReviewModal(true)}
              >
                <Text style={styles.reviewButtonText}>Review</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Description Section */}
        <View style={[styles.section, { backgroundColor: theme.colors.background }]}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>About</Text>
          <Text style={[styles.description, { color: theme.colors.textSecondary }]}>{locationData.description}</Text>
        </View>

        {/* Contact Info Section */}
        <View style={[styles.section, { backgroundColor: theme.colors.background }]}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Contact & Hours</Text>
          
          <TouchableOpacity 
            style={styles.contactItem}
            onPress={openDirections}
            activeOpacity={0.7}
          >
            <Ionicons name="location" size={20} color={theme.colors.primary} />
            <Text style={[styles.contactText, styles.clickableAddress, { color: theme.colors.primary }]}>
              {locationData.address}
            </Text>
            <Ionicons name="chevron-forward" size={18} color={theme.colors.primary} style={{ marginLeft: 'auto' }} />
          </TouchableOpacity>
          
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
        </View>

        {/* TikTok Videos Section - Only show for authenticated users */}
        {sessionToken && (
          <View style={[styles.section, { backgroundColor: theme.colors.background }]}>
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
                videos.map((video, index) => {
                  const platform = getVideoPlatform(video.url);
                  
                  return (
                    <TouchableOpacity 
                      key={video.id} 
                      style={[styles.videoTile, { backgroundColor: theme.colors.background, shadowColor: theme.colors.shadow }]}
                      onPress={() => handleVideoPress(video.url)}
                    >
                      <View style={styles.videoThumbnail}>
                        <WebView
                          source={{
                            html: platform === 'instagram' ? `
                              <!DOCTYPE html>
                              <html>
                              <head>
                                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                                <style>
                                  * {
                                    margin: 0;
                                    padding: 0;
                                    box-sizing: border-box;
                                  }
                                  html, body { 
                                    width: 100%;
                                    height: 100%;
                                    overflow: hidden;
                                    background: transparent;
                                  }
                                  body {
                                    position: relative;
                                  }
                                  #instagram-container {
                                    position: absolute;
                                    top: 0;
                                    left: 0;
                                    right: 0;
                                    bottom: 0;
                                    display: flex;
                                    justify-content: center;
                                    align-items: center;
                                    overflow: hidden;
                                    pointer-events: none;
                                  }
                                  .instagram-media {
                                    max-width: 50% !important;
                                    width: 50% !important;
                                    margin: 0 auto !important;
                                    transform: scale(0.79) translateY(6%);
                                  }
                                  iframe {
                                    pointer-events: none;
                                  }
                                </style>
                              </head>
                              <body>
                                <div id="instagram-container">
                                  <blockquote 
                                    class="instagram-media" 
                                    data-instgrm-permalink="${video.url}" 
                                    data-instgrm-version="14" 
                                    style="background:#FFF; border:0; border-radius:3px; box-shadow:0 0 1px 0 rgba(0,0,0,0.5),0 1px 10px 0 rgba(0,0,0,0.15); margin: 1px; max-width:540px; min-width:326px; padding:0; width:99.375%; width:-webkit-calc(100% - 2px); width:calc(100% - 2px);"
                                  >
                                    <div style="padding:16px;"> 
                                      <a href="${video.url}" style="background:#FFFFFF; line-height:0; padding:0 0; text-align:center; text-decoration:none; width:100%;" target="_blank">Instagram Video</a>
                                    </div>
                                  </blockquote>
                                </div>
                                <script async src="https://www.instagram.com/embed.js"><\/script>
                              </body>
                              </html>
                            ` : `
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
                  );
                })
              )}
            </View>
          </View>
        )}
      </ScrollView>

      {/* Full Screen Video Modal */}
      {selectedVideo && (() => {
        const modalPlatform = getVideoPlatform(selectedVideo);
        const isInstagram = modalPlatform === 'instagram';
        
        return (
          <View style={styles.videoModal}>
            <View style={styles.videoModalContent}>
              <TouchableOpacity style={styles.closeVideoButton} onPress={closeVideo}>
                <Ionicons name="close" size={24} color="#FFFFFF" />
              </TouchableOpacity>
              <WebView
                key={selectedVideo}
                source={{ 
                  html: isInstagram ? `
                    <!DOCTYPE html>
                    <html>
                    <head>
                      <meta name="viewport" content="width=device-width, initial-scale=1.0">
                      <style>
                        * {
                          margin: 0;
                          padding: 0;
                          box-sizing: border-box;
                        }
                        html, body { 
                          width: 100%;
                          height: 100%;
                          overflow: hidden;
                          background: transparent;
                        }
                        body {
                          position: relative;
                        }
                        #instagram-container {
                          position: absolute;
                          top: -55px;
                          left: 50%;
                          transform: translateX(-50%);
                          width: 143%;
                          height: 190%;
                          overflow: hidden;
                        }
                        .instagram-media {
                          max-width: 100% !important;
                          width: 100% !important;
                          margin: 0 auto !important;
                          background: transparent !important;
                        }
                        blockquote {
                          background: transparent !important;
                        }
                      </style>
                    </head>
                    <body>
                      <div id="instagram-container">
                        <blockquote 
                          class="instagram-media" 
                          data-instgrm-permalink="${selectedVideo}" 
                          data-instgrm-version="14" 
                          style="background:#FFF; border:0; border-radius:3px; box-shadow:0 0 1px 0 rgba(0,0,0,0.5),0 1px 10px 0 rgba(0,0,0,0.15); margin: 1px; max-width:540px; min-width:326px; padding:0; width:99.375%; width:-webkit-calc(100% - 2px); width:calc(100% - 2px);"
                        >
                          <div style="padding:16px;"> 
                            <a href="${selectedVideo}" style="background:#FFFFFF; line-height:0; padding:0 0; text-align:center; text-decoration:none; width:100%;" target="_blank">Instagram Video</a>
                          </div>
                        </blockquote>
                      </div>
                      <script async src="https://www.instagram.com/embed.js"><\/script>
                    </body>
                    </html>
                  ` : `
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
              <View style={styles.videoLinkContainer}>
                <TouchableOpacity 
                  style={[styles.videoLinkButton, { backgroundColor: theme.colors.primary }]}
                  onPress={() => {
                    if (selectedVideo) {
                      Linking.openURL(selectedVideo);
                    }
                  }}
                >
                  <Ionicons name="link" size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
                  <Text style={styles.videoLinkText}>
                    {isInstagram ? 'Open in Instagram' : 'Open in TikTok'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        );
      })()}

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
              <Text style={[styles.modalButtonText, { color: '#FFFFFF' }]}>OK</Text>
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
          <View style={[styles.editModalContent, { backgroundColor: theme.colors.surface }]}>
            {/* Header with Close Button */}
            <View style={[styles.editModalHeader, { 
              backgroundColor: theme.colors.surface,
            }]}>
              <View style={styles.editModalHandleBar} />
              <View style={styles.editModalHeaderContent}>
                <Text style={[styles.editModalTitle, { color: theme.colors.text }]}>Edit Location</Text>
                <TouchableOpacity 
                  style={styles.editModalCloseButton} 
                  onPress={handleCancelEdit}
                  disabled={isSavingEdit}
                >
                  <Ionicons name="close" size={24} color={theme.colors.textSecondary} />
                </TouchableOpacity>
              </View>
            </View>

            {/* Scrollable Content */}
            <ScrollView 
              style={styles.editModalScrollView}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.editModalScrollContent}
              keyboardShouldPersistTaps="handled"
            >
              {/* Title Input */}
              <View style={styles.inputGroup}>
                <Text style={[styles.editFormLabel, { color: theme.colors.text }]}>
                  Title {editFormData.title.length > 0 && (
                    <Text style={[styles.characterCount, { color: theme.colors.textSecondary }]}>
                      ({editFormData.title.length}/100)
                    </Text>
                  )}
                </Text>
                <View style={styles.inputWithClearContainer}>
                  <TextInput
                    style={[styles.editFormInput, styles.inputWithClear, { 
                      backgroundColor: theme.colors.background,
                      color: theme.colors.text,
                      borderColor: theme.colors.border,
                    }]}
                    value={editFormData.title}
                    onChangeText={(text) => setEditFormData({ ...editFormData, title: text.slice(0, 100) })}
                    placeholder="Enter location title"
                    placeholderTextColor={theme.colors.textSecondary}
                    maxLength={100}
                  />
                  {editFormData.title.length > 0 && (
                    <TouchableOpacity
                      style={styles.clearButton}
                      onPress={() => setEditFormData({ ...editFormData, title: '' })}
                    >
                      <Ionicons name="close-circle" size={20} color={theme.colors.textSecondary} />
                    </TouchableOpacity>
                  )}
                </View>
              </View>

              {/* Address Input */}
              <View style={styles.inputGroup}>
                <View style={styles.labelWithIcon}>
                  <Ionicons name="location-outline" size={18} color={theme.colors.primary} />
                  <Text style={[styles.editFormLabel, { color: theme.colors.text, marginTop: 0 }]}>Address</Text>
                </View>
                <View style={styles.inputWithClearContainer}>
                  <TextInput
                    style={[styles.editFormInput, styles.inputWithClear, { 
                      backgroundColor: theme.colors.background,
                      color: theme.colors.text,
                      borderColor: theme.colors.border,
                    }]}
                    value={editFormData.address}
                    onChangeText={(text) => setEditFormData({ ...editFormData, address: text })}
                    placeholder="123 Main St, City, State"
                    placeholderTextColor={theme.colors.textSecondary}
                  />
                  {editFormData.address.length > 0 && (
                    <TouchableOpacity
                      style={styles.clearButton}
                      onPress={() => setEditFormData({ ...editFormData, address: '' })}
                    >
                      <Ionicons name="close-circle" size={20} color={theme.colors.textSecondary} />
                    </TouchableOpacity>
                  )}
                </View>
              </View>

              {/* Emoji Input */}
              <View style={styles.inputGroup}>
                <Text style={[styles.editFormLabel, { color: theme.colors.text }]}>Emoji</Text>
                <View style={styles.emojiInputContainer}>
                  <View style={styles.emojiInputWrapper}>
                    <TextInput
                      style={[styles.editFormInput, styles.emojiInput, { 
                        backgroundColor: theme.colors.background,
                        color: theme.colors.text,
                        borderColor: theme.colors.border,
                        fontSize: 32,
                        textAlign: 'center',
                        textAlignVertical: 'center',
                      }]}
                      value={editFormData.emoji}
                      onChangeText={(text) => setEditFormData({ ...editFormData, emoji: text.slice(0, 2) })}
                      placeholder=""
                      placeholderTextColor={theme.colors.textSecondary}
                      maxLength={2}
                    />
                    {editFormData.emoji.length > 0 && (
                      <TouchableOpacity
                        style={styles.emojiClearButton}
                        onPress={() => setEditFormData({ ...editFormData, emoji: '' })}
                      >
                        <Ionicons name="close-circle" size={20} color={theme.colors.textSecondary} />
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              </View>

              {/* Description Input */}
              <View style={styles.inputGroup}>
                <Text style={[styles.editFormLabel, { color: theme.colors.text }]}>
                  Description {editFormData.description.length > 0 && (
                    <Text style={[styles.characterCount, { color: theme.colors.textSecondary }]}>
                      ({editFormData.description.length}/500)
                    </Text>
                  )}
                </Text>
                <View style={styles.inputWithClearContainer}>
                  <TextInput
                    style={[styles.editFormInput, styles.editFormTextArea, styles.inputWithClear, { 
                      backgroundColor: theme.colors.background,
                      color: theme.colors.text,
                      borderColor: theme.colors.border,
                    }]}
                    value={editFormData.description}
                    onChangeText={(text) => setEditFormData({ ...editFormData, description: text.slice(0, 500) })}
                    placeholder="Describe this location..."
                    placeholderTextColor={theme.colors.textSecondary}
                    multiline
                    numberOfLines={4}
                    textAlignVertical="top"
                    maxLength={500}
                  />
                  {editFormData.description.length > 0 && (
                    <TouchableOpacity
                      style={[styles.clearButton, styles.textAreaClearButton]}
                      onPress={() => setEditFormData({ ...editFormData, description: '' })}
                    >
                      <Ionicons name="close-circle" size={20} color={theme.colors.textSecondary} />
                    </TouchableOpacity>
                  )}
                </View>
              </View>

              {/* Contact Information Section */}
              <View style={[styles.formSection, { borderTopColor: theme.colors.border }]}>
                <Text style={[styles.formSectionTitle, { color: theme.colors.text }]}>Contact Information</Text>
                
                {/* Phone Number Input */}
                <View style={styles.inputGroup}>
                  <View style={styles.labelWithIcon}>
                    <Ionicons name="call-outline" size={18} color={theme.colors.primary} />
                    <Text style={[styles.editFormLabel, { color: theme.colors.text, marginTop: 0 }]}>Phone Number</Text>
                  </View>
                  <View style={styles.inputWithClearContainer}>
                    <TextInput
                      style={[styles.editFormInput, styles.inputWithClear, { 
                        backgroundColor: theme.colors.background,
                        color: theme.colors.text,
                        borderColor: theme.colors.border,
                      }]}
                      value={editFormData.phoneNumber}
                      onChangeText={(text) => setEditFormData({ ...editFormData, phoneNumber: text })}
                      placeholder="(555) 123-4567"
                      placeholderTextColor={theme.colors.textSecondary}
                      keyboardType="phone-pad"
                    />
                    {editFormData.phoneNumber.length > 0 && (
                      <TouchableOpacity
                        style={styles.clearButton}
                        onPress={() => setEditFormData({ ...editFormData, phoneNumber: '' })}
                      >
                        <Ionicons name="close-circle" size={20} color={theme.colors.textSecondary} />
                      </TouchableOpacity>
                    )}
                  </View>
                </View>

                {/* Website URL Input */}
                <View style={styles.inputGroup}>
                  <View style={styles.labelWithIcon}>
                    <Ionicons name="globe-outline" size={18} color={theme.colors.primary} />
                    <Text style={[styles.editFormLabel, { color: theme.colors.text, marginTop: 0 }]}>Website</Text>
                  </View>
                  <View style={styles.inputWithClearContainer}>
                    <TextInput
                      style={[styles.editFormInput, styles.inputWithClear, { 
                        backgroundColor: theme.colors.background,
                        color: theme.colors.text,
                        borderColor: theme.colors.border,
                      }]}
                      value={editFormData.websiteUrl}
                      onChangeText={(text) => setEditFormData({ ...editFormData, websiteUrl: text })}
                      placeholder="www.example.com"
                      placeholderTextColor={theme.colors.textSecondary}
                      keyboardType="url"
                      autoCapitalize="none"
                    />
                    {editFormData.websiteUrl.length > 0 && (
                      <TouchableOpacity
                        style={styles.clearButton}
                        onPress={() => setEditFormData({ ...editFormData, websiteUrl: '' })}
                      >
                        <Ionicons name="close-circle" size={20} color={theme.colors.textSecondary} />
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              </View>
            </ScrollView>

            {/* Fixed Footer Buttons */}
            <View style={[styles.editModalFooter, { 
              backgroundColor: theme.colors.surface,
            }]}>
              <TouchableOpacity
                style={[styles.editModalButton, styles.cancelButton, { 
                  backgroundColor: 'transparent',
                  borderWidth: 2,
                  borderColor: theme.colors.border,
                }]}
                onPress={handleCancelEdit}
                disabled={isSavingEdit}
              >
                <Text style={[styles.cancelButtonText, { color: theme.colors.text }]}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.editModalButton, styles.saveButton, { 
                  backgroundColor: theme.colors.primary,
                  opacity: isSavingEdit ? 0.7 : 1,
                }]}
                onPress={handleSaveEdit}
                disabled={isSavingEdit}
              >
                {isSavingEdit ? (
                  <View style={styles.savingContainer}>
                    <Text style={[styles.saveButtonText, { color: '#FFFFFF' }]}>Saving</Text>
                  </View>
                ) : (
                  <Text style={[styles.saveButtonText, { color: '#FFFFFF' }]}>Save Changes</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Send to Friend Modal */}
      <Modal
        visible={showSendModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowSendModal(false)}
      >
        <View style={styles.editModalOverlay}>
          <View style={[styles.editModalContent, { backgroundColor: theme.colors.surface }]}>
            {/* Modal Header */}
            <View style={[styles.editModalHeader, { 
              backgroundColor: theme.colors.surface,
            }]}>
              <View style={styles.editModalHandleBar} />
              <View style={styles.editModalHeaderContent}>
                <Text style={[styles.editModalTitle, { color: theme.colors.text }]}>
                  Send to Friend
                </Text>
                <TouchableOpacity 
                  style={styles.editModalCloseButton} 
                  onPress={() => setShowSendModal(false)}
                  disabled={isSendingInvitation}
                >
                  <Ionicons name="close" size={24} color={theme.colors.textSecondary} />
                </TouchableOpacity>
              </View>
            </View>

            <ScrollView 
              style={styles.editModalScrollView}
              contentContainerStyle={styles.sendModalScrollContent}
              showsVerticalScrollIndicator={false}
            >
              {/* Message Input */}
              <View style={styles.sendModalSection}>
                <Text style={[styles.sendModalSectionTitle, { color: theme.colors.text }]}>
                  Your Message (Optional)
                </Text>
                <TextInput
                  style={[styles.sendModalTextArea, { 
                    backgroundColor: theme.colors.background,
                    color: theme.colors.text,
                    borderColor: theme.colors.border,
                  }]}
                  value={invitationMessage}
                  onChangeText={setInvitationMessage}
                  placeholder="Write a message to your friend..."
                  placeholderTextColor={theme.colors.textSecondary}
                  multiline
                  numberOfLines={4}
                  textAlignVertical="top"
                />
              </View>

              {/* Friends List */}
              <View style={styles.sendModalSection}>
                <Text style={[styles.sendModalSectionTitle, { color: theme.colors.text }]}>
                  Select Friend
                </Text>
                
                {/* Search Input */}
                {friends.length > 0 && (
                  <View style={styles.searchInputContainer}>
                    <Ionicons name="search" size={20} color={theme.colors.textSecondary} style={styles.searchIcon} />
                    <TextInput
                      style={[styles.searchInput, { 
                        backgroundColor: theme.colors.background,
                        color: theme.colors.text,
                        borderColor: theme.colors.border,
                      }]}
                      value={friendSearchQuery}
                      onChangeText={setFriendSearchQuery}
                      placeholder="Search friends..."
                      placeholderTextColor={theme.colors.textSecondary}
                      autoCapitalize="none"
                      autoCorrect={false}
                    />
                    {friendSearchQuery.length > 0 && (
                      <TouchableOpacity
                        style={styles.clearSearchButton}
                        onPress={() => setFriendSearchQuery('')}
                      >
                        <Ionicons name="close-circle" size={20} color={theme.colors.textSecondary} />
                      </TouchableOpacity>
                    )}
                  </View>
                )}
                
                {isLoadingFriends ? (
                  <View style={styles.loadingFriendsContainer}>
                    <ActivityIndicator size="small" color={theme.colors.primary} />
                    <Text style={[styles.loadingFriendsText, { color: theme.colors.textSecondary }]}>
                      Loading friends...
                    </Text>
                  </View>
                ) : friends.length === 0 ? (
                  <View style={styles.noFriendsContainer}>
                    <Ionicons name="person-add-outline" size={48} color={theme.colors.textSecondary} />
                    <Text style={[styles.noFriendsText, { color: theme.colors.textSecondary }]}>
                      No friends yet
                    </Text>
                    <Text style={[styles.noFriendsSubtext, { color: theme.colors.textSecondary }]}>
                      Add friends to share locations with them
                    </Text>
                  </View>
                ) : filteredFriends.length === 0 ? (
                  <View style={styles.noSearchResultsContainer}>
                    <Ionicons name="search-outline" size={48} color={theme.colors.textSecondary} />
                    <Text style={[styles.noSearchResultsText, { color: theme.colors.textSecondary }]}>
                      No friends found
                    </Text>
                    <Text style={[styles.noSearchResultsSubtext, { color: theme.colors.textSecondary }]}>
                      Try a different search term
                    </Text>
                  </View>
                ) : (
                  <View style={styles.sendModalFriendsList}>
                    {filteredFriends.map((friend: any) => (
                      <TouchableOpacity
                        key={friend.id}
                        style={[
                          styles.sendModalFriendItem,
                          {
                            backgroundColor: selectedFriendId === friend.id 
                              ? theme.colors.primary + '15' 
                              : theme.colors.background,
                            borderColor: selectedFriendId === friend.id
                              ? theme.colors.primary
                              : theme.colors.border,
                          }
                        ]}
                        onPress={() => setSelectedFriendId(friend.id)}
                      >
                        {friend.pfpUrl ? (
                          <Image 
                            source={{ uri: friend.pfpUrl }} 
                            style={styles.sendModalFriendAvatar} 
                          />
                        ) : (
                          <View style={[styles.sendModalFriendAvatarPlaceholder, { 
                            backgroundColor: theme.colors.primary 
                          }]}>
                            <Ionicons name="person" size={22} color={theme.colors.surface} />
                          </View>
                        )}
                        <View style={styles.sendModalFriendInfo}>
                          <Text style={[styles.sendModalFriendName, { color: theme.colors.text }]}>
                            {friend.username}
                          </Text>
                          {friend.email && (
                            <Text style={[styles.sendModalFriendEmail, { color: theme.colors.textSecondary }]}>
                              {friend.username}
                            </Text>
                          )}
                        </View>
                        {selectedFriendId === friend.id && (
                          <Ionicons name="checkmark-circle" size={26} color={theme.colors.primary} />
                        )}
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </View>
            </ScrollView>

            {/* Footer Buttons */}
            <View style={[styles.editModalFooter, { 
              backgroundColor: theme.colors.surface,
            }]}>
              <TouchableOpacity
                style={[styles.editModalButton, styles.cancelButton, { 
                  backgroundColor: 'transparent',
                  borderWidth: 2,
                  borderColor: theme.colors.border,
                }]}
                onPress={() => setShowSendModal(false)}
                disabled={isSendingInvitation}
              >
                <Text style={[styles.cancelButtonText, { color: theme.colors.text }]}>
                  Cancel
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.editModalButton, styles.saveButton, { 
                  backgroundColor: theme.colors.primary,
                  opacity: isSendingInvitation || !selectedFriendId ? 0.5 : 1,
                }]}
                onPress={sendInvitation}
                disabled={isSendingInvitation || !selectedFriendId}
              >
                {isSendingInvitation ? (
                  <View style={styles.savingContainer}>
                    <ActivityIndicator size="small" color="#FFFFFF" />
                    <Text style={[styles.saveButtonText, { color: '#FFFFFF', marginLeft: 8 }]}>
                      Sending
                    </Text>
                  </View>
                ) : (
                  <Text style={[styles.saveButtonText, { color: '#FFFFFF' }]}>
                    Send Invitation
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Review Creation Modal */}
      <Modal
        visible={showReviewModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowReviewModal(false)}
      >
        <View style={styles.editModalOverlay}>
          <KeyboardAvoidingView 
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.keyboardAvoidingView}
            keyboardVerticalOffset={0}
          >
            <View style={[styles.editModalContent, { backgroundColor: theme.colors.surface }]}>
              {/* Header */}
              <View style={[styles.editModalHeader, { 
                backgroundColor: theme.colors.surface,
              }]}>
                <View style={styles.editModalHandleBar} />
                <View style={styles.editModalHeaderContent}>
                  <Text style={[styles.editModalTitle, { color: theme.colors.text }]}>
                    Write Review
                  </Text>
                  <TouchableOpacity 
                    style={styles.editModalCloseButton} 
                    onPress={() => setShowReviewModal(false)}
                    disabled={isSubmittingReview}
                  >
                    <Ionicons name="close" size={24} color={theme.colors.textSecondary} />
                  </TouchableOpacity>
                </View>
              </View>

              <ScrollView 
                style={styles.editModalScrollView}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.editModalScrollContent}
                keyboardShouldPersistTaps="handled"
                scrollEnabled={true}
              >
                {/* Location Preview */}
                <View style={[styles.reviewLocationPreview, { backgroundColor: theme.colors.background }]}>
                  <Text style={styles.reviewLocationEmoji}>{locationData.emoji}</Text>
                  <Text style={[styles.reviewLocationTitle, { color: theme.colors.text }]}>
                    {locationData.title}
                  </Text>
                </View>

                {/* Rating Selector */}
                <View style={styles.ratingSelector}>
                  {[1, 2, 3, 4, 5].map((star) => (
                    <TouchableOpacity
                      key={star}
                      style={styles.starButton}
                      onPress={() => setReviewRating(star)}
                    >
                      <Ionicons
                        name={reviewRating >= star ? "star" : "star-outline"}
                        size={40}
                        color="#FFD700"
                      />
                    </TouchableOpacity>
                  ))}
                </View>

                {/* Review Text Input */}
                <View style={styles.inputGroup}>
                <Text style={[styles.editFormLabel, { color: theme.colors.text }]}>
                  Your Review (Optional)
                </Text>
                  <View style={[styles.reviewTextInputContainer, {
                    backgroundColor: theme.colors.background,
                    borderColor: theme.colors.border,
                  }]}>
                    <TextInput
                      style={[styles.reviewTextInput, { 
                        color: theme.colors.text,
                      }]}
                      value={reviewText}
                      onChangeText={(text) => {
                        if (text.length <= 1000) {
                          setReviewText(text);
                        }
                      }}
                    placeholder="Share your experience with your friends..."
                    placeholderTextColor={theme.colors.textSecondary}
                    multiline
                    numberOfLines={5}
                    textAlignVertical="top"
                    maxLength={1000}
                    />
                    <View style={styles.reviewTextInputFooter}>
                      <Text style={[styles.characterCount, { color: theme.colors.textSecondary }]}>
                        {reviewText.length}/1000
                      </Text>
                    </View>
                  </View>
                </View>
              </ScrollView>

              {/* Footer Buttons */}
              <View style={[styles.editModalFooter, { 
                backgroundColor: theme.colors.surface,
              }]}>
                <TouchableOpacity
                  style={[styles.editModalButton, styles.cancelButton, { 
                    backgroundColor: 'transparent',
                    borderWidth: 2,
                    borderColor: theme.colors.border,
                  }]}
                  onPress={() => {
                    setShowReviewModal(false);
                    setReviewRating(0);
                    setReviewText('');
                  }}
                  disabled={isSubmittingReview}
                >
                  <Text style={[styles.cancelButtonText, { color: theme.colors.text }]}>
                    Cancel
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.editModalButton, styles.saveButton, { 
                    backgroundColor: theme.colors.primary,
                    opacity: (isSubmittingReview || reviewRating === 0) ? 0.5 : 1,
                  }]}
                  onPress={submitReview}
                  disabled={isSubmittingReview || reviewRating === 0}
                >
                  {isSubmittingReview ? (
                    <View style={styles.savingContainer}>
                      <ActivityIndicator size="small" color="#FFFFFF" />
                      <Text style={[styles.saveButtonText, { color: '#FFFFFF', marginLeft: 8 }]}>
                        Submitting
                      </Text>
                    </View>
                  ) : (
                    <Text style={[styles.saveButtonText, { color: '#FFFFFF' }]}>
                      Submit Review
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </KeyboardAvoidingView>
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
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
  },
  heroContent: {
    alignItems: 'center',
  },
  actionIconsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 24,
    marginTop: 12,
  },
  actionIcon: {
    padding: 10,
    borderRadius: 12,
    backgroundColor: '#f5f5f5',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  reviewButton: {
    marginTop: 16,
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 3,
    },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 4,
  },
  reviewButtonText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '600',
    letterSpacing: 0.3,
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
    paddingVertical: 12,
    marginTop: 0,
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
  clickableAddress: {
    fontWeight: '600',
    textDecorationLine: 'underline',
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
    color: '#666666',
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
    backgroundColor: 'transparent',
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
  videoLinkContainer: {
    padding: 16,
    backgroundColor: 'transparent',
  },
  videoLinkButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  videoLinkText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
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
    color: '#FFFFFF',
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
    color: '#FFFFFF',
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
    color: '#FFFFFF',
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
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 14,
    borderRadius: 10,
    marginTop: 10,
    gap: 8,
  },
  deleteButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  editModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'flex-end',
  },
  keyboardAvoidingView: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  editModalContent: {
    width: '100%',
    height: '92%',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 16,
    display: 'flex',
    flexDirection: 'column',
  },
  editModalHeader: {
    paddingTop: 12,
    paddingBottom: 16,
    paddingHorizontal: 24,
    flexShrink: 0,
  },
  editModalHandleBar: {
    width: 40,
    height: 4,
    backgroundColor: '#CBD5E0',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 16,
  },
  editModalHeaderContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  editModalTitle: {
    fontSize: 26,
    fontWeight: '700',
    textAlign: 'center',
    letterSpacing: -0.5,
  },
  editModalCloseButton: {
    position: 'absolute',
    right: 0,
    padding: 4,
  },
  editModalScrollView: {
    flex: 1,
    flexGrow: 1,
  },
  editModalScrollContent: {
    padding: 20,
    paddingTop: 12,
    paddingBottom: 32,
  },
  inputGroup: {
    marginBottom: 12,
  },
  editFormLabel: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 10,
    marginTop: 4,
    letterSpacing: 0.2,
  },
  characterCount: {
    fontSize: 13,
    fontWeight: '400',
  },
  editFormInput: {
    borderWidth: 1.5,
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    lineHeight: 22,
  },
  editFormTextArea: {
    minHeight: 120,
    textAlignVertical: 'top',
    paddingTop: 16,
  },
  emojiInputContainer: {
    alignItems: 'center',
  },
  emojiInputWrapper: {
    position: 'relative',
    alignItems: 'center',
  },
  emojiInput: {
    width: 100,
    height: 100,
    padding: 0,
  },
  emojiClearButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    padding: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 12,
  },
  inputWithClearContainer: {
    position: 'relative',
  },
  inputWithClear: {
    paddingRight: 45,
  },
  clearButton: {
    position: 'absolute',
    right: 12,
    top: '50%',
    transform: [{ translateY: -10 }],
    padding: 4,
  },
  textAreaClearButton: {
    top: 16,
    transform: [{ translateY: 0 }],
  },
  formSection: {
    marginTop: 32,
    paddingTop: 24,
    borderTopWidth: 1,
  },
  formSectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 16,
    letterSpacing: -0.3,
  },
  labelWithIcon: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 10,
  },
  editModalFooter: {
    flexDirection: 'row',
    gap: 12,
    padding: 24,
    paddingTop: 20,
    paddingBottom: Platform.OS === 'ios' ? 44 : 24,
    flexShrink: 0,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 12,
  },
  editModalButton: {
    flex: 1,
    paddingVertical: 18,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 56,
  },
  cancelButton: {
    borderWidth: 2,
  },
  cancelButtonText: {
    fontSize: 17,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  saveButton: {
    shadowColor: '#4E8886',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  saveButtonText: {
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  savingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  // Send to Friend Modal Styles
  sendModalScrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  sendModalSection: {
    marginBottom: 28,
  },
  sendModalSectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 14,
    letterSpacing: -0.3,
  },
  searchInputContainer: {
    position: 'relative',
    marginBottom: 16,
  },
  searchIcon: {
    position: 'absolute',
    left: 14,
    top: 14,
    zIndex: 1,
  },
  searchInput: {
    borderWidth: 1.5,
    borderRadius: 12,
    paddingLeft: 44,
    paddingRight: 44,
    paddingVertical: 12,
    fontSize: 16,
  },
  clearSearchButton: {
    position: 'absolute',
    right: 14,
    top: 14,
    zIndex: 1,
  },
  sendModalTextArea: {
    borderWidth: 1.5,
    borderRadius: 14,
    padding: 16,
    fontSize: 16,
    minHeight: 110,
    lineHeight: 22,
  },
  sendModalFriendsList: {
    gap: 12,
  },
  sendModalFriendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 14,
    borderWidth: 2,
    gap: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  sendModalFriendAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
  },
  sendModalFriendAvatarPlaceholder: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendModalFriendInfo: {
    flex: 1,
  },
  sendModalFriendName: {
    fontSize: 17,
    fontWeight: '600',
    marginBottom: 3,
    letterSpacing: -0.2,
  },
  sendModalFriendEmail: {
    fontSize: 14,
  },
  loadingFriendsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 30,
    gap: 12,
  },
  loadingFriendsText: {
    fontSize: 16,
  },
  noFriendsContainer: {
    alignItems: 'center',
    padding: 50,
    gap: 12,
  },
  noFriendsText: {
    fontSize: 19,
    fontWeight: '600',
    marginTop: 8,
  },
  noFriendsSubtext: {
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
  },
  noSearchResultsContainer: {
    alignItems: 'center',
    padding: 40,
    gap: 12,
  },
  noSearchResultsText: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 8,
  },
  noSearchResultsSubtext: {
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
  },
  // Review Creation Modal Styles
  reviewLocationPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: 12,
    marginBottom: 12,
  },
  reviewLocationEmoji: {
    fontSize: 32,
  },
  reviewLocationTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  ratingSelector: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    marginBottom: 12,
  },
  starButton: {
    padding: 4,
  },
  reviewTextInputContainer: {
    borderWidth: 2,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  reviewTextInput: {
    minHeight: 140,
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 12,
    fontSize: 16,
    lineHeight: 24,
    textAlignVertical: 'top',
  },
  reviewTextInputFooter: {
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0, 0, 0, 0.06)',
    alignItems: 'flex-end',
  },
});

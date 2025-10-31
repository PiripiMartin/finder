import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Dimensions, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import MapView, { Marker, PROVIDER_GOOGLE, Region } from 'react-native-maps';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import ProfileModal from '../components/ProfileModal';
import Tutorial from '../components/Tutorial';
import { getApiUrl, getGuestPostsUrl, getMapPointsUrl } from '../config/api';
import { useAuth } from '../context/AuthContext';
import { useLocationContext } from '../context/LocationContext';
import { useShare } from '../context/ShareContext';
import { useTheme } from '../context/ThemeContext';
import { useTutorial } from '../context/TutorialContext';
import { MapPoint } from '../mapData';
import { API_CONFIG } from '../config/api';
import { cacheMapPoints, loadCachedMapPoints, clearMapPointsCache } from '../utils/mapPointsCache';

import { videoUrls } from '../videoData';

// Helper function to detect video platform from URL
const getVideoPlatform = (url: string): 'tiktok' | 'instagram' | 'unknown' => {
  if (url.includes('tiktok.com') || url.includes('vm.tiktok.com')) return 'tiktok';
  if (url.includes('instagram.com') || url.includes('instagr.am')) return 'instagram';
  return 'unknown';
};

interface Folder {
  id: number;
  name: string;
  color: string;
  locationIds: number[];
  title: string;
}

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
  const { sessionToken, isGuest, logout } = useAuth();
  const { setSavedLocations: setContextSavedLocations, setRecommendedLocations: setContextRecommendedLocations, blockedLocationIds, registerRefreshCallback } = useLocationContext();
  const { sharedContent, clearSharedContent } = useShare();
  const { shouldShowTutorial, completeTutorial, tutorialFeatureEnabled } = useTutorial();
  const [showManualTutorial, setShowManualTutorial] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const insets = useSafeAreaInsets();

  // Filter state
  const [activeFilter, setActiveFilter] = useState<number | null>(null);
  const [showSavedOnly, setShowSavedOnly] = useState(false);
  
  // Folder state
  const [folders, setFolders] = useState<Folder[]>([]);
  
  // API state
  const [mapPoints, setMapPoints] = useState<MapPoint[]>([]);
  const [savedLocations, setSavedLocations] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState(0);
  const [isLoadingFromCache, setIsLoadingFromCache] = useState(true);
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

  // Load cached map points on initial mount
  const loadCachedData = useCallback(async () => {
    try {
      console.log('📦 [loadCachedData] Loading cached map data...');
      const cachedData = await loadCachedMapPoints();
      
      if (cachedData) {
        console.log('✅ [loadCachedData] Found cached data, loading into state');
        
        // Load cached data into state
        setMapPoints(cachedData.transformedMapPoints);
        setSavedLocations(cachedData.savedLocations);
        setContextSavedLocations(cachedData.savedLocations);
        setContextRecommendedLocations(cachedData.recommendedLocations);
        
        console.log('📦 [loadCachedData] Successfully loaded cached data:', {
          mapPoints: cachedData.transformedMapPoints.length,
          savedLocations: cachedData.savedLocations.length,
          recommendedLocations: cachedData.recommendedLocations.length,
        });
      } else {
        console.log('📦 [loadCachedData] No cached data available');
      }
    } catch (error) {
      console.error('❌ [loadCachedData] Error loading cached data:', error);
    } finally {
      setIsLoadingFromCache(false);
    }
  }, [setContextSavedLocations, setContextRecommendedLocations]);

  // Fetch map points from API with retry logic
  const fetchMapPoints = useCallback(async () => {
    try {
      // Check if enough time has passed since last refresh
      const now = Date.now();
      if (now - lastRefresh < REFRESH_INTERVAL) {
        console.log(`⏰ [fetchMapPoints] Skipping refresh - only ${Math.round((now - lastRefresh) / 1000)}s since last refresh`);
        return;
      }
      
      setError(null);
      
      // Check if we have user location before making the API call
      if (!userLocation) {
        console.log('No user location available, skipping API call');
        return;
      }
      
      // Build the API URL with coordinates
      let apiUrl: string;
      let headers: any;
      
      if (isGuest) {
        // Use guest API with current coordinates
        apiUrl = getGuestPostsUrl(userLocation.latitude, userLocation.longitude);
        headers = {
          'Content-Type': 'application/json',
        };
        console.log('👤 [fetchMapPoints] Using guest API with coordinates:', { lat: userLocation.latitude, lon: userLocation.longitude });
      } else {
        // Use authenticated API
        apiUrl = `${getApiUrl('MAP_POINTS')}?lat=${userLocation.latitude}&lon=${userLocation.longitude}`;
        headers = {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${sessionToken || ''}`,
        };
        console.log('🔐 [fetchMapPoints] Using authenticated API');
      }
      
      console.log('Fetching map points from:', apiUrl);
      
      // Retry logic with exponential backoff
      const MAX_RETRIES = 3;
      const TIMEOUT_MS = 15000; // Increased from 5s to 15s
      let lastError: Error | null = null;
      
      for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
        try {
          if (attempt > 0) {
            const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000); // 1s, 2s, 4s max
            console.log(`🔄 [fetchMapPoints] Retry attempt ${attempt + 1}/${MAX_RETRIES} after ${delay}ms delay`);
            await new Promise(resolve => setTimeout(resolve, delay));
          }
          
          // Create a timeout promise
          const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => reject(new Error('Request timeout')), TIMEOUT_MS);
          });
          
          // Fetch map points from API
          const fetchPromise = fetch(apiUrl, {
            method: 'GET',
            headers,
          });
          
          // Race between fetch and timeout
          const response = await Promise.race([fetchPromise, timeoutPromise]) as Response;
      
          if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
          }
          
          const data = await response.json();
          console.log(`✅ [fetchMapPoints] API response received successfully on attempt ${attempt + 1}`);
          console.log('API response data:', data);
      
          // Handle different API response formats for guest vs authenticated
          let savedLocationsData: any[] = [];
          let recommendedLocations: any[] = [];
      
          if (isGuest) {
            console.log('👤 [fetchMapPoints] Processing guest API response');
            // Guest API might return data in a different format
            if (Array.isArray(data)) {
              // If guest API returns an array directly
              recommendedLocations = data;
              console.log('👤 [fetchMapPoints] Guest API returned array with', data.length, 'items');
            } else if (data.recommendedLocations) {
              // If guest API returns object with recommendedLocations
              recommendedLocations = Array.isArray(data.recommendedLocations) ? data.recommendedLocations : [];
              console.log('👤 [fetchMapPoints] Guest API returned object with recommendedLocations:', recommendedLocations.length);
            } else {
              console.log('👤 [fetchMapPoints] Guest API returned unexpected format:', data);
              // Try to extract any array from the response
              Object.keys(data).forEach(key => {
                if (Array.isArray(data[key])) {
                  recommendedLocations = data[key];
                  console.log('👤 [fetchMapPoints] Found array in key:', key, 'with', data[key].length, 'items');
                }
              });
            }
            
            // Ensure we have some data for guest users, even if API returns empty
            if (recommendedLocations.length === 0) {
              console.log('👤 [fetchMapPoints] Guest API returned empty data, using fallback locations');
              recommendedLocations = [
                {
                  location: {
                    id: "guest-1",
                    title: "Welcome to lai!",
                    description: "Explore the map to discover amazing places",
                    emoji: "🗺️",
                    latitude: userLocation.latitude,
                    longitude: userLocation.longitude,
                    isValidLocation: 1,
                    websiteUrl: null,
                    phoneNumber: null,
                    address: null,
                    createdAt: new Date().toISOString(),
                  },
                  topPost: {
                    id: 0,
                    url: "",
                    postedBy: 0,
                    mapPointId: 0,
                    postedAt: new Date().toISOString(),
                  }
                }
              ];
            }
          } else {
            // Authenticated API format - ONLY fetch from /map/saved-new
            // No longer using data.savedLocations or data.recommendedLocations
            
            // Fetch ALL locations from /map/saved-new to get complete folder contents
            // This includes locations added by other co-owners to shared folders
            try {
              const savedNewResponse = await fetch(`${API_CONFIG.BASE_URL}/map/saved-new`, {
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${sessionToken || ''}`,
                },
              });
              
              if (savedNewResponse.ok) {
                const savedNewData = await savedNewResponse.json();
                console.log('📂 [fetchMapPoints] Fetched saved-new data:', savedNewData);
                
                // Collect all locations from ALL sections
                const allLocations: any[] = [];
                
                // Extract locations from personal folders (includes co-owned folder locations)
                if (savedNewData.personal) {
                  Object.keys(savedNewData.personal).forEach((folderId) => {
                    const folderLocations = savedNewData.personal[folderId];
                    if (Array.isArray(folderLocations)) {
                      allLocations.push(...folderLocations);
                    }
                  });
                }
                
                // Extract locations from shared folders
                if (savedNewData.shared) {
                  Object.keys(savedNewData.shared).forEach((folderId) => {
                    const folderLocations = savedNewData.shared[folderId];
                    if (Array.isArray(folderLocations)) {
                      allLocations.push(...folderLocations);
                    }
                  });
                }
                
                // Extract locations from followed folders
                if (savedNewData.followed) {
                  Object.keys(savedNewData.followed).forEach((folderId) => {
                    const folderLocations = savedNewData.followed[folderId];
                    if (Array.isArray(folderLocations)) {
                      allLocations.push(...folderLocations);
                    }
                  });
                }
                
                // Deduplicate locations by ID
                const seenIds = new Set();
                savedLocationsData = allLocations.filter((loc: any) => {
                  if (loc.location?.id && !seenIds.has(loc.location.id)) {
                    seenIds.add(loc.location.id);
                    return true;
                  }
                  return false;
                });
                
                console.log('📂 [fetchMapPoints] Total unique saved-new locations:', savedLocationsData.length);
              }
            } catch (error) {
              console.error('❌ [fetchMapPoints] Error fetching folder locations:', error);
              savedLocationsData = [];
            }
            
            // No recommended locations - only showing saved-new
            recommendedLocations = [];
          }
          
          // Safely extract and validate the data
          // const savedLocationsData = Array.isArray(data.savedLocations) ? data.savedLocations : [];
          // const recommendedLocations = Array.isArray(data.recommendedLocations) ? data.recommendedLocations : [];
          
          // Update saved locations state
          setSavedLocations(savedLocationsData);
          // Also update the context for sharing with other components
          setContextSavedLocations(savedLocationsData);
          setContextRecommendedLocations(recommendedLocations);
          
          console.log('🔍 [fetchMapPoints] API Response Data:', {
            savedLocations: {
              count: savedLocationsData.length,
              data: savedLocationsData
            },
            recommendedLocations: {
              count: recommendedLocations.length,
              data: recommendedLocations
            }
          });
          
          // Debug saved locations structure
          if (savedLocationsData.length > 0) {
            console.log('🔍 [fetchMapPoints] First saved location structure:', savedLocationsData[0]);
            console.log('🔍 [fetchMapPoints] Saved location IDs:', savedLocationsData.map((s: any) => s.location?.id));
          }
          
          // Combine saved and recommended locations
          const allLocations = [...savedLocationsData, ...recommendedLocations];
          
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
              isValidLocation: Number(item.location.isValidLocation) || 0,
              websiteUrl: item.location.websiteUrl || null,
              phoneNumber: item.location.phoneNumber || null,
              address: item.location.address || null,
              createdAt: item.location.createdAt || new Date().toISOString(),
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
          
          // Cache the fetched data for offline access
          await cacheMapPoints({
            savedLocations: savedLocationsData,
            recommendedLocations,
            transformedMapPoints,
            timestamp: Date.now(),
          });
          console.log('💾 [fetchMapPoints] Data cached successfully');
          
          // Success! Break out of the retry loop
          break;
          
        } catch (retryError) {
          // Capture the error for potential retry
          lastError = retryError instanceof Error ? retryError : new Error(String(retryError));
          console.error(`❌ [fetchMapPoints] Attempt ${attempt + 1}/${MAX_RETRIES} failed:`, lastError.message);
          
          // If this was the last attempt, we'll handle the error outside the loop
          if (attempt === MAX_RETRIES - 1) {
            console.error(`❌ [fetchMapPoints] All ${MAX_RETRIES} attempts failed`);
          }
        }
      }
      
      // If we exhausted all retries and still have an error, handle it
      if (lastError) {
        throw lastError;
      }
      
    } catch (err) {
      console.error('❌ [fetchMapPoints] All retry attempts exhausted, using offline data:', err);
      
      // Only show offline data message after all retries have failed
      // Use fallback data if API fails after all retry attempts
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
        isValidLocation: 1,
        websiteUrl: null,
        phoneNumber: null,
        address: null,
        createdAt: new Date().toISOString(),
        videoUrl: item.topPost.url,
      }));
      
      setMapPoints(fallbackMapPoints);
      setError('Using offline data - network unavailable');
    }
  }, [userLocation, isGuest, sessionToken]);

  // Load folders function - fetch from API and process with location data
  const loadFoldersData = useCallback(async () => {
    if (!sessionToken) {
      console.log('📂 [Map] No session token, skipping folder load');
      return;
    }

    try {
      // Fetch owned folders, followed folders, and saved locations
      const [ownedFoldersResponse, followedFoldersResponse, locationsResponse] = await Promise.all([
        fetch(`${API_CONFIG.BASE_URL}/folders/owned`, {
          headers: {
            'Authorization': `Bearer ${sessionToken}`,
          },
        }),
        fetch(`${API_CONFIG.BASE_URL}/folders/followed`, {
          headers: {
            'Authorization': `Bearer ${sessionToken}`,
          },
        }),
        fetch(`${API_CONFIG.BASE_URL}/map/saved-new`, {
          headers: {
            'Authorization': `Bearer ${sessionToken}`,
          },
        }),
      ]);

      if (!ownedFoldersResponse.ok || !followedFoldersResponse.ok || !locationsResponse.ok) {
        throw new Error('Failed to fetch folders or locations');
      }

      const ownedFoldersData = await ownedFoldersResponse.json();
      const followedFoldersData = await followedFoldersResponse.json();
      const locationsData = await locationsResponse.json();

      console.log('📂 [Map] Owned folders:', ownedFoldersData);
      console.log('📂 [Map] Followed folders:', followedFoldersData);
      console.log('📂 [Map] Locations data:', locationsData);

      // Combine owned and followed folders
      const allFolders = [...ownedFoldersData, ...followedFoldersData];

      // Build folder objects with location IDs from both personal and shared sections
      const foldersWithLocations = allFolders.map((folder: any) => {
        const locationIds: number[] = [];
        
        // Get locations from personal section for this folder
        if (locationsData.personal && locationsData.personal[folder.id]) {
          const folderLocations = locationsData.personal[folder.id];
          folderLocations.forEach((item: any) => {
            if (item.location && item.location.id) {
              locationIds.push(item.location.id);
            }
          });
        }

        // Get locations from shared section for this folder
        if (locationsData.shared && locationsData.shared[folder.id]) {
          const folderLocations = locationsData.shared[folder.id];
          folderLocations.forEach((item: any) => {
            if (item.location && item.location.id) {
              locationIds.push(item.location.id);
            }
          });
        }

        // Get locations from followed section for this folder
        if (locationsData.followed && locationsData.followed[folder.id]) {
          const folderLocations = locationsData.followed[folder.id];
          folderLocations.forEach((item: any) => {
            if (item.location && item.location.id) {
              locationIds.push(item.location.id);
            }
          });
        }

        return {
          id: folder.id,
          name: folder.name,
          title: folder.name, // For compatibility with existing filter code
          color: folder.color,
          locationIds,
        };
      });

      setFolders(foldersWithLocations);
      console.log('📂 [Map] Loaded folders from API:', foldersWithLocations.length);
      console.log('📂 [Map] Folders with locations:', foldersWithLocations);
    } catch (error) {
      console.error('❌ [Map] Error loading folders:', error);
      setFolders([]);
    }
  }, [sessionToken]);

  // Load folders on mount
  useEffect(() => {
    loadFoldersData();
  }, [loadFoldersData]);

  // Reload folders when screen comes into focus (e.g., returning from saved tab)
  useFocusEffect(
    useCallback(() => {
      console.log('📂 [Map] Screen focused, reloading folders...');
      loadFoldersData();
    }, [loadFoldersData])
  );

  // Refresh map points when screen is focused (after app closes/reopens)
  useFocusEffect(
    useCallback(() => {
      console.log('🗺️ [Map] Screen focused, refreshing map points...');
      if (userLocation) {
        // Reset the last refresh time to allow immediate refresh
        setLastRefresh(0);
        fetchMapPoints();
      }
    }, [userLocation, fetchMapPoints])
  );

  // Load map points when user location is available
  useEffect(() => {
    console.log('📍 [Map] useEffect triggered - userLocation:', userLocation, 'isGuest:', isGuest);
    if (userLocation) {
      console.log('📍 [Map] User location available, calling fetchMapPoints');
      fetchMapPoints();
    } else {
      console.log('📍 [Map] No user location available yet');
    }
  }, [userLocation]);

  // Register refresh callback with LocationContext
  useEffect(() => {
    const unregister = registerRefreshCallback(() => {
      console.log('🔄 [Map] Refresh triggered by LocationContext');
      if (userLocation) {
        fetchMapPoints();
      }
    });

    return unregister;
  }, [registerRefreshCallback, userLocation, fetchMapPoints]);
  


  // NOTE: Blocked locations are now filtered in the filteredMapPoints useMemo below
  // to avoid permanently mutating the mapPoints state, which caused bugs when
  // toggling folder filters on/off.



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



  // Filtered map points based on active filter and saved locations
  const filteredMapPoints = useMemo(() => {
    let filtered = mapPoints;
    
    // First, filter out blocked locations (don't mutate state, just filter at render time)
    if (blockedLocationIds.length > 0) {
      console.log(`🗑️ [Map] Filtering out ${blockedLocationIds.length} blocked locations from display`);
      filtered = filtered.filter(point => !blockedLocationIds.includes(point.id));
    }
    
    // Apply folder filter
    if (activeFilter) {
      const selectedFolder = folders.find(f => f.id === activeFilter);
      if (selectedFolder) {
        console.log('🔍 [Filter] Applying folder filter:', selectedFolder.title);
        filtered = filtered.filter(point => {
          const pointId = Number(point.id);
          return selectedFolder.locationIds.includes(pointId);
        });
        console.log('🔍 [Filter] Folder filtered points count:', filtered.length);
      }
    }
    
    // Apply saved locations filter
    if (showSavedOnly) {
      console.log('🔍 [Filter] Applying saved locations filter...');
      console.log('🔍 [Filter] Saved locations count:', savedLocations.length);
      console.log('🔍 [Filter] Map points count:', mapPoints.length);
      console.log('🔍 [Filter] Saved locations:', savedLocations.map(s => ({ id: s.location?.id, title: s.location?.title })));
      console.log('🔍 [Filter] Map points:', mapPoints.map(p => ({ id: p.id, title: p.title })));
      
      filtered = filtered.filter(point => {
        const isSaved = savedLocations.some(saved => {
          const savedId = String(saved.location?.id);
          const pointId = String(point.id);
          const matches = savedId === pointId;
          if (matches) {
            console.log('✅ [Filter] Found saved location match:', { savedId, pointId, title: point.title });
          }
          return matches;
        });
        return isSaved;
      });
      
      console.log('🔍 [Filter] Filtered points count:', filtered.length);
    }
    
    return filtered;
  }, [mapPoints, activeFilter, showSavedOnly, savedLocations, folders, blockedLocationIds]);

  // Function to clear all filters
  const clearAllFilters = () => {
    setActiveFilter(null);
    setShowSavedOnly(false);
  };

  // Get folders with location counts for display
  const foldersWithCounts = useMemo(() => {
    return folders.map(folder => ({
      ...folder,
      count: folder.locationIds.filter(id => 
        mapPoints.some(point => Number(point.id) === id)
      ).length
    }));
  }, [folders, mapPoints]);

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
    console.log('📍 [Map] Marker pressed:', pointId);
    
    const selectedPoint = mapPoints.find(point => point.id === pointId);
    if (!selectedPoint) {
      console.log('❌ [Map] Selected point not found in mapPoints');
      return;
    }

    setSelectedMarkerId(pointId);
    
    // For authenticated users, show video overlay
    if (sessionToken && !isGuest) {
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
    } else {
      // For guest users, just navigate to the location page without showing videos
      console.log('👤 [Map] Guest user navigating to location page');
      router.push(`/_location?id=${pointId}`);
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

  const handleLogout = async () => {
    // Clear cached map points when logging out
    await clearMapPointsCache();
    console.log('🗑️ [Logout] Cleared map points cache');
    logout();
    router.push('/auth/login');
  };

  useEffect(() => {
    // Add a small delay to ensure component is fully mounted
    const timer = setTimeout(async () => {
      try {
        // Check if location services are enabled first
        const isLocationEnabled = await Location.hasServicesEnabledAsync();
        if (!isLocationEnabled) {
          console.log('Location services disabled, using default location');
          const defaultRegion: Region = {
            latitude: -37.8136,
            longitude: 144.9631,
            latitudeDelta: 0.0922,
            longitudeDelta: 0.0421,
          };
          setUserLocation(defaultRegion);
          return;
        }

        // Request location permissions with proper error handling
        let { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          console.log('Location permission denied, using default location');
          const defaultRegion: Region = {
            latitude: -37.8136,
            longitude: 144.9631,
            latitudeDelta: 0.0922,
            longitudeDelta: 0.0421,
          };
          setUserLocation(defaultRegion);
          return;
        }
        
        // Get current location with iOS-friendly settings
        const location = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced, // Better iOS compatibility
        });
        
        const region: Region = {
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        };
        
        setUserLocation(region);
      } catch (error) {
        console.error('Error getting location:', error);
        // Always set a default location to prevent crashes
        const defaultRegion: Region = {
          latitude: -37.8136,
          longitude: 144.9631,
          latitudeDelta: 0.0922,
          longitudeDelta: 0.0421,
        };
        setUserLocation(defaultRegion);
      } finally {
        // Ensure loading is cleared even if location setup fails

      }
    }, 100); // 100ms delay to ensure component is mounted

    return () => clearTimeout(timer);
  }, []);

  // Load cached data on initial mount for instant display
  useEffect(() => {
    loadCachedData();
  }, [loadCachedData]);

  // Show tutorial overlay if needed (automatic or manual) and feature is enabled
  if (tutorialFeatureEnabled && (shouldShowTutorial || showManualTutorial)) {
    return (
      <Tutorial 
        onComplete={() => {
          if (shouldShowTutorial) {
            completeTutorial();
          }
          setShowManualTutorial(false);
        }} 
      />
    );
  }

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
        showsUserLocation={true}
        showsMyLocationButton={false}
        followsUserLocation={false}
        moveOnMarkerPress={false}
      >

        
        {/* Error indicator */}
        {error && (
          <View style={styles.errorOverlay}>
            <Text style={styles.errorText}>Error: {error}</Text>
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
            top: insets.top + 30,
            left: insets.left + 30,
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
        <Ionicons name="navigate" size={28} color="#A8C3A0" />
      </TouchableOpacity>

      {/* Tutorial Button - Below Location Button (only if feature enabled) */}
      {tutorialFeatureEnabled && (
        <TouchableOpacity 
          style={[
            styles.tutorialButton,
            {
              top: insets.top + 90, // 60px below location button (30 + 60)
              left: insets.left + 30,
            }
          ]}
          onPress={() => {
            console.log('🎓 [Tutorial] Manual tutorial opened');
            setShowManualTutorial(true);
          }}
        >
          <Ionicons name="help-circle-outline" size={28} color="#A8C3A0" />
        </TouchableOpacity>
      )}

      {/* Profile Button - Top Right (only show when authenticated) */}
      {!isGuest && (
        <TouchableOpacity 
          style={[
            styles.profileButton,
            {
              top: insets.top + 30,
              right: insets.right + 30,
            }
          ]}
          onPress={() => setShowProfileModal(true)}
        >
          <Ionicons name="person" size={28} color="#A8C3A0" />
        </TouchableOpacity>
      )}

      {/* Guest Login Button - Top Right (only show when in guest mode) */}
      {isGuest && (
        <TouchableOpacity 
          style={[
            styles.guestLoginButton,
            {
              top: insets.top + 30,
              right: insets.right + 30,
            }
          ]}
          onPress={() => router.push('/auth/login')}
        >
          <Ionicons name="log-in" size={20} color="#A8C3A0" />
          <Text style={styles.guestLoginButtonText}>Login</Text>
        </TouchableOpacity>
      )}



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
          {/* Folder Filter Buttons */}
          {foldersWithCounts.map((folder) => (
            <TouchableOpacity
              key={folder.id}
              activeOpacity={1}
              style={[
                styles.filterButton,
                {
                  backgroundColor: activeFilter === folder.id ? folder.color : theme.colors.surface,
                  borderColor: activeFilter === folder.id ? folder.color : theme.colors.border,
                }
              ]}
              onPress={() => {
                setActiveFilter(activeFilter === folder.id ? null : folder.id);
              }}
            >
              <Ionicons 
                name="folder" 
                size={16} 
                color={activeFilter === folder.id ? '#FFFFFF' : folder.color} 
                style={{ marginRight: 4 }}
              />
              <Text style={[
                styles.filterButtonText,
                { color: activeFilter === folder.id ? '#FFFFFF' : theme.colors.text }
              ]}>
                {folder.title}
              </Text>
              {folder.count > 0 && (
                <View style={[
                  styles.filterBadge,
                  { backgroundColor: activeFilter === folder.id ? '#FFFFFF' : folder.color }
                ]}>
                  <Text style={[
                    styles.filterBadgeText,
                    { color: activeFilter === folder.id ? folder.color : '#FFFFFF' }
                  ]}>
                    {folder.count}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Picture-in-Picture Video - Only show for authenticated users */}
      {isVideoVisible && selectedVideo && sessionToken && !isGuest ? (() => {
        const thumbnailPlatform = getVideoPlatform(selectedVideo);
        const isInstagram = thumbnailPlatform === 'instagram';
        
        return (
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
              style={[styles.shopButton, { backgroundColor: '#FFFFFF' }]}
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
                <Text style={styles.closeButtonText}>✕</Text>
              </TouchableOpacity>
              <WebView
                key={`${selectedVideo}-${Date.now()}`}
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
                          top: 0;
                          left: 0;
                          right: 0;
                          bottom: 0;
                          display: flex;
                          justify-content: center;
                          align-items: center;
                          overflow: hidden;
                        }
                        .instagram-media {
                          max-width: 50% !important;
                          width: 50% !important;
                          margin: 0 auto !important;
                          transform: scale(0.79) translateY(6%);
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
        );
      })() : null}

      {/* Shared Content Notification */}
      {sharedContent && (
        <View style={[
          styles.sharedContentNotification,
          {
            backgroundColor: theme.colors.surface,
            borderColor: theme.colors.primary,
            top: insets.top + 60,
          }
        ]}>
          <View style={styles.sharedContentHeader}>
            <Ionicons 
              name={sharedContent.isTikTokUrl ? "logo-tiktok" : "share"} 
              size={20} 
              color={theme.colors.primary} 
            />
            <Text style={[styles.sharedContentTitle, { color: theme.colors.text }]}>
              {sharedContent.isTikTokUrl ? 'TikTok Shared!' : 'Content Shared!'}
            </Text>
            <TouchableOpacity onPress={clearSharedContent} style={styles.dismissButton}>
              <Ionicons name="close" size={16} color={theme.colors.textSecondary} />
            </TouchableOpacity>
          </View>
          <Text style={[styles.sharedContentSubtitle, { color: theme.colors.textSecondary }]}>
            {sharedContent.isTikTokUrl 
              ? 'Tap a location marker to add this TikTok video' 
              : 'Tap a location marker to add this content'}
          </Text>
          {sharedContent.url && (
            <Text style={[styles.sharedContentUrl, { color: theme.colors.textSecondary }]} numberOfLines={1}>
              {sharedContent.url}
            </Text>
          )}
        </View>
      )}

      {/* Progress Goal Banner - Show when user has less than 3 saved locations */}
      {!isGuest && savedLocations.length < 3 && (
        <View style={[
          styles.progressBanner,
          {
            backgroundColor: theme.colors.primary,
            bottom: insets.bottom + 20, // Position above the nav bar
          }
        ]}>
          <View style={styles.progressBannerTop}>
            <View style={styles.progressContent}>
              <Ionicons name="flag-outline" size={20} color="#FFFFFF" style={{ marginRight: 8 }} />
              <Text style={styles.progressText}>
                Goal: Save {savedLocations.length}/3 TikToks or Instagram Reels
              </Text>
            </View>
            {tutorialFeatureEnabled && (
              <TouchableOpacity
                style={styles.howButton}
                onPress={() => {
                  console.log('🎓 [Map] Opening tutorial from goal banner');
                  setShowManualTutorial(true);
                }}
              >
                <Text style={styles.howButtonText}>How?</Text>
              </TouchableOpacity>
            )}
          </View>
          <View style={styles.progressBarContainer}>
            <View 
              style={[
                styles.progressBarFill, 
                { width: `${(savedLocations.length / 3) * 100}%` }
              ]} 
            />
          </View>
        </View>
      )}

      {/* Profile Modal */}
      <ProfileModal 
        visible={showProfileModal} 
        onClose={() => setShowProfileModal(false)} 
      />
      
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
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 6,
    borderWidth: 1,
            borderColor: '#A8C3A0',
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
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
  },
  closeButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
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
    backgroundColor: '#FFFFFF',
    borderRadius: 25,
    width: 50,
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 3,
  },
  tutorialButton: {
    position: 'absolute',
    backgroundColor: '#FFFFFF',
    borderRadius: 25,
    width: 50,
    height: 50,
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
    marginRight: 2,
  },
  filterEmoji: {
    fontSize: 18,
    marginRight: 5,
  },
  filterButtonText: {
    fontSize: 18,
    
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

  customLabel: {
    position: 'absolute',
    backgroundColor: '#FFFFFF',
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
            borderColor: '#FFFFFF',
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
  profileButton: {
    position: 'absolute',
    backgroundColor: '#FFFFFF',
    borderRadius: 25,
    width: 50,
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 3,
  },
  guestLoginButton: {
    position: 'absolute',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 3,
    gap: 6,
  },
  guestLoginButtonText: {
    color: '#A8C3A0',
    fontSize: 14,
    fontWeight: '600',
  },
  logoutButton: {
    position: 'absolute',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 3,
    gap: 6,
  },
  logoutButtonText: {
    color: '#A8C3A0',
    fontSize: 14,
    fontWeight: '600',
  },
  sharedContentNotification: {
    position: 'absolute',
    left: 16,
    right: 16,
    zIndex: 1000,
    borderRadius: 12,
    borderWidth: 2,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 8,
  },
  sharedContentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  sharedContentTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
    flex: 1,
  },
  dismissButton: {
    padding: 4,
  },
  sharedContentSubtitle: {
    fontSize: 14,
    marginBottom: 4,
  },
  sharedContentUrl: {
    fontSize: 12,
    fontFamily: 'monospace',
  },
  filterBadge: {
    marginLeft: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
    minWidth: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterBadgeText: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  progressBanner: {
    position: 'absolute',
    left: 16,
    right: 16,
    borderRadius: 12,
    padding: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 8,
    zIndex: 100,
  },
  progressBannerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  progressContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  progressText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  howButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    marginLeft: 12,
  },
  howButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  progressBarContainer: {
    height: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 3,
  },

});

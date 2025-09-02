import { Ionicons } from '@expo/vector-icons';
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Dimensions, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { API_CONFIG } from '../config/api';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

const { width } = Dimensions.get('window');
const locationCardWidth = width - 100; // Even smaller width for more compact cards

interface SavedLocation {
  location: {
    id: number;
    title: string;
    description: string;
    emoji: string;
    latitude: number | null;
    longitude: number | null;
    isValidLocation: number;
    websiteUrl: string | null;
    phoneNumber: string | null;
    address: string | null;
    createdAt: string;
  };
  topPost: {
    id: number;
    url: string;
    postedBy: number;
    mapPointId: number;
    postedAt: string;
  };
}

export default function Saved() {
  const router = useRouter();
  const { theme } = useTheme();
  const { sessionToken, isGuest } = useAuth();
  
  const [savedLocations, setSavedLocations] = useState<SavedLocation[]>([]);
  const [filteredLocations, setFilteredLocations] = useState<SavedLocation[]>([]);
  const [selectedEmoji, setSelectedEmoji] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);



  // Fetch saved locations from API
  const fetchSavedLocations = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      console.log('📚 [Saved] Fetching saved locations...');
      const apiUrl = `${API_CONFIG.BASE_URL}/map/saved`;
      console.log('🌐 [Saved] API URL:', apiUrl);
      
      // Log the complete request details
      console.log('📤 [Saved] Request Details:', {
        method: 'GET',
        url: apiUrl,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${sessionToken ? sessionToken.substring(0, 20) + '...' : 'NO_TOKEN'}`,
        },
        sessionTokenLength: sessionToken ? sessionToken.length : 0,
        timestamp: new Date().toISOString()
      });
      
      const response = await fetch(apiUrl, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${sessionToken || ''}`,
        },
      });
      
      // Log response details
      console.log('📥 [Saved] Response Details:', {
        status: response.status,
        statusText: response.statusText,
        ok: response.ok,
        headers: Object.fromEntries(response.headers.entries()),
        url: response.url,
        timestamp: new Date().toISOString()
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      console.log('📚 [Saved] API response data:', data);
      
      // Extract locations - the API returns an array directly, not wrapped in savedLocations
      const locations = Array.isArray(data) ? data : [];
      console.log('📚 [Saved] Found saved locations:', locations.length);
      
      setSavedLocations(locations);
      setFilteredLocations(locations);
      // Start with no filter selected (show all locations)
      setSelectedEmoji(null);
      
    } catch (error) {
      console.error('📚 [Saved] Error fetching saved locations:', error);
      setError(error instanceof Error ? error.message : 'Failed to fetch saved locations');
    } finally {
      setIsLoading(false);
    }
  };

  // Get unique emojis from saved locations
  const getUniqueEmojis = () => {
    const emojis = savedLocations.map(item => item.location.emoji);
    return [...new Set(emojis)];
  };

  // Filter locations by selected emoji
  const filterByEmoji = (emoji: string) => {
    if (selectedEmoji === emoji) {
      // If clicking the same emoji, deselect it and show all locations
      setSelectedEmoji(null);
      setFilteredLocations(savedLocations);
    } else {
      // Filter by the new emoji
      setSelectedEmoji(emoji);
      const filtered = savedLocations.filter(item => item.location.emoji === emoji);
      setFilteredLocations(filtered);
    }
  };

  // Handle location tap - navigate to location page or coordinate selection
  const handleLocationPress = (locationId: number) => {
    console.log('📍 [Saved] Location tapped:', locationId);
    
    const location = savedLocations.find(item => item.location.id === locationId);
    if (location && (location.location.latitude === null || location.location.longitude === null)) {
      console.log('⚠️ [Saved] Location has null coordinates, navigating to coordinate selection');
      // Navigate to location page with coordinate selection flag
      router.push(`/_location?id=${locationId}&needsCoordinates=true`);
    } else {
      console.log('🚀 [Saved] Navigating to location page with ID:', locationId);
      // Navigate to normal location page
      router.push(`/_location?id=${locationId}`);
    }
  };



  useEffect(() => {
    console.log('📚 [Saved] Page loaded, fetching saved locations...');
    fetchSavedLocations();
  }, [sessionToken]);

  if (isLoading) {
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <View style={[styles.header, { backgroundColor: theme.colors.surface }]}>
          <Text style={[styles.headerTitle, { color: theme.colors.text }]}>Saved Locations</Text>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text style={[styles.loadingText, { color: theme.colors.textSecondary }]}>Loading saved locations...</Text>
        </View>
      </View>
    );
  }

  // Show guest message if user is not authenticated
  if (isGuest) {
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <View style={[styles.header, { backgroundColor: theme.colors.surface }]}>
          <Text style={[styles.headerTitle, { color: theme.colors.text }]}>Saved Locations</Text>
        </View>
        <View style={styles.guestContainer}>
          <Ionicons name="bookmark-outline" size={80} color={theme.colors.textSecondary} />
          <Text style={[styles.guestTitle, { color: theme.colors.text }]}>Login to Save Locations</Text>
          <Text style={[styles.guestSubtitle, { color: theme.colors.textSecondary }]}>
            Create an account or sign in to save your favorite places and access them from anywhere.
          </Text>
          <TouchableOpacity
            style={[styles.loginButton, { backgroundColor: theme.colors.primary }]}
            onPress={() => router.push('/auth/login')}
          >
            <Text style={[styles.loginButtonText, { color: theme.colors.surface }]}>Login</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.createAccountButton, { borderColor: theme.colors.primary }]}
            onPress={() => router.push('/auth/create-account')}
          >
            <Text style={[styles.createAccountButtonText, { color: theme.colors.primary }]}>Create Account</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (error) {
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <View style={[styles.header, { backgroundColor: theme.colors.surface }]}>
          <Text style={[styles.headerTitle, { color: theme.colors.text }]}>Saved Locations</Text>
        </View>
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle" size={48} color="#ff6b6b" />
          <Text style={[styles.errorText, { color: theme.colors.textSecondary }]}>Failed to load saved locations</Text>
          <Text style={[styles.errorSubtext, { color: theme.colors.textSecondary }]}>{error}</Text>

        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: theme.colors.surface }]}>
        <Text style={[styles.headerTitle, { color: theme.colors.text }]}>Saved Locations</Text>
      </View>

      {/* Emoji Filter Bar */}
      {savedLocations.length > 0 && (
        <View style={[styles.filterContainer, { backgroundColor: theme.colors.surface }]}>
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filterScrollContent}
          >
            {/* Emoji filters */}
            {getUniqueEmojis().map((emoji) => (
              <TouchableOpacity
                key={emoji}
                style={[
                  styles.emojiFilterButton,
                  selectedEmoji === emoji && { backgroundColor: theme.colors.primary }
                ]}
                onPress={() => filterByEmoji(emoji)}
              >
                <Text style={[
                  styles.emojiFilterText,
                  selectedEmoji === emoji && { color: '#FFF0F0' }
                ]}>
                  {emoji}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {filteredLocations.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="bookmark-outline" size={64} color={theme.colors.textSecondary} />
            <Text style={[styles.emptyTitle, { color: theme.colors.text }]}>
              {selectedEmoji ? `No ${selectedEmoji} Locations` : 'No Saved Locations'}
            </Text>
            <Text style={[styles.emptySubtext, { color: theme.colors.textSecondary }]}>
              {selectedEmoji 
                ? `No saved locations with ${selectedEmoji} emoji found`
                : 'Save locations from the map to see them here'
              }
            </Text>
          </View>
        ) : (
          <View style={styles.locationsList}>
            {filteredLocations.map((item) => (
              <TouchableOpacity 
                key={item.location.id} 
                style={[styles.locationCard, { backgroundColor: theme.colors.surface, shadowColor: theme.colors.shadow }]}
                onPress={() => handleLocationPress(item.location.id)}
              >
                {/* Location Header */}
                <View style={styles.locationHeader}>
                  <View style={styles.locationInfo}>
                    <Text style={styles.locationEmoji}>{item.location.emoji}</Text>
                    <View style={styles.locationText}>
                      <Text style={[styles.locationTitle, { color: theme.colors.text }]} numberOfLines={1}>
                        {item.location.title}
                      </Text>
                      <Text style={[styles.locationDescription, { color: theme.colors.textSecondary }]} numberOfLines={2}>
                        {item.location.description}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.locationActions}>
                    {/* Alert symbol for locations with null coordinates */}
                    {(item.location.latitude === null || item.location.longitude === null) && (
                      <Ionicons name="alert-circle" size={20} color="#ff6b6b" style={styles.alertIcon} />
                    )}
                    <Ionicons name="chevron-forward" size={20} color={theme.colors.textSecondary} />
                  </View>
                </View>


              </TouchableOpacity>
            ))}
          </View>
        )}
      </ScrollView>
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
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 20,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
  },

  scrollView: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    marginTop: 16,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  errorText: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
    textAlign: 'center',
  },
  errorSubtext: {
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
    opacity: 0.8,
  },

  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
    paddingTop: 60,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginTop: 16,
    textAlign: 'center',
  },
  emptySubtext: {
    fontSize: 16,
    marginTop: 8,
    textAlign: 'center',
    opacity: 0.8,
  },
  locationsList: {
    padding: 12,
  },
  locationCard: {
    width: locationCardWidth,
    backgroundColor: '#FFF0F0',
    borderRadius: 10,
    marginBottom: 10,
    padding: 10,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 5,
    elevation: 2,
  },
  locationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  locationInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  locationEmoji: {
    fontSize: 24,
    marginRight: 8,
  },
  locationText: {
    flex: 1,
  },
  locationTitle: {
    fontSize: 15,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  locationDescription: {
    fontSize: 12,
    lineHeight: 16,
  },
  filterContainer: {
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#835858',
  },
  filterScrollContent: {
    paddingHorizontal: 20,
  },
  emojiFilterButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.1)',
    marginRight: 8,
    minWidth: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emojiFilterText: {
    fontSize: 20,
    fontWeight: '600',
    color: '#835858',
  },
  locationActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  alertIcon: {
    marginRight: 4,
  },
  guestContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
    paddingTop: 60,
  },
  guestTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginTop: 20,
    textAlign: 'center',
  },
  guestSubtitle: {
    fontSize: 16,
    marginTop: 12,
    textAlign: 'center',
    opacity: 0.8,
    lineHeight: 22,
  },
  loginButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 25,
    marginTop: 24,
    minWidth: 120,
    alignItems: 'center',
  },
  loginButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  createAccountButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 25,
    marginTop: 16,
    minWidth: 120,
    alignItems: 'center',
    borderWidth: 2,
    backgroundColor: 'transparent',
  },
  createAccountButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
}); 
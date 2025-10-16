import { Ionicons } from '@expo/vector-icons';
import { useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Dimensions, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { API_CONFIG } from '../config/api';
import { useAuth } from '../context/AuthContext';
import { useLocationContext } from '../context/LocationContext';
import { useTheme } from '../context/ThemeContext';

const { width } = Dimensions.get('window');
const locationCardWidth = (width - 36) / 2; // Two cards per row with padding

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
  const { registerRefreshCallback } = useLocationContext();
  
  const [savedLocations, setSavedLocations] = useState<SavedLocation[]>([]);
  const [filteredLocations, setFilteredLocations] = useState<SavedLocation[]>([]);
  const [selectedEmoji, setSelectedEmoji] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);



  // Fetch saved locations from API
  const fetchSavedLocations = useCallback(async () => {
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
  }, [sessionToken]);

  // Get unique emojis from saved locations
  const getUniqueEmojis = () => {
    const emojis = savedLocations.map(item => item.location.emoji);
    return [...new Set(emojis)];
  };

  // Apply filters (search + emoji)
  const applyFilters = useCallback(() => {
    let filtered = savedLocations;

    // Apply search filter
    if (searchQuery.trim()) {
      filtered = filtered.filter(item => 
        item.location.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.location.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.location.address?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Apply emoji filter
    if (selectedEmoji) {
      filtered = filtered.filter(item => item.location.emoji === selectedEmoji);
    }

    setFilteredLocations(filtered);
  }, [savedLocations, searchQuery, selectedEmoji]);

  // Filter locations by selected emoji
  const filterByEmoji = (emoji: string) => {
    if (selectedEmoji === emoji) {
      // If clicking the same emoji, deselect it
      setSelectedEmoji(null);
    } else {
      // Select the new emoji
      setSelectedEmoji(emoji);
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
  }, [sessionToken, fetchSavedLocations]);

  // Register refresh callback with LocationContext
  useEffect(() => {
    const unregister = registerRefreshCallback(() => {
      console.log('🔄 [Saved] Refresh triggered by LocationContext');
      fetchSavedLocations();
    });

    return unregister;
  }, [registerRefreshCallback, fetchSavedLocations]);

  // Apply filters when search query, emoji, or locations change
  useEffect(() => {
    applyFilters();
  }, [applyFilters]);

  if (isLoading) {
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <View style={[styles.header, { backgroundColor: theme.colors.background }]}>
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
        <View style={[styles.header, { backgroundColor: theme.colors.background }]}>
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
        <View style={[styles.header, { backgroundColor: theme.colors.background }]}>
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
      <View style={[styles.header, { backgroundColor: theme.colors.background }]}>
        <Text style={[styles.headerTitle, { color: theme.colors.text }]}>Saved Locations</Text>
      </View>

      {/* Search Bar */}
      {savedLocations.length > 0 && (
        <View style={[styles.searchContainer, { backgroundColor: theme.colors.background }]}>
          <View style={[styles.searchInputContainer, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
            <Ionicons name="search" size={20} color={theme.colors.textSecondary} style={styles.searchIcon} />
            <TextInput
              style={[styles.searchInput, { color: theme.colors.text }]}
              placeholder="Search locations..."
              placeholderTextColor={theme.colors.textSecondary}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <Ionicons name="close-circle" size={20} color={theme.colors.textSecondary} />
              </TouchableOpacity>
            )}
          </View>
        </View>
      )}

      {/* Emoji Filter Bar */}
      {savedLocations.length > 0 && (
        <View style={[styles.filterContainer, { backgroundColor: theme.colors.background }]}>
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
                  { color: theme.colors.text },
                  selectedEmoji === emoji && { color: '#FFFFFF' }
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
                style={[styles.locationCard, { backgroundColor: theme.colors.background, shadowColor: theme.colors.shadow }]}
                onPress={() => handleLocationPress(item.location.id)}
              >
                <View style={styles.locationHeader}>
                  <View style={styles.locationInfo}>
                    <Text style={styles.locationEmoji}>{item.location.emoji}</Text>
                    <View style={styles.locationText}>
                      <Text style={[styles.locationTitle, { color: theme.colors.text }]} numberOfLines={2}>
                        {item.location.title}
                      </Text>
                    </View>
                  </View>
                  {/* Alert symbol for locations with null coordinates */}
                  {(item.location.latitude === null || item.location.longitude === null) && (
                    <View style={styles.locationActions}>
                      <Ionicons name="alert-circle" size={18} color="#ff6b6b" />
                    </View>
                  )}
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
  searchContainer: {
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    padding: 0,
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
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  locationCard: {
    width: locationCardWidth,
    height: locationCardWidth * 0.6,
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    marginBottom: 12,
    padding: 10,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 6,
    borderWidth: 1,
    borderColor: 'rgba(131, 88, 88, 0.15)',
  },
  locationHeader: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  locationInfo: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
  },
  locationEmoji: {
    fontSize: 32,
    marginBottom: 6,
  },
  locationText: {
    alignItems: 'center',
  },
  locationTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 4,
    textAlign: 'center',
  },
  locationDescription: {
    fontSize: 11,
    lineHeight: 14,
    textAlign: 'center',
  },
  filterContainer: {
    paddingVertical: 16,
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
  },
  locationActions: {
    position: 'absolute',
    top: 8,
    right: 8,
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
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Alert, Dimensions, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { API_CONFIG } from '../config/api';
import { useAuth } from '../context/AuthContext';
import { useLocationContext } from '../context/LocationContext';
import { useTheme } from '../context/ThemeContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { width } = Dimensions.get('window');
const locationCardWidth = (width - 36) / 2;

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

interface ApiFolder {
  id: number;
  name: string;
  color: string;
  createdAt: string;
}

interface ApiResponse {
  personal: {
    uncategorised: SavedLocation[];
    [folderId: string]: SavedLocation[];
  };
  followed: {
    [folderId: string]: SavedLocation[];
  };
}

export default function Profile() {
  const router = useRouter();
  const { theme } = useTheme();
  const { sessionToken, isGuest } = useAuth();
  const { registerRefreshCallback } = useLocationContext();
  const insets = useSafeAreaInsets();
  
  const [followedFolders, setFollowedFolders] = useState<ApiFolder[]>([]);
  const [folderLocationsMap, setFolderLocationsMap] = useState<{ [folderId: number]: SavedLocation[] }>({});
  const [selectedFolderId, setSelectedFolderId] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Fetch followed folders and their locations from saved-new endpoint
  const fetchFollowedFolders = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      console.log('👥 [Followed] Fetching saved locations with followed folders...');
      
      // Fetch from saved-new endpoint which includes followed folders with locations
      const savedResponse = await fetch(`${API_CONFIG.BASE_URL}/map/saved-new`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${sessionToken || ''}`,
        },
      });
      
      if (!savedResponse.ok) {
        throw new Error(`HTTP error! status: ${savedResponse.status}`);
      }
      
      const savedData: ApiResponse = await savedResponse.json();
      console.log('👥 [Followed] Fetched saved data with followed folders');
      
      // Fetch folder metadata
      const foldersResponse = await fetch(`${API_CONFIG.BASE_URL}/folders/followed`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${sessionToken || ''}`,
        },
      });
      
      if (!foldersResponse.ok) {
        throw new Error(`HTTP error! status: ${foldersResponse.status}`);
      }
      
      const folders = await foldersResponse.json();
      console.log('👥 [Followed] Fetched folder metadata:', folders.length);
      setFollowedFolders(folders);
      
      // Extract locations from followed section
      const locationsMap: { [folderId: number]: SavedLocation[] } = {};
      Object.keys(savedData.followed).forEach(key => {
        const folderId = parseInt(key);
        if (!isNaN(folderId)) {
          locationsMap[folderId] = savedData.followed[key];
          console.log('👥 [Followed] Folder', folderId, 'has', savedData.followed[key].length, 'locations');
        }
      });
      setFolderLocationsMap(locationsMap);
      
    } catch (error) {
      console.error('👥 [Followed] Error fetching followed folders:', error);
      setError(error instanceof Error ? error.message : 'Failed to fetch followed folders');
    } finally {
      setIsLoading(false);
    }
  }, [sessionToken]);

  // Handle unfollow with confirmation
  const handleUnfollow = async (folderId: number) => {
    const folder = followedFolders.find(f => f.id === folderId);
    if (!folder) return;
    
    Alert.alert(
      'Unfollow Folder',
      `Unfollow "${folder.name}"? You can always follow it again later.`,
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Unfollow',
          style: 'destructive',
          onPress: async () => {
            try {
              console.log('➖ [Followed] Unfollowing folder via API:', folderId);
              const response = await fetch(`${API_CONFIG.BASE_URL}/folders/${folderId}/unfollow`, {
                method: 'DELETE',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${sessionToken || ''}`,
                },
              });
              
              if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
              }
              
              console.log('✅ [Followed] Unfollowed folder');
              
              // Navigate back if viewing this folder
              if (selectedFolderId === folderId) {
                setSelectedFolderId(null);
              }
              
              // Refresh data
              await fetchFollowedFolders();
            } catch (error) {
              console.error('❌ [Followed] Error unfollowing folder:', error);
              Alert.alert('Error', 'Failed to unfollow folder');
            }
          },
        },
      ]
    );
  };

  // Handle folder tap
  const handleFolderPress = (folderId: number) => {
    setSelectedFolderId(folderId);
    setSearchQuery('');
    console.log('👥 [Followed] Opened folder:', folderId);
  };

  // Handle back to main view
  const handleBackToMain = () => {
    setSelectedFolderId(null);
    setSearchQuery('');
    console.log('👥 [Followed] Back to main view');
  };

  // Handle location tap
  const handleLocationPress = (locationId: number) => {
    console.log('📍 [Followed] Location tapped:', locationId);
    router.push(`/_location?id=${locationId}&readonly=true&source=followed`);
  };

  // Get locations for current folder with search filter
  const getFolderLocations = (folderId: number): SavedLocation[] => {
    let locations = folderLocationsMap[folderId] || [];
    
    if (searchQuery.trim()) {
      locations = locations.filter(item => 
        item.location.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.location.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.location.address?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }
    
    return locations;
  };

  // Filter folders by search
  const getFilteredFolders = (): ApiFolder[] => {
    if (!searchQuery.trim()) {
      return followedFolders;
    }
    
    return followedFolders.filter(folder =>
      folder.name.toLowerCase().includes(searchQuery.toLowerCase())
    );
  };

  useEffect(() => {
    console.log('👥 [Followed] Page loaded, fetching followed folders...');
    if (!isGuest) {
      fetchFollowedFolders();
    }
  }, [sessionToken, fetchFollowedFolders, isGuest]);

  // Register refresh callback
  useEffect(() => {
    const unregister = registerRefreshCallback(() => {
      console.log('🔄 [Followed] Refresh triggered by LocationContext');
      fetchFollowedFolders();
    });

    return unregister;
  }, [registerRefreshCallback, fetchFollowedFolders]);

  if (isLoading) {
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <View style={[styles.header, { backgroundColor: theme.colors.background, paddingTop: insets.top + 20 }]}>
          <Text style={[styles.headerTitle, { color: theme.colors.text }]}>Followed Folders</Text>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text style={[styles.loadingText, { color: theme.colors.textSecondary }]}>Loading followed folders...</Text>
        </View>
      </View>
    );
  }

  if (isGuest) {
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <View style={[styles.header, { backgroundColor: theme.colors.background, paddingTop: insets.top + 20 }]}>
          <Text style={[styles.headerTitle, { color: theme.colors.text }]}>Followed Folders</Text>
        </View>
        <View style={styles.emptyContainer}>
          <Ionicons name="people-outline" size={80} color={theme.colors.textSecondary} />
          <Text style={[styles.emptyTitle, { color: theme.colors.text }]}>Login to Follow Folders</Text>
          <Text style={[styles.emptySubtitle, { color: theme.colors.textSecondary }]}>
            Create an account or sign in to follow folders shared by others.
          </Text>
          <TouchableOpacity
            style={[styles.loginButton, { backgroundColor: theme.colors.primary }]}
            onPress={() => router.push('/auth/login')}
          >
            <Text style={[styles.loginButtonText, { color: theme.colors.surface }]}>Login</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (error) {
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <View style={[styles.header, { backgroundColor: theme.colors.background, paddingTop: insets.top + 20 }]}>
          <Text style={[styles.headerTitle, { color: theme.colors.text }]}>Followed Folders</Text>
        </View>
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle" size={48} color="#ff6b6b" />
          <Text style={[styles.errorText, { color: theme.colors.textSecondary }]}>Failed to load followed folders</Text>
          <Text style={[styles.errorSubtext, { color: theme.colors.textSecondary }]}>{error}</Text>
        </View>
      </View>
    );
  }

  const currentFolder = selectedFolderId ? followedFolders.find(f => f.id === selectedFolderId) : null;

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: theme.colors.background, paddingTop: insets.top + 20 }]}>
        {selectedFolderId && currentFolder ? (
          // Folder view header
          <>
            <TouchableOpacity onPress={handleBackToMain} style={styles.backButton}>
              <Ionicons name="arrow-back" size={24} color={theme.colors.text} />
            </TouchableOpacity>
            <View style={styles.folderHeaderInfo}>
              <View style={[styles.folderHeaderColorBar, { backgroundColor: currentFolder.color }]} />
              <Text style={[styles.headerTitle, { color: theme.colors.text }]}>{currentFolder.name}</Text>
            </View>
            <TouchableOpacity
              style={[styles.unfollowButton, { backgroundColor: '#ff6b6b' }]}
              onPress={() => handleUnfollow(selectedFolderId)}
            >
              <Ionicons name="close" size={20} color="#FFFFFF" />
            </TouchableOpacity>
          </>
        ) : (
          // Main view header
          <Text style={[styles.headerTitle, { color: theme.colors.text }]}>Followed Folders</Text>
        )}
      </View>

      {/* Search Bar */}
      {followedFolders.length > 0 && (
        <View style={[styles.searchContainer, { backgroundColor: theme.colors.background }]}>
          <View style={[styles.searchInputContainer, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
            <Ionicons name="search" size={20} color={theme.colors.textSecondary} style={styles.searchIcon} />
            <TextInput
              style={[styles.searchInput, { color: theme.colors.text }]}
              placeholder={selectedFolderId ? "Search locations..." : "Search folders..."}
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

      {/* Content */}
      {selectedFolderId ? (
        // Folder view - show locations
        <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
          {getFolderLocations(selectedFolderId).length === 0 ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="folder-open-outline" size={64} color={theme.colors.textSecondary} />
              <Text style={[styles.emptyTitle, { color: theme.colors.text }]}>
                {searchQuery ? 'No matching locations' : 'Empty Folder'}
              </Text>
              <Text style={[styles.emptySubtext, { color: theme.colors.textSecondary }]}>
                {searchQuery 
                  ? 'No locations match your search'
                  : 'This folder doesn\'t have any locations yet.'
                }
              </Text>
            </View>
          ) : (
            <View style={styles.locationsList}>
              {getFolderLocations(selectedFolderId).map((item) => (
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
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </ScrollView>
      ) : (
        // Main view - show folders
        <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
          {getFilteredFolders().length === 0 ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="star-outline" size={64} color={theme.colors.textSecondary} />
              <Text style={[styles.emptyTitle, { color: theme.colors.text }]}>
                {searchQuery ? 'No matching folders' : 'No Followed Folders'}
              </Text>
              <Text style={[styles.emptySubtext, { color: theme.colors.textSecondary }]}>
                {searchQuery
                  ? 'No folders match your search'
                  : 'When you follow folders shared by others, they\'ll appear here.'
                }
              </Text>
            </View>
          ) : (
            <View style={styles.locationsList}>
              {getFilteredFolders().map((folder) => (
                <TouchableOpacity 
                  key={folder.id} 
                  style={[
                    styles.locationCard,
                    styles.folderCard,
                    styles.followedFolderCard,
                    { backgroundColor: folder.color + '10', borderColor: folder.color, shadowColor: theme.colors.shadow }
                  ]}
                  onPress={() => handleFolderPress(folder.id)}
                >
                  <Ionicons name="star" size={16} color="#FFD700" style={styles.followedBadge} />
                  <View style={styles.folderCardContent}>
                    <Ionicons name="folder" size={32} color={folder.color} />
                    <Text style={[styles.folderTitle, { color: theme.colors.text }]} numberOfLines={2}>
                      {folder.name}
                    </Text>
                  </View>
                  <View style={[styles.folderCount, { backgroundColor: folder.color }]}>
                    <Text style={styles.folderCountText}>{(folderLocationsMap[folder.id] || []).length}</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </ScrollView>
      )}
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
    paddingBottom: 20,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  backButton: {
    padding: 8,
    marginRight: 12,
  },
  folderHeaderInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  folderHeaderColorBar: {
    width: 4,
    height: 24,
    borderRadius: 2,
    marginRight: 12,
  },
  unfollowButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
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
  emptySubtitle: {
    fontSize: 16,
    marginTop: 8,
    textAlign: 'center',
    opacity: 0.8,
    lineHeight: 22,
  },
  emptySubtext: {
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
    opacity: 0.8,
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
    marginBottom: 8,
    padding: 8,
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
    marginBottom: 4,
  },
  locationText: {
    alignItems: 'center',
  },
  locationTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 2,
    textAlign: 'center',
  },
  folderCard: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  followedFolderCard: {
    borderStyle: 'dashed',
    borderWidth: 2,
  },
  followedBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    zIndex: 1,
  },
  folderCardContent: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
  },
  folderTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    marginTop: 8,
    textAlign: 'center',
    paddingHorizontal: 8,
  },
  folderCount: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    minWidth: 24,
    height: 24,
    paddingHorizontal: 8,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  folderCountText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: 'bold',
  },
});

import { Ionicons } from '@expo/vector-icons';
import { useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Alert, Dimensions, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import DraggableGrid from 'react-native-draggable-grid';
import { API_CONFIG } from '../config/api';
import CreateFolderModal from '../components/CreateFolderModal';
import LocationSelectorModal from '../components/LocationSelectorModal';
import { useAuth } from '../context/AuthContext';
import { useLocationContext } from '../context/LocationContext';
import { useTheme } from '../context/ThemeContext';
import { addLocationToFolder, createFolder as createFolderStorage, deleteFolder, Folder, getFiledLocationIds, loadFolders, removeLocationFromFolder, saveFolders } from '../utils/folderStorage';
import { applySavedOrder, loadFolderOrder, loadLocationOrder, saveFolderOrder, saveLocationOrder } from '../utils/locationOrderStorage';

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
  const [isReorderMode, setIsReorderMode] = useState(false);
  const [reorderedLocations, setReorderedLocations] = useState<SavedLocation[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  
  // Folder state
  const [folders, setFolders] = useState<Folder[]>([]);
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [showCreateFolderModal, setShowCreateFolderModal] = useState(false);
  const [showLocationSelectorModal, setShowLocationSelectorModal] = useState(false);
  const [folderDragTarget, setFolderDragTarget] = useState<string | null>(null);
  const [isFolderEditMode, setIsFolderEditMode] = useState(false);
  const [isFolderReorderMode, setIsFolderReorderMode] = useState(false);
  const [reorderedFolderLocations, setReorderedFolderLocations] = useState<SavedLocation[]>([]);



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
      
      // Store all locations without reordering
      // The ordering will be applied when displaying unfiled locations
      setSavedLocations(locations);
      setFilteredLocations(locations);
      setReorderedLocations(locations);
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
    // Prevent navigation in reorder mode
    if (isReorderMode) {
      return;
    }
    
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

  // Toggle reorder mode
  const toggleReorderMode = () => {
    if (isReorderMode) {
      // Exiting reorder mode - save the order of unfiled locations only
      const unfiledLocationIds = reorderedLocations.map(item => item.location.id);
      saveLocationOrder(unfiledLocationIds);
      
      // Don't replace savedLocations - just update the filtered view
      // savedLocations should remain unchanged as it contains ALL locations
      setFilteredLocations(savedLocations);
      setIsReorderMode(false);
      console.log('✅ [Saved] Exited reorder mode, saved unfiled locations order');
    } else {
      // Entering reorder mode - clear filters and set only unfiled locations
      setSearchQuery('');
      setSelectedEmoji(null);
      setReorderedLocations(getUnfiledLocations());
      setIsReorderMode(true);
      console.log('🔄 [Saved] Entered reorder mode for unfiled locations');
    }
  };

  // Handle drag start
  const handleDragStart = () => {
    setIsDragging(true);
    console.log('🔄 [Saved] Started dragging');
  };

  // Handle drag end event for DraggableGrid
  const handleDragRelease = (data: any[]) => {
    setIsDragging(false);
    // Filter out any undefined or invalid items and convert back to SavedLocation format
    const validData = data
      .filter(item => item && item.data)
      .map(item => item.data);
    
    setReorderedLocations(validData);
    console.log('🔄 [Saved] Locations reordered:', validData.length);
  };

  // Load folders from storage
  const loadFoldersData = async () => {
    try {
      const loadedFolders = await loadFolders();
      setFolders(loadedFolders);
      console.log('📂 [Saved] Loaded folders:', loadedFolders.length);
    } catch (error) {
      console.error('❌ [Saved] Error loading folders:', error);
    }
  };

  // Handle folder creation
  const handleCreateFolder = async (title: string, color: string) => {
    try {
      const newFolder = await createFolderStorage(title, color);
      setFolders([...folders, newFolder]);
      console.log('✅ [Saved] Created folder:', newFolder.id);
    } catch (error) {
      console.error('❌ [Saved] Error creating folder:', error);
    }
  };

  // Handle folder tap - navigate into folder view
  const handleFolderPress = (folderId: string) => {
    if (isReorderMode) return; // Don't navigate in reorder mode
    setSelectedFolderId(folderId);
    setSearchQuery(''); // Clear search when entering folder
    console.log('📂 [Saved] Opened folder:', folderId);
  };

  // Handle back to main view
  const handleBackToMain = () => {
    setSelectedFolderId(null);
    setIsFolderEditMode(false);
    setIsFolderReorderMode(false);
    setSearchQuery(''); // Clear search when going back to main view
    console.log('📂 [Saved] Back to main view');
  };

  // Toggle folder reorder mode
  const toggleFolderReorderMode = () => {
    if (isFolderReorderMode) {
      // Exiting reorder mode - save the order
      if (selectedFolderId) {
        const folder = folders.find(f => f.id === selectedFolderId);
        if (folder) {
          const newLocationIds = reorderedFolderLocations.map(loc => loc.location.id);
          folder.locationIds = newLocationIds;
          saveFolders(folders);
          console.log('✅ [Saved] Saved folder location order');
        }
      }
      setIsFolderReorderMode(false);
    } else {
      // Entering reorder mode
      if (selectedFolderId) {
        setReorderedFolderLocations(getFolderLocations(selectedFolderId));
      }
      setIsFolderReorderMode(true);
      setIsFolderEditMode(false); // Exit edit mode if active
      console.log('🔄 [Saved] Entered folder reorder mode');
    }
  };

  // Handle folder drag release
  const handleFolderDragRelease = (data: any[]) => {
    setIsDragging(false);
    const validData = data
      .filter(item => item && item.data)
      .map(item => item.data);
    
    setReorderedFolderLocations(validData);
    console.log('🔄 [Saved] Folder locations reordered:', validData.length);
  };

  // Handle removing location from folder
  const handleRemoveFromFolder = async (folderId: string, locationId: number) => {
    const location = savedLocations.find(loc => loc.location.id === locationId);
    const locationTitle = location?.location.title || 'this location';
    
    Alert.alert(
      'Remove from Folder',
      `Remove "${locationTitle}" from this folder? It will be moved back to your unfiled locations.`,
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              await removeLocationFromFolder(folderId, locationId);
              // Reload folders to get updated data
              await loadFoldersData();
              console.log('➖ [Saved] Removed location from folder');
            } catch (error) {
              console.error('❌ [Saved] Error removing from folder:', error);
            }
          },
        },
      ]
    );
  };

  // Handle deleting folder
  const handleDeleteFolder = async (folderId: string) => {
    try {
      await deleteFolder(folderId);
      setFolders(folders.filter(f => f.id !== folderId));
      console.log('🗑️ [Saved] Deleted folder:', folderId);
    } catch (error) {
      console.error('❌ [Saved] Error deleting folder:', error);
    }
  };

  // Get unfiled locations (not in any folder), respecting saved order and applying search
  const getUnfiledLocations = (): SavedLocation[] => {
    const filedIds = new Set<number>();
    folders.forEach(folder => {
      folder.locationIds.forEach(id => filedIds.add(id));
    });
    
    let unfiled = savedLocations.filter(loc => !filedIds.has(loc.location.id));
    
    // Apply search filter if there's a search query
    if (searchQuery.trim() && !selectedFolderId) {
      unfiled = unfiled.filter(item => 
        item.location.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.location.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.location.address?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }
    
    return unfiled;
  };

  // Get locations in a specific folder, applying search filter
  const getFolderLocations = (folderId: string): SavedLocation[] => {
    const folder = folders.find(f => f.id === folderId);
    if (!folder) return [];
    
    const locationMap = new Map<number, SavedLocation>();
    savedLocations.forEach(loc => {
      locationMap.set(loc.location.id, loc);
    });
    
    let folderLocations = folder.locationIds
      .map(id => locationMap.get(id))
      .filter(loc => loc !== undefined) as SavedLocation[];
    
    // Apply search filter if there's a search query
    if (searchQuery.trim()) {
      folderLocations = folderLocations.filter(item => 
        item.location.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.location.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.location.address?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }
    
    return folderLocations;
  };

  // Handle adding multiple locations to folder
  const handleAddLocationsToFolder = async (locationIds: number[]) => {
    if (!selectedFolderId) return;
    
    try {
      // Add each location to the folder
      for (const locationId of locationIds) {
        await addLocationToFolder(selectedFolderId, locationId);
      }
      
      // Reload folders to get updated data
      await loadFoldersData();
      console.log('➕ [Saved] Added', locationIds.length, 'locations to folder');
    } catch (error) {
      console.error('❌ [Saved] Error adding locations to folder:', error);
    }
  };




  useEffect(() => {
    console.log('📚 [Saved] Page loaded, fetching saved locations...');
    fetchSavedLocations();
    loadFoldersData();
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

  // Get current folder for header display
  const currentFolder = selectedFolderId ? folders.find(f => f.id === selectedFolderId) : null;

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: theme.colors.background }]}>
        {selectedFolderId && currentFolder ? (
          // Folder view header
          <>
            <TouchableOpacity onPress={handleBackToMain} style={styles.backButton}>
              <Ionicons name="arrow-back" size={24} color={theme.colors.text} />
            </TouchableOpacity>
            <View style={styles.folderHeaderInfo}>
              <View style={[styles.folderHeaderColorBar, { backgroundColor: currentFolder.color }]} />
              <Text style={[styles.headerTitle, { color: theme.colors.text }]}>{currentFolder.title}</Text>
            </View>
            <View style={styles.folderHeaderButtons}>
              {!isFolderReorderMode && (
                <TouchableOpacity
                  style={[styles.reorderButton, isFolderEditMode && { backgroundColor: theme.colors.primary }]}
                  onPress={() => setIsFolderEditMode(!isFolderEditMode)}
                >
                  <Ionicons 
                    name={isFolderEditMode ? "checkmark" : "create-outline"} 
                    size={24} 
                    color={isFolderEditMode ? '#FFFFFF' : theme.colors.text} 
                  />
                </TouchableOpacity>
              )}
              {!isFolderEditMode && getFolderLocations(selectedFolderId).length > 1 && (
                <TouchableOpacity
                  style={[styles.reorderButton, { marginLeft: 8 }, isFolderReorderMode && { backgroundColor: theme.colors.primary }]}
                  onPress={toggleFolderReorderMode}
                >
                  <Ionicons 
                    name={isFolderReorderMode ? "checkmark" : "reorder-three"} 
                    size={24} 
                    color={isFolderReorderMode ? '#FFFFFF' : theme.colors.text} 
                  />
                </TouchableOpacity>
              )}
              {!isFolderReorderMode && !isFolderEditMode && (
                <TouchableOpacity
                  style={[styles.reorderButton, { backgroundColor: theme.colors.primary, marginLeft: 8 }]}
                  onPress={() => setShowLocationSelectorModal(true)}
                >
                  <Ionicons name="add" size={24} color="#FFFFFF" />
                </TouchableOpacity>
              )}
            </View>
          </>
        ) : (
          // Main view header
          <>
            <Text style={[styles.headerTitle, { color: theme.colors.text }]}>Saved Locations</Text>
            {getUnfiledLocations().length > 1 && !searchQuery && !selectedFolderId && (
              <TouchableOpacity
                style={[styles.reorderButton, isReorderMode && { backgroundColor: theme.colors.primary }]}
                onPress={toggleReorderMode}
              >
                <Ionicons 
                  name={isReorderMode ? "checkmark" : "reorder-three"} 
                  size={24} 
                  color={isReorderMode ? '#FFFFFF' : theme.colors.text} 
                />
              </TouchableOpacity>
            )}
          </>
        )}
      </View>

      {/* Search Bar - Show in main view and folder view */}
      {savedLocations.length > 0 && !isReorderMode && !isFolderReorderMode && (
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

      {/* Locations Grid - Works for both normal and reorder mode */}
      {isReorderMode ? (
        <ScrollView 
          style={styles.scrollView} 
          showsVerticalScrollIndicator={false}
          scrollEnabled={!isDragging}
        >
          <View style={styles.draggableGridContainer}>
            <DraggableGrid
              numColumns={2}
              itemHeight={locationCardWidth * 0.65}
              renderItem={(item: any) => {
                const location = item.data as SavedLocation;
                
                return (
                  <View
                    style={[
                      styles.locationCard,
                      styles.draggableLocationCard,
                      { backgroundColor: theme.colors.background, shadowColor: theme.colors.shadow }
                    ]}
                  >
                    <View style={styles.locationHeader}>
                      <View style={styles.locationInfo}>
                        <Text style={styles.locationEmoji}>{location.location.emoji}</Text>
                        <View style={styles.locationText}>
                          <Text style={[styles.locationTitle, { color: theme.colors.text }]} numberOfLines={2}>
                            {location.location.title}
                          </Text>
                        </View>
                      </View>
                      {/* Show drag handle in reorder mode */}
                      <View style={styles.locationActions}>
                        <Ionicons 
                          name="reorder-two" 
                          size={20} 
                          color={theme.colors.textSecondary}
                        />
                      </View>
                    </View>
                  </View>
                );
              }}
              data={reorderedLocations
                .filter(loc => loc && loc.location && loc.location.id)
                .map((loc) => ({
                  key: loc.location.id.toString(),
                  data: loc,
                }))}
              onDragStart={handleDragStart}
              onDragRelease={handleDragRelease}
            />
          </View>
        </ScrollView>
      ) : selectedFolderId ? (
        // Folder view - show locations in the selected folder
        isFolderReorderMode ? (
          // Reorder mode for folder
          <ScrollView 
            style={styles.scrollView} 
            showsVerticalScrollIndicator={false}
            scrollEnabled={!isDragging}
          >
            <View style={styles.draggableGridContainer}>
              <DraggableGrid
                numColumns={2}
                itemHeight={locationCardWidth * 0.65}
                renderItem={(item: any) => {
                  const location = item.data as SavedLocation;
                  
                  return (
                    <View
                      style={[
                        styles.locationCard,
                        styles.draggableLocationCard,
                        { backgroundColor: theme.colors.background, shadowColor: theme.colors.shadow }
                      ]}
                    >
                      <View style={styles.locationHeader}>
                        <View style={styles.locationInfo}>
                          <Text style={styles.locationEmoji}>{location.location.emoji}</Text>
                          <View style={styles.locationText}>
                            <Text style={[styles.locationTitle, { color: theme.colors.text }]} numberOfLines={2}>
                              {location.location.title}
                            </Text>
                          </View>
                        </View>
                        <View style={styles.locationActions}>
                          <Ionicons 
                            name="reorder-two" 
                            size={20} 
                            color={theme.colors.textSecondary}
                          />
                        </View>
                      </View>
                    </View>
                  );
                }}
                data={reorderedFolderLocations
                  .filter(loc => loc && loc.location && loc.location.id)
                  .map((loc) => ({
                    key: loc.location.id.toString(),
                    data: loc,
                  }))}
                onDragStart={handleDragStart}
                onDragRelease={handleFolderDragRelease}
              />
            </View>
          </ScrollView>
        ) : (
          <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
            {getFolderLocations(selectedFolderId).length === 0 ? (
              <View style={styles.emptyContainer}>
                <Ionicons name="folder-open-outline" size={64} color={theme.colors.textSecondary} />
                <Text style={[styles.emptyTitle, { color: theme.colors.text }]}>Empty Folder</Text>
                <Text style={[styles.emptySubtext, { color: theme.colors.textSecondary }]}>
                  No locations in this folder yet. Tap the + button to add some!
                </Text>
              </View>
            ) : (
              <View style={styles.locationsList}>
                {getFolderLocations(selectedFolderId).map((item) => (
                  <View key={item.location.id} style={styles.locationCardWrapper}>
                    <TouchableOpacity 
                      style={[styles.locationCard, { backgroundColor: theme.colors.background, shadowColor: theme.colors.shadow, marginBottom: 0 }]}
                      onPress={() => !isFolderEditMode && handleLocationPress(item.location.id)}
                      activeOpacity={isFolderEditMode ? 1 : 0.7}
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
                        {/* Alert symbol for locations with null coordinates (only in non-edit mode) */}
                        {!isFolderEditMode && (item.location.latitude === null || item.location.longitude === null) && (
                          <View style={styles.locationActions}>
                            <Ionicons name="alert-circle" size={18} color="#ff6b6b" />
                          </View>
                        )}
                      </View>
                    </TouchableOpacity>
                    {/* Remove button in edit mode */}
                    {isFolderEditMode && (
                      <TouchableOpacity
                        style={styles.removeButton}
                        onPress={() => selectedFolderId && handleRemoveFromFolder(selectedFolderId, item.location.id)}
                      >
                        <Ionicons name="remove-circle" size={24} color="#ff6b6b" />
                      </TouchableOpacity>
                    )}
                  </View>
                ))}
              </View>
            )}
          </ScrollView>
        )
      ) : (
        // Main view - show folders and unfiled locations
        <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
          {filteredLocations.length === 0 && folders.length === 0 ? (
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
              {/* Render folders first */}
              {folders.map((folder) => (
                <TouchableOpacity 
                  key={folder.id} 
                  style={[
                    styles.locationCard,
                    styles.folderCard,
                    { backgroundColor: folder.color + '20', borderColor: folder.color, shadowColor: theme.colors.shadow }
                  ]}
                  onPress={() => handleFolderPress(folder.id)}
                >
                  <View style={styles.folderCardContent}>
                    <Ionicons name="folder" size={32} color={folder.color} />
                    <Text style={[styles.folderTitle, { color: theme.colors.text }]} numberOfLines={2}>
                      {folder.title}
                    </Text>
                    <View style={[styles.folderCount, { backgroundColor: folder.color }]}>
                      <Text style={styles.folderCountText}>{folder.locationIds.length}</Text>
                    </View>
                  </View>
                </TouchableOpacity>
              ))}

              {/* Create folder card */}
              <TouchableOpacity 
                style={[
                  styles.locationCard,
                  styles.createFolderCard,
                  { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }
                ]}
                onPress={() => setShowCreateFolderModal(true)}
              >
                <View style={styles.createFolderContent}>
                  <Ionicons name="add-circle-outline" size={32} color={theme.colors.textSecondary} />
                  <Text style={[styles.createFolderText, { color: theme.colors.textSecondary }]}>
                    Create Folder
                  </Text>
                </View>
              </TouchableOpacity>

              {/* Render unfiled locations */}
              {getUnfiledLocations().map((item) => (
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
      )}

      {/* Create Folder Modal */}
      <CreateFolderModal
        visible={showCreateFolderModal}
        onClose={() => setShowCreateFolderModal(false)}
        onCreateFolder={handleCreateFolder}
      />

      {/* Location Selector Modal */}
      {selectedFolderId && (
        <LocationSelectorModal
          visible={showLocationSelectorModal}
          onClose={() => setShowLocationSelectorModal(false)}
          onAddLocations={handleAddLocationsToFolder}
          availableLocations={getUnfiledLocations()}
          currentFolderLocationIds={[]}
        />
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
  reorderButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
  },
  draggableGridContainer: {
    flex: 1,
    paddingHorizontal: 12,
    paddingTop: 4,
  },
  draggableLocationCard: {
    marginBottom: 0,
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
  folderCard: {
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
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
    top: 8,
    right: 8,
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  folderCountText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: 'bold',
  },
  createFolderCard: {
    borderWidth: 2,
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
  },
  createFolderContent: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  createFolderText: {
    fontSize: 13,
    fontWeight: '600',
    marginTop: 8,
  },
  folderHeaderButtons: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  locationCardWrapper: {
    position: 'relative',
    width: locationCardWidth,
    marginBottom: 8,
  },
  removeButton: {
    position: 'absolute',
    top: -8,
    right: -8,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
    zIndex: 10,
  },
}); 
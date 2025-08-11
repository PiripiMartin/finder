import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Alert, Image, ScrollView, StyleSheet, Switch, Text, TouchableOpacity, View, ActivityIndicator, RefreshControl } from "react-native";
import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { getApiUrl, API_CONFIG } from '../config/api';

interface ProfileData {
  username: string;
  email: string;
  createdAt: string;
}

export default function Profile() {
  const { isDarkMode, toggleDarkMode, theme } = useTheme();
  const { logout, sessionToken } = useAuth();
  const router = useRouter();
  
  const [profileData, setProfileData] = useState<ProfileData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch profile data from API
  const fetchProfileData = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      console.log('👤 [Profile] Fetching profile data...');
      const apiUrl = `${API_CONFIG.BASE_URL}/profile`;
      console.log('🌐 [Profile] API URL:', apiUrl);
      
      const response = await fetch(apiUrl, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${sessionToken || ''}`,
        },
      });
      
      console.log('📥 [Profile] Response Details:', {
        status: response.status,
        statusText: response.statusText,
        ok: response.ok,
        timestamp: new Date().toISOString()
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      console.log('👤 [Profile] API response data:', data);
      
      // The API returns an array, so we take the first item
      const profile = Array.isArray(data) && data.length > 0 ? data[0] : null;
      
      if (profile) {
        setProfileData(profile);
        console.log('👤 [Profile] Profile data set:', profile);
      } else {
        throw new Error('No profile data received');
      }
      
    } catch (error) {
      console.error('👤 [Profile] Error fetching profile data:', error);
      setError(error instanceof Error ? error.message : 'Failed to fetch profile data');
    } finally {
      setIsLoading(false);
    }
  };

  // Refresh profile data
  const handleRefresh = () => {
    console.log('🔄 [Profile] Refreshing profile data...');
    fetchProfileData();
  };

  useEffect(() => {
    console.log('👤 [Profile] Page loaded, fetching profile data...');
    if (sessionToken) {
      fetchProfileData();
    } else {
      setIsLoading(false);
      setError('No authentication token available');
    }
  }, [sessionToken]);

  if (isLoading) {
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text style={[styles.loadingText, { color: theme.colors.textSecondary }]}>Loading profile...</Text>
        </View>
      </View>
    );
  }

  if (error) {
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle" size={48} color="#ff6b6b" />
          <Text style={[styles.errorText, { color: theme.colors.textSecondary }]}>Failed to load profile</Text>
          <Text style={[styles.errorSubtext, { color: theme.colors.textSecondary }]}>{error}</Text>
          <TouchableOpacity 
            style={[styles.retryButton, { backgroundColor: theme.colors.primary }]}
            onPress={handleRefresh}
          >
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <ScrollView 
      style={[styles.container, { backgroundColor: theme.colors.background }]} 
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={isLoading}
          onRefresh={handleRefresh}
          colors={[theme.colors.primary]}
          tintColor={theme.colors.primary}
        />
      }
    >
      {/* Header with Avatar */}
      <View style={[styles.header, { backgroundColor: theme.colors.surface }]}>
        <View style={styles.avatarContainer}>
          <Image 
            source={{ uri: 'https://picsum.photos/150/150?random=100' }} 
            style={styles.avatar} 
          />
          <TouchableOpacity style={styles.editAvatarButton}>
            <Ionicons name="camera" size={16} color={theme.colors.primary} />
          </TouchableOpacity>
        </View>
        
        <Text style={[styles.username, { color: theme.colors.text }]}>@{profileData?.username || 'loading...'}</Text>
        <Text style={[styles.displayName, { color: theme.colors.textSecondary }]}>
          {profileData?.email || 'loading...'}
        </Text>
        
        <View style={styles.bioContainer}>
          <Text style={[styles.bio, { color: theme.colors.text }]}>
            Member since {profileData?.createdAt ? new Date(profileData.createdAt).toLocaleDateString() : 'loading...'}
          </Text>
        </View>

        {/* Stats */}
        <View style={styles.statsContainer}>
          <View style={styles.statItem}>
            <Text style={[styles.statNumber, { color: theme.colors.text }]}>127</Text>
            <Text style={[styles.statLabel, { color: theme.colors.textSecondary }]}>Following</Text>
          </View>
          <View style={[styles.statDivider, { backgroundColor: theme.colors.border }]} />
          <View style={styles.statItem}>
            <Text style={[styles.statNumber, { color: theme.colors.text }]}>2.4K</Text>
            <Text style={[styles.statLabel, { color: theme.colors.textSecondary }]}>Followers</Text>
          </View>
          <View style={[styles.statDivider, { backgroundColor: theme.colors.border }]} />
          <View style={styles.statItem}>
            <Text style={[styles.statNumber, { color: theme.colors.text }]}>89</Text>
            <Text style={[styles.statLabel, { color: theme.colors.textSecondary }]}>Likes</Text>
          </View>
        </View>

        {/* Edit Profile Button */}
        <TouchableOpacity style={[styles.editProfileButton, { backgroundColor: theme.colors.primary }]}>
          <Text style={styles.editProfileText}>Edit Profile</Text>
        </TouchableOpacity>
        
        {/* Refresh Button */}
        <TouchableOpacity 
          style={[styles.refreshButton, { backgroundColor: theme.colors.primary }]}
          onPress={handleRefresh}
        >
          <Ionicons name="refresh" size={20} color="#ffffff" />
        </TouchableOpacity>
      </View>

      {/* Profile Sections */}
      <View style={styles.sectionsContainer}>
        {/* Favorite Beverages */}
        <View style={[styles.section, { backgroundColor: theme.colors.surface, shadowColor: theme.colors.shadow }]}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Favorite Beverages</Text>
          <View style={styles.beverageGrid}>
            <View style={[styles.beverageItem, { backgroundColor: theme.colors.background }]}>
              <Text style={styles.beverageEmoji}>☕</Text>
              <Text style={[styles.beverageName, { color: theme.colors.text }]}>Espresso</Text>
            </View>
            <View style={[styles.beverageItem, { backgroundColor: theme.colors.background }]}>
              <Text style={styles.beverageEmoji}>🧋</Text>
              <Text style={[styles.beverageName, { color: theme.colors.text }]}>Taro Milk Tea</Text>
            </View>
            <View style={[styles.beverageItem, { backgroundColor: theme.colors.background }]}>
              <Text style={styles.beverageEmoji}>🫖</Text>
              <Text style={[styles.beverageName, { color: theme.colors.text }]}>Green Tea</Text>
            </View>
            <View style={[styles.beverageItem, { backgroundColor: theme.colors.background }]}>
              <Text style={styles.beverageEmoji}>☕</Text>
              <Text style={[styles.beverageName, { color: theme.colors.text }]}>Cappuccino</Text>
            </View>
          </View>
        </View>

        {/* Recent Activity */}
        <View style={[styles.section, { backgroundColor: theme.colors.surface, shadowColor: theme.colors.shadow }]}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Recent Activity</Text>
          <View style={styles.activityList}>
            <View style={styles.activityItem}>
              <Ionicons name="heart" size={16} color="#ff4757" />
              <Text style={[styles.activityText, { color: theme.colors.text }]}>Liked &ldquo;Amazing Coffee Art&rdquo;</Text>
              <Text style={[styles.activityTime, { color: theme.colors.textSecondary }]}>2h ago</Text>
            </View>
            <View style={styles.activityItem}>
              <Ionicons name="bookmark" size={16} color={theme.colors.primary} />
              <Text style={[styles.activityText, { color: theme.colors.text }]}>Saved &ldquo;Bubble Tea Recipe&rdquo;</Text>
              <Text style={[styles.activityTime, { color: theme.colors.textSecondary }]}>5h ago</Text>
            </View>
            <View style={styles.activityItem}>
              <Ionicons name="location" size={16} color="#2ed573" />
              <Text style={[styles.activityText, { color: theme.colors.text }]}>Visited Coffee Shop</Text>
              <Text style={[styles.activityTime, { color: theme.colors.textSecondary }]}>1d ago</Text>
            </View>
          </View>
        </View>

        {/* Logout Button */}
        <TouchableOpacity 
          style={[styles.logoutButton, { backgroundColor: '#ff4757' }]}
          onPress={() => {
            Alert.alert(
              'Logout',
              'Are you sure you want to logout?',
              [
                {
                  text: 'Cancel',
                  style: 'cancel',
                },
                {
                  text: 'Logout',
                  style: 'destructive',
                  onPress: async () => {
                    await logout();
                    router.replace('/auth/login');
                  },
                },
              ]
            );
          }}
        >
          <Ionicons name="log-out-outline" size={20} color="#ffffff" />
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>

        {/* Settings */}
        <View style={[styles.section, { backgroundColor: theme.colors.surface, shadowColor: theme.colors.shadow }]}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Settings</Text>
          <View style={styles.settingsList}>
            <TouchableOpacity style={styles.settingItem}>
              <Ionicons name="notifications" size={20} color={theme.colors.text} />
              <Text style={[styles.settingText, { color: theme.colors.text }]}>Notifications</Text>
              <Ionicons name="chevron-forward" size={16} color={theme.colors.textSecondary} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.settingItem}>
              <Ionicons name="lock-closed" size={20} color={theme.colors.text} />
              <Text style={[styles.settingText, { color: theme.colors.text }]}>Privacy</Text>
              <Ionicons name="chevron-forward" size={16} color={theme.colors.textSecondary} />
            </TouchableOpacity>
            <View style={styles.settingItem}>
              <Ionicons name="moon" size={20} color={theme.colors.text} />
              <Text style={[styles.settingText, { color: theme.colors.text }]}>Dark Mode</Text>
              <Switch
                value={isDarkMode}
                onValueChange={toggleDarkMode}
                trackColor={{ false: theme.colors.border, true: theme.colors.primary }}
                thumbColor={isDarkMode ? '#ffffff' : '#f4f3f4'}
              />
            </View>
            <TouchableOpacity style={styles.settingItem}>
              <Ionicons name="help-circle" size={20} color={theme.colors.text} />
              <Text style={[styles.settingText, { color: theme.colors.text }]}>Help & Support</Text>
              <Ionicons name="chevron-forward" size={16} color={theme.colors.textSecondary} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.settingItem}>
              <Ionicons name="information-circle" size={20} color={theme.colors.text} />
              <Text style={[styles.settingText, { color: theme.colors.text }]}>About</Text>
              <Ionicons name="chevron-forward" size={16} color={theme.colors.textSecondary} />
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  header: {
    backgroundColor: '#ffffff',
    padding: 20,
    paddingTop: 60,
    alignItems: 'center',
  },
  avatarContainer: {
    position: 'relative',
    marginBottom: 16,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 3,
    borderColor: '#007AFF',
  },
  editAvatarButton: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: '#ffffff',
    borderRadius: 15,
    width: 30,
    height: 30,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#007AFF',
  },
  username: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  displayName: {
    fontSize: 16,
    color: '#666',
    marginBottom: 12,
  },
  bioContainer: {
    marginBottom: 20,
  },
  bio: {
    fontSize: 14,
    color: '#333',
    textAlign: 'center',
    lineHeight: 20,
  },
  statsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  statItem: {
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  statNumber: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    height: 30,
    backgroundColor: '#e0e0e0',
  },
  editProfileButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 24,
    paddingVertical: 8,
    borderRadius: 20,
  },
  editProfileText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  refreshButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 12,
  },
  sectionsContainer: {
    padding: 20,
  },
  section: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
  },
  beverageGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  beverageItem: {
    width: '48%',
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    alignItems: 'center',
  },
  beverageEmoji: {
    fontSize: 24,
    marginBottom: 4,
  },
  beverageName: {
    fontSize: 12,
    color: '#333',
    textAlign: 'center',
  },
  activityList: {
    gap: 12,
  },
  activityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  activityText: {
    flex: 1,
    fontSize: 14,
    color: '#333',
    marginLeft: 8,
  },
  activityTime: {
    fontSize: 12,
    color: '#999',
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ff4757',
    paddingVertical: 16,
    borderRadius: 12,
    marginTop: 20,
    gap: 8,
  },
  logoutText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  settingsList: {
    gap: 8,
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between', // Added to align switch to the right
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 8,
  },
  settingText: {
    flex: 1,
    fontSize: 14,
    color: '#333',
    marginLeft: 12,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
  },
  loadingText: {
    marginTop: 10,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#f8f9fa',
  },
  errorText: {
    fontSize: 18,
    marginBottom: 10,
  },
  errorSubtext: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 20,
  },
  retryButton: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
}); 
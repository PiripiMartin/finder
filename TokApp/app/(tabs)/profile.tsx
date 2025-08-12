import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, RefreshControl, ScrollView, StyleSheet, Switch, Text, TouchableOpacity, View } from "react-native";
import { API_CONFIG } from '../config/api';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

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
          <View style={[styles.avatar, { backgroundColor: theme.colors.primary }]}>
            <Text style={styles.avatarEmoji}>🐶</Text>
          </View>
        </View>
        
        <Text style={[styles.username, { color: theme.colors.text }]}>
          @{profileData?.username || 'loading...'}
        </Text>
        <Text style={[styles.displayName, { color: theme.colors.textSecondary }]}>
          {profileData?.email || 'loading...'}
        </Text>
        
        {!profileData && (
          <Text style={[styles.bio, { color: theme.colors.textSecondary, marginTop: 8 }]}>
            Tap refresh to load your profile
          </Text>
        )}
        
        {profileData?.createdAt ? (
          <View style={styles.bioContainer}>
            <Text style={[styles.bio, { color: theme.colors.text }]}>
              Member since {new Date(profileData.createdAt).toLocaleDateString()}
            </Text>
          </View>
        ) : (
          <View style={styles.bioContainer}>
            <Text style={[styles.bio, { color: theme.colors.textSecondary }]}>
              Profile information loading...
            </Text>
          </View>
        )}

        {/* Edit Profile Button - Placeholder for future functionality */}
        <TouchableOpacity 
          style={[styles.editProfileButton, { backgroundColor: theme.colors.primary, opacity: 0.6 }]}
          disabled={true}
        >
          <Text style={styles.editProfileText}>Edit Profile (Coming Soon)</Text>
        </TouchableOpacity>
        
        {/* Refresh Button */}
        <TouchableOpacity 
          style={[styles.refreshButton, { backgroundColor: theme.colors.primary }]}
          onPress={handleRefresh}
        >
          <Ionicons name="refresh" size={20} color="#FFF0F0" />
        </TouchableOpacity>
      </View>

      {/* Profile Sections */}
      <View style={styles.sectionsContainer}>




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
          <Ionicons name="log-out-outline" size={20} color="#FFF0F0" />
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>

        {/* Spacing between logout and settings */}
        <View style={styles.spacer} />

        {/* Settings */}
        <View style={[styles.section, { backgroundColor: theme.colors.surface, shadowColor: theme.colors.shadow }]}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Settings</Text>
          <View style={styles.settingsList}>
            <View style={styles.settingItem}>
              <Ionicons name="moon" size={20} color={theme.colors.text} />
              <Text style={[styles.settingText, { color: theme.colors.text }]}>Dark Mode</Text>
              <Switch
                value={isDarkMode}
                onValueChange={toggleDarkMode}
                trackColor={{ false: theme.colors.border, true: theme.colors.primary }}
                thumbColor={isDarkMode ? '#FFF0F0' : '#f4f3f4'}
              />
            </View>
          </View>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#EBD4D4',
  },
  header: {
    backgroundColor: '#FFF0F0',
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
    borderColor: '#4E8886',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarEmoji: {
    fontSize: 50,
  },

  username: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  displayName: {
    fontSize: 16,
    color: '#835858',
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

  editProfileButton: {
    backgroundColor: '#4E8886',
    paddingHorizontal: 24,
    paddingVertical: 8,
    borderRadius: 20,
  },
  editProfileText: {
    color: '#FFF0F0',
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
    backgroundColor: '#FFF0F0',
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
    color: '#FFF0F0',
    fontSize: 16,
    fontWeight: '600',
  },
  spacer: {
    height: 20,
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
    backgroundColor: '#EBD4D4',
  },
  loadingText: {
    marginTop: 10,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#EBD4D4',
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
    color: '#FFF0F0',
    fontSize: 16,
    fontWeight: '600',
  },
}); 
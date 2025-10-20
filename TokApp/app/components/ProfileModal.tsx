import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Modal, ScrollView, StyleSheet, Switch, Text, TouchableOpacity, View } from "react-native";
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { API_CONFIG } from '../config/api';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

interface ProfileData {
  username: string;
  email: string;
  createdAt: string;
}

interface ProfileModalProps {
  visible: boolean;
  onClose: () => void;
}

export default function ProfileModal({ visible, onClose }: ProfileModalProps) {
  const { isDarkMode, toggleDarkMode, theme } = useTheme();
  const { sessionToken, isGuest, logout } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  
  const [profileData, setProfileData] = useState<ProfileData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mapsPref, setMapsPref] = useState<'apple' | 'google'>('apple');
  const MAPS_PREF_KEY = 'DEFAULT_MAPS_APP';

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

  // Delete account
  const handleDeleteAccount = () => {
    Alert.alert(
      'Delete Account',
      'Are you sure you want to delete your account? This action cannot be undone and all your saved locations will be permanently deleted.',
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
              console.log('👤 [Profile] Deleting account...');
              const apiUrl = `${API_CONFIG.BASE_URL}/delete-account`;
              console.log('🌐 [Profile] DELETE URL:', apiUrl);

              const response = await fetch(apiUrl, {
                method: 'DELETE',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${sessionToken || ''}`,
                },
              });

              console.log('📥 [Profile] Delete Response:', {
                status: response.status,
                ok: response.ok,
                timestamp: new Date().toISOString()
              });

              if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
              }

              // Close modal and redirect to login after successful deletion
              onClose();
              router.replace('/auth/login');
            } catch (error) {
              console.error('👤 [Profile] Error deleting account:', error);
              setError(error instanceof Error ? error.message : 'Failed to delete account');
            }
          },
        },
      ]
    );
  };

  const handleLogout = () => {
    logout();
    onClose();
    router.replace('/auth/login');
  };

  useEffect(() => {
    if (visible && sessionToken) {
      console.log('👤 [Profile] Modal opened, fetching profile data...');
      fetchProfileData();
    }
    // Load maps preference
    (async () => {
      try {
        const value = await AsyncStorage.getItem(MAPS_PREF_KEY);
        if (value === 'google' || value === 'apple') setMapsPref(value);
      } catch {}
    })();
  }, [visible, sessionToken]);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={[styles.modalContainer, { backgroundColor: theme.colors.background, paddingTop: insets.top }]}>
        {/* Header with close button */}
        <View style={[styles.modalHeader, { borderBottomColor: theme.colors.border }]}>
          <Text style={[styles.modalTitle, { color: theme.colors.text }]}>Profile</Text>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Ionicons name="close" size={28} color={theme.colors.text} />
          </TouchableOpacity>
        </View>

        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={theme.colors.primary} />
            <Text style={[styles.loadingText, { color: theme.colors.textSecondary }]}>Loading profile...</Text>
          </View>
        ) : isGuest ? (
          <View style={styles.guestContainer}>
            <Ionicons name="person-outline" size={80} color={theme.colors.textSecondary} />
            <Text style={[styles.guestTitle, { color: theme.colors.text }]}>Login to Access Profile</Text>
            <Text style={[styles.guestSubtitle, { color: theme.colors.textSecondary }]}>
              Create an account or sign in to access your profile, saved locations, and preferences.
            </Text>
            <TouchableOpacity
              style={[styles.loginButton, { backgroundColor: theme.colors.primary }]}
              onPress={() => {
                onClose();
                router.push('/auth/login');
              }}
            >
              <Text style={[styles.loginButtonText, { color: theme.colors.surface }]}>Login</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.createAccountButton, { borderColor: theme.colors.primary }]}
              onPress={() => {
                onClose();
                router.push('/auth/create-account');
              }}
            >
              <Text style={[styles.createAccountButtonText, { color: theme.colors.primary }]}>Create Account</Text>
            </TouchableOpacity>
          </View>
        ) : error ? (
          <View style={styles.errorContainer}>
            <Ionicons name="alert-circle" size={48} color="#ff6b6b" />
            <Text style={[styles.errorText, { color: theme.colors.textSecondary }]}>Failed to load profile</Text>
            <Text style={[styles.errorSubtext, { color: theme.colors.textSecondary }]}>{error}</Text>
            <TouchableOpacity 
              style={[styles.retryButton, { backgroundColor: theme.colors.primary }]}
              onPress={fetchProfileData}
            >
              <Text style={styles.retryButtonText}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <ScrollView 
            style={styles.scrollView}
            showsVerticalScrollIndicator={false}
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
            </View>

            {/* Profile Sections */}
            <View style={styles.sectionsContainer}>
              {/* Theme Toggle Section */}
              <View style={[styles.section, { backgroundColor: theme.colors.surface }]}>
                <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Appearance</Text>
                <View style={styles.settingsList}>
                  <View style={[styles.settingItem, { backgroundColor: theme.colors.background }]}>
                    <View style={styles.settingLeft}>
                      <Ionicons name="moon" size={20} color={theme.colors.textSecondary} />
                      <Text style={[styles.settingText, { color: theme.colors.text }]}>Dark Mode</Text>
                    </View>
                    <Switch
                      value={isDarkMode}
                      onValueChange={toggleDarkMode}
                      trackColor={{ false: theme.colors.border, true: theme.colors.primary }}
                      thumbColor={isDarkMode ? theme.colors.surface : theme.colors.surface}
                    />
                  </View>
                </View>
              </View>

              {/* Directions Preference */}
              <View style={[styles.section, { backgroundColor: theme.colors.surface }]}>
                <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Directions</Text>
                <View style={styles.settingsList}>
                  <View style={[styles.settingItem, { backgroundColor: theme.colors.background }]}> 
                    <View style={styles.settingLeft}>
                      <Ionicons name="navigate" size={20} color={theme.colors.textSecondary} />
                      <Text style={[styles.settingText, { color: theme.colors.text }]}>Default maps app</Text>
                    </View>
                  </View>
                  <View style={styles.mapsButtonsContainer}>
                    <TouchableOpacity
                      onPress={async () => { await AsyncStorage.setItem(MAPS_PREF_KEY, 'apple'); setMapsPref('apple'); }}
                      style={[
                        styles.mapsButton,
                        { borderColor: theme.colors.border },
                        mapsPref === 'apple' && { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary }
                      ]}
                    >
                      <Ionicons name="logo-apple" size={18} color={mapsPref === 'apple' ? '#FFFFFF' : theme.colors.textSecondary} />
                      <Text style={[styles.mapsButtonText, { color: mapsPref === 'apple' ? '#FFFFFF' : theme.colors.text }]}>Apple Maps</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={async () => { await AsyncStorage.setItem(MAPS_PREF_KEY, 'google'); setMapsPref('google'); }}
                      style={[
                        styles.mapsButton,
                        { borderColor: theme.colors.border },
                        mapsPref === 'google' && { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary }
                      ]}
                    >
                      <Ionicons name="logo-google" size={18} color={mapsPref === 'google' ? '#FFFFFF' : theme.colors.textSecondary} />
                      <Text style={[styles.mapsButtonText, { color: mapsPref === 'google' ? '#FFFFFF' : theme.colors.text }]}>Google Maps</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>

              {/* Logout Section */}
              <View style={[styles.section, { backgroundColor: theme.colors.surface }]}>
                <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Account</Text>
                <View style={styles.settingsList}>
                  <TouchableOpacity 
                    style={[styles.logoutButton, { backgroundColor: theme.colors.primary }]}
                    onPress={handleLogout}
                  >
                    <Ionicons name="log-out" size={20} color={theme.colors.surface} />
                    <Text style={[styles.logoutButtonText, { color: theme.colors.surface }]}>Logout</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Delete Account */}
              <TouchableOpacity 
                style={[styles.deleteButton, { backgroundColor: '#D97B7B' }]}
                onPress={handleDeleteAccount}
              >
                <Ionicons name="trash-outline" size={20} color="#FFFFFF" />
                <Text style={styles.deleteText}>Delete Account</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  closeButton: {
    padding: 4,
  },
  scrollView: {
    flex: 1,
  },
  header: {
    backgroundColor: '#FFFFFF',
    padding: 20,
    paddingTop: 30,
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
    borderColor: '#A8C3A0',
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
    color: '#666666',
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
  sectionsContainer: {
    padding: 20,
  },
  section: {
    backgroundColor: '#FFFFFF',
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
  settingsList: {
    gap: 8,
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
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
  settingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 12,
    marginTop: 20,
    gap: 8,
  },
  logoutButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
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
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 12,
    marginTop: 20,
    gap: 8,
  },
  deleteText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
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
  mapsButtonsContainer: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 8,
    paddingTop: 8,
  },
  mapsButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    gap: 8,
  },
  mapsButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
});


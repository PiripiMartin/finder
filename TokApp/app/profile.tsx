import { Ionicons } from '@expo/vector-icons';
import { Image, ScrollView, StyleSheet, Switch, Text, TouchableOpacity, View } from "react-native";
import { useTheme } from './context/ThemeContext';

export default function Profile() {
  const { isDarkMode, toggleDarkMode, theme } = useTheme();

  return (
    <ScrollView style={[styles.container, { backgroundColor: theme.colors.background }]} showsVerticalScrollIndicator={false}>
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
        
        <Text style={[styles.username, { color: theme.colors.text }]}>@beverage_lover</Text>
        <Text style={[styles.displayName, { color: theme.colors.textSecondary }]}>Coffee & Tea Enthusiast</Text>
        
        <View style={styles.bioContainer}>
          <Text style={[styles.bio, { color: theme.colors.text }]}>
            ☕ Coffee addict | 🧋 Bubble tea explorer | 🫖 Tea ceremony lover
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
              <Text style={[styles.activityText, { color: theme.colors.text }]}>Liked "Amazing Coffee Art"</Text>
              <Text style={[styles.activityTime, { color: theme.colors.textSecondary }]}>2h ago</Text>
            </View>
            <View style={styles.activityItem}>
              <Ionicons name="bookmark" size={16} color={theme.colors.primary} />
              <Text style={[styles.activityText, { color: theme.colors.text }]}>Saved "Bubble Tea Recipe"</Text>
              <Text style={[styles.activityTime, { color: theme.colors.textSecondary }]}>5h ago</Text>
            </View>
            <View style={styles.activityItem}>
              <Ionicons name="location" size={16} color="#2ed573" />
              <Text style={[styles.activityText, { color: theme.colors.text }]}>Visited Coffee Shop</Text>
              <Text style={[styles.activityTime, { color: theme.colors.textSecondary }]}>1d ago</Text>
            </View>
          </View>
        </View>

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
}); 
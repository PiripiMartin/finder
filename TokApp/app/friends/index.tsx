import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Modal,
  RefreshControl,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Clipboard from 'expo-clipboard';
import { API_CONFIG } from '../config/api';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

interface Friend {
  id: number;
  username: string;
  email: string;
  pfpUrl?: string;
  createdAt: string;
}

export default function FriendsScreen() {
  const router = useRouter();
  const { theme } = useTheme();
  const { sessionToken } = useAuth();
  const insets = useSafeAreaInsets();

  const [friends, setFriends] = useState<Friend[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<number | null>(null);

  // Modal states
  const [showAddFriendModal, setShowAddFriendModal] = useState(false);
  const [friendInput, setFriendInput] = useState('');
  const [isAddingFriend, setIsAddingFriend] = useState(false);

  // Fetch current user's userId from token validation
  const fetchCurrentUser = async () => {
    try {
      const response = await fetch(`${API_CONFIG.BASE_URL}/validate-token`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${sessionToken}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to validate token: ${response.status}`);
      }

      const data = await response.json();
      
      if (data && data.userId) {
        setCurrentUserId(data.userId);
      }
    } catch (error) {
      console.error('Error fetching current user:', error);
    }
  };

  // Fetch friends list
  const fetchFriends = async () => {
    try {
      setError(null);
      console.log('👥 [Friends] Fetching friends list...');

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
      console.log('👥 [Friends] Fetched friends:', data);
      setFriends(data);
    } catch (error) {
      console.error('👥 [Friends] Error fetching friends:', error);
      setError(error instanceof Error ? error.message : 'Failed to load friends');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  // Add friend
  const addFriend = async () => {
    const input = friendInput.trim();
    if (!input) {
      Alert.alert('Invalid Input', 'Please enter a friend code or link');
      return;
    }

    // Extract userId from input (could be just a number or a link)
    let friendUserId: number;
    
    // Check if it's a link format (lai://add-friend/123 or contains add-friend)
    if (input.includes('add-friend')) {
      const match = input.match(/add-friend\/(\d+)/);
      if (match && match[1]) {
        friendUserId = parseInt(match[1], 10);
      } else {
        Alert.alert('Invalid Link', 'Could not extract friend code from link');
        return;
      }
    } else {
      // Assume it's just a number
      friendUserId = parseInt(input, 10);
      if (isNaN(friendUserId)) {
        Alert.alert('Invalid Input', 'Please enter a valid friend code (number)');
        return;
      }
    }

    try {
      setIsAddingFriend(true);
      console.log('👥 [Friends] Adding friend with userId:', friendUserId);

      const response = await fetch(`${API_CONFIG.BASE_URL}/friends`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${sessionToken}`,
        },
        body: JSON.stringify({ friendUserId }),
      });

      const data = await response.json();

      if (!response.ok) {
        if (response.status === 404) {
          Alert.alert('User Not Found', 'No user exists with this friend code');
        } else if (response.status === 400) {
          Alert.alert('Cannot Add Friend', data.message || 'Invalid request');
        } else {
          throw new Error(`Failed to add friend: ${response.status}`);
        }
        return;
      }

      if (data.added === false) {
        Alert.alert('Already Friends', data.message || 'You are already friends with this user');
      } else {
        Alert.alert('Success!', 'Friend added successfully');
        setFriendInput('');
        setShowAddFriendModal(false);
        await fetchFriends();
      }
    } catch (error) {
      console.error('👥 [Friends] Error adding friend:', error);
      Alert.alert('Error', error instanceof Error ? error.message : 'Failed to add friend');
    } finally {
      setIsAddingFriend(false);
    }
  };

  // Share friend code
  const shareFriendCode = async () => {
    if (!currentUserId) {
      Alert.alert('Error', 'Could not get your friend code');
      return;
    }

    try {
      const shareUrl = `lai://add-friend/${currentUserId}`;
      const message = `Add me as a friend on Lai!\n\nMy Friend Code: ${currentUserId}\n\nOr use this link: ${shareUrl}`;

      await Share.share({
        message,
        url: shareUrl,
      });
    } catch (error) {
      console.error('Error sharing friend code:', error);
    }
  };

  // Copy friend code to clipboard
  const copyFriendCode = async () => {
    if (!currentUserId) {
      Alert.alert('Error', 'Could not get your friend code');
      return;
    }

    await Clipboard.setStringAsync(currentUserId.toString());
    Alert.alert('Copied!', 'Your friend code has been copied to clipboard');
  };

  // Handle refresh
  const onRefresh = () => {
    setIsRefreshing(true);
    fetchFriends();
  };

  // Format date
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
  };

  useEffect(() => {
    fetchCurrentUser();
    fetchFriends();
  }, []);

  // Render friend card
  const renderFriend = ({ item }: { item: Friend }) => (
    <View style={[styles.friendCard, { backgroundColor: theme.colors.surface }]}>
      <View style={styles.friendAvatar}>
        {item.pfpUrl ? (
          <Image source={{ uri: item.pfpUrl }} style={styles.avatarImage} />
        ) : (
          <View style={[styles.avatarPlaceholder, { backgroundColor: theme.colors.primary }]}>
            <Ionicons name="person" size={24} color={theme.colors.surface} />
          </View>
        )}
      </View>
      <View style={styles.friendInfo}>
        <Text style={[styles.friendUsername, { color: theme.colors.text }]}>
          @{item.username}
        </Text>
        <Text style={[styles.friendSince, { color: theme.colors.textSecondary }]}>
          Friends since {formatDate(item.createdAt)}
        </Text>
      </View>
    </View>
  );

  // Empty state
  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Ionicons name="people-outline" size={64} color={theme.colors.textSecondary} />
      <Text style={[styles.emptyTitle, { color: theme.colors.text }]}>
        No Friends Yet
      </Text>
      <Text style={[styles.emptySubtitle, { color: theme.colors.textSecondary }]}>
        Add friends to share locations and see their reviews
      </Text>
      <TouchableOpacity
        style={[styles.emptyButton, { backgroundColor: theme.colors.primary }]}
        onPress={() => setShowAddFriendModal(true)}
      >
        <Ionicons name="person-add" size={20} color={theme.colors.surface} />
        <Text style={[styles.emptyButtonText, { color: theme.colors.surface }]}>
          Add Your First Friend
        </Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {/* Header */}
      <View
        style={[
          styles.header,
          { 
            backgroundColor: theme.colors.surface,
            paddingTop: insets.top + 10,
            borderBottomColor: theme.colors.border,
          }
        ]}
      >
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.colors.text }]}>Friends</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Action Buttons */}
      {!isLoading && friends.length > 0 && (
        <View style={styles.actionButtons}>
          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: theme.colors.primary }]}
            onPress={() => setShowAddFriendModal(true)}
          >
            <Ionicons name="person-add" size={18} color={theme.colors.surface} />
            <Text style={[styles.actionButtonText, { color: theme.colors.surface }]}>
              Add Friend
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Content */}
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text style={[styles.loadingText, { color: theme.colors.textSecondary }]}>
            Loading friends...
          </Text>
        </View>
      ) : error ? (
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle" size={48} color="#ff6b6b" />
          <Text style={[styles.errorText, { color: theme.colors.text }]}>
            Failed to load friends
          </Text>
          <Text style={[styles.errorSubtext, { color: theme.colors.textSecondary }]}>
            {error}
          </Text>
          <TouchableOpacity
            style={[styles.retryButton, { backgroundColor: theme.colors.primary }]}
            onPress={fetchFriends}
          >
            <Text style={[styles.retryButtonText, { color: theme.colors.surface }]}>
              Retry
            </Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={friends}
          renderItem={renderFriend}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={renderEmptyState}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={onRefresh}
              tintColor={theme.colors.primary}
            />
          }
        />
      )}

      {/* Add Friend Modal */}
      <Modal
        visible={showAddFriendModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowAddFriendModal(false)}
      >
        <View style={[styles.modalContainer, { backgroundColor: theme.colors.background }]}>
          <View style={[styles.modalHeader, { 
            borderBottomColor: theme.colors.border,
            paddingTop: insets.top + 10,
          }]}>
            <Text style={[styles.modalTitle, { color: theme.colors.text }]}>
              Add Friend
            </Text>
            <TouchableOpacity
              onPress={() => setShowAddFriendModal(false)}
              style={styles.modalClose}
            >
              <Ionicons name="close" size={28} color={theme.colors.text} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalScrollView} showsVerticalScrollIndicator={false}>
            <View style={styles.modalContent}>
              {/* Add Friend Section */}
              <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
                Enter Friend Code
              </Text>
              <TextInput
                style={[styles.input, { 
                  backgroundColor: theme.colors.surface,
                  color: theme.colors.text,
                  borderColor: theme.colors.border,
                }]}
                placeholder="Enter friend code (e.g., 123) or paste link"
                placeholderTextColor={theme.colors.textSecondary}
                value={friendInput}
                onChangeText={setFriendInput}
                keyboardType="default"
                autoCapitalize="none"
                autoCorrect={false}
              />

              <TouchableOpacity
                style={[styles.addButton, { 
                  backgroundColor: theme.colors.primary,
                  opacity: isAddingFriend ? 0.6 : 1,
                }]}
                onPress={addFriend}
                disabled={isAddingFriend}
              >
                {isAddingFriend ? (
                  <ActivityIndicator size="small" color={theme.colors.surface} />
                ) : (
                  <>
                    <Ionicons name="person-add" size={20} color={theme.colors.surface} />
                    <Text style={[styles.addButtonText, { color: theme.colors.surface }]}>
                      Add Friend
                    </Text>
                  </>
                )}
              </TouchableOpacity>

              {/* Divider */}
              <View style={[styles.divider, { backgroundColor: theme.colors.border }]} />

              {/* Your Friend Code Section */}
              <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
                Your Friend Code
              </Text>
              <View style={[styles.codeContainer, { 
                backgroundColor: theme.colors.surface,
                borderColor: theme.colors.border,
              }]}>
                <Text style={[styles.codeText, { color: theme.colors.text }]}>
                  {currentUserId || '...'}
                </Text>
              </View>

              <View style={styles.shareButtonsRow}>
                <TouchableOpacity
                  style={[styles.shareActionButton, { backgroundColor: theme.colors.primary }]}
                  onPress={shareFriendCode}
                >
                  <Ionicons name="share-outline" size={20} color={theme.colors.surface} />
                  <Text style={[styles.shareActionButtonText, { color: theme.colors.surface }]}>
                    Share
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.shareActionButton, { 
                    backgroundColor: theme.colors.background,
                    borderWidth: 1,
                    borderColor: theme.colors.border,
                  }]}
                  onPress={copyFriendCode}
                >
                  <Ionicons name="copy-outline" size={20} color={theme.colors.primary} />
                  <Text style={[styles.shareActionButtonText, { color: theme.colors.primary }]}>
                    Copy
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
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
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  actionButtons: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 16,
    gap: 12,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 12,
    gap: 6,
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
    gap: 12,
  },
  errorText: {
    fontSize: 18,
    fontWeight: '600',
  },
  errorSubtext: {
    fontSize: 14,
    textAlign: 'center',
  },
  retryButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 8,
  },
  retryButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  listContent: {
    padding: 20,
    gap: 12,
  },
  friendCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  friendAvatar: {
    marginRight: 12,
  },
  avatarImage: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  avatarPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  friendInfo: {
    flex: 1,
  },
  friendUsername: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  friendSince: {
    fontSize: 13,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
    paddingTop: 60,
    gap: 16,
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginTop: 16,
  },
  emptySubtitle: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 22,
  },
  emptyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 25,
    marginTop: 8,
  },
  emptyButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  modalContainer: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  modalClose: {
    padding: 4,
  },
  modalScrollView: {
    flex: 1,
  },
  modalContent: {
    padding: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
    marginTop: 8,
  },
  divider: {
    height: 1,
    marginVertical: 24,
  },
  input: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 12,
    fontSize: 16,
    borderWidth: 1,
    marginBottom: 20,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    borderRadius: 12,
  },
  addButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  codeContainer: {
    padding: 20,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    marginBottom: 16,
  },
  codeText: {
    fontSize: 32,
    fontWeight: 'bold',
    letterSpacing: 2,
  },
  shareButtonsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 8,
  },
  shareActionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: 12,
  },
  shareActionButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
});


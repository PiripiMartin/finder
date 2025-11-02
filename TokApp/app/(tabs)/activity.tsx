import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { API_CONFIG } from '../config/api';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useFocusEffect } from 'expo-router';
import { useLocationContext } from '../context/LocationContext';
import { clearSavedLocationsCache } from '../utils/savedLocationsCache';

interface LocationInvitation {
  id: number;
  creatorId: number;
  recipientId: number;
  location: {
    id: number;
    title: string;
    description: string;
    emoji: string;
    latitude: number;
    longitude: number;
    googlePlaceId: string | null;
    websiteUrl: string | null;
    phoneNumber: string | null;
    address: string | null;
    recommendable: number;
    isValidLocation: number;
    createdAt: string;
  };
  message: string;
  createdAt: string;
}

interface SenderProfile {
  id: number;
  username: string;
  pfpUrl?: string;
}

interface FriendReview {
  review: {
    id: number;
    reviewerId: number;
    rating: number;
    review: string | null;
    createdAt: string;
    comments: Array<{
      id: number;
      reviewId: number;
      commenterId: number;
      comment: string;
      createdAt: string;
    }>;
    likes: number; // Added likes to the interface
  };
  location: LocationInvitation['location'];
  topPosts: Array<any>;
}

type ActivityItem = 
  | { type: 'invitation'; data: LocationInvitation; timestamp: number }
  | { type: 'review'; data: FriendReview; timestamp: number };

export default function ActivityScreen() {
  const router = useRouter();
  const { theme } = useTheme();
  const { sessionToken } = useAuth();
  const insets = useSafeAreaInsets();
  const { refreshLocations } = useLocationContext();

  const [invitations, setInvitations] = useState<LocationInvitation[]>([]);
  const [senderProfiles, setSenderProfiles] = useState<Map<number, SenderProfile>>(new Map());
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [acceptingIds, setAcceptingIds] = useState<Set<number>>(new Set());
  const [decliningIds, setDecliningIds] = useState<Set<number>>(new Set());
  
  // Review state
  const [reviews, setReviews] = useState<FriendReview[]>([]);
  const [reviewerProfiles, setReviewerProfiles] = useState<Map<number, SenderProfile>>(new Map());
  const [isLoadingReviews, setIsLoadingReviews] = useState(true);
  const [reviewsError, setReviewsError] = useState<string | null>(null);
  
  // Review detail modal state
  const [selectedReview, setSelectedReview] = useState<FriendReview | null>(null);
  const [showReviewDetailModal, setShowReviewDetailModal] = useState(false);
  const [isLiked, setIsLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [newComment, setNewComment] = useState('');
  const [isAddingComment, setIsAddingComment] = useState(false);
  const [isTogglingLike, setIsTogglingLike] = useState(false);
  const [savingLocationIds, setSavingLocationIds] = useState<Set<number>>(new Set());

  // Fetch location invitations
  const fetchInvitations = async () => {
    try {
      setError(null);
      console.log('🔔 [Activity] Fetching invitations...');

      const response = await fetch(`${API_CONFIG.BASE_URL}/location-invitations`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${sessionToken}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch invitations: ${response.status}`);
      }

      const data = await response.json();
      console.log('🔔 [Activity] Fetched invitations:', data.length);
      setInvitations(data);

      // Extract unique creator IDs and fetch their profiles
      const uniqueCreatorIds = [...new Set(data.map((inv: LocationInvitation) => inv.creatorId))] as number[];
      await fetchSenderProfiles(uniqueCreatorIds);
    } catch (error) {
      console.error('🔔 [Activity] Error fetching invitations:', error);
      setError(error instanceof Error ? error.message : 'Failed to load activity');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  // Fetch sender profiles using friends list
  const fetchSenderProfiles = async (creatorIds: number[]) => {
    try {
      console.log('🔔 [Activity] Fetching sender profiles for:', creatorIds);

      const response = await fetch(`${API_CONFIG.BASE_URL}/friends`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${sessionToken}`,
        },
      });

      if (!response.ok) {
        console.warn('Failed to fetch friends list for profiles');
        return;
      }

      const friends = await response.json();
      const profilesMap = new Map<number, SenderProfile>();

      friends.forEach((friend: any) => {
        if (creatorIds.includes(friend.id)) {
          profilesMap.set(friend.id, {
            id: friend.id,
            username: friend.username,
            pfpUrl: friend.pfpUrl,
          });
        }
      });

      setSenderProfiles(profilesMap);
      console.log('🔔 [Activity] Loaded sender profiles:', profilesMap.size);
    } catch (error) {
      console.error('🔔 [Activity] Error fetching sender profiles:', error);
    }
  };

  // Fetch reviews
  const fetchReviews = async () => {
    try {
      setReviewsError(null);
      console.log('🔔 [Activity] Fetching reviews...');

      const response = await fetch(`${API_CONFIG.BASE_URL}/friends/reviews`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${sessionToken}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch reviews: ${response.status}`);
      }

      const data = await response.json();
      console.log('🔔 [Activity] Fetched reviews:', data.length);
      setReviews(data);

      // Extract unique reviewer IDs and fetch their profiles
      const uniqueReviewerIds = [...new Set(data.map((r: FriendReview) => r.review.reviewerId))] as number[];
      await fetchReviewerProfiles(uniqueReviewerIds);
    } catch (error) {
      console.error('🔔 [Activity] Error fetching reviews:', error);
      setReviewsError(error instanceof Error ? error.message : 'Failed to load reviews');
    } finally {
      setIsLoadingReviews(false);
    }
  };

  // Fetch reviewer profiles using friends list
  const fetchReviewerProfiles = async (reviewerIds: number[]) => {
    try {
      console.log('🔔 [Activity] Fetching reviewer profiles for:', reviewerIds);

      const response = await fetch(`${API_CONFIG.BASE_URL}/friends`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${sessionToken}`,
        },
      });

      if (!response.ok) {
        console.warn('Failed to fetch friends list for reviewer profiles');
        return;
      }

      const friends = await response.json();
      const profilesMap = new Map<number, SenderProfile>();

      friends.forEach((friend: any) => {
        if (reviewerIds.includes(friend.id)) {
          profilesMap.set(friend.id, {
            id: friend.id,
            username: friend.username,
            pfpUrl: friend.pfpUrl,
          });
        }
      });

      setReviewerProfiles(profilesMap);
      console.log('🔔 [Activity] Loaded reviewer profiles:', profilesMap.size);
    } catch (error) {
      console.error('🔔 [Activity] Error fetching reviewer profiles:', error);
    }
  };

  // Refresh handler
  const onRefresh = useCallback(() => {
    setIsRefreshing(true);
    Promise.all([fetchInvitations(), fetchReviews()])
      .finally(() => setIsRefreshing(false));
  }, []);

  // Fetch on mount and on focus
  useEffect(() => {
    fetchInvitations();
    fetchReviews();
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchInvitations();
      fetchReviews();
    }, [])
  );

  // Save location from review
  const saveLocationFromReview = async (locationId: number, event?: any) => {
    // Prevent the card's onPress from firing
    if (event) {
      event.stopPropagation();
    }
    
    try {
      setSavingLocationIds(prev => new Set(prev).add(locationId));
      console.log('💾 [Activity] Saving location from review:', locationId);

      const saveResponse = await fetch(`${API_CONFIG.BASE_URL}/map/${locationId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${sessionToken}`,
        },
      });

      if (!saveResponse.ok) {
        const errorText = await saveResponse.text();
        
        // If location is already saved, show a different message
        if (saveResponse.status === 409 || errorText.includes('duplicate') || errorText.includes('already')) {
          Alert.alert('Already Saved', 'This location is already in your saved locations');
        } else {
          throw new Error(`Failed to save location: ${errorText}`);
        }
      } else {
        // Clear the saved locations cache so the map will fetch fresh data
        clearSavedLocationsCache();
        console.log('🗑️ [Activity] Cleared saved locations cache after saving from review');
        
        // Refresh saved locations
        await refreshLocations();
        Alert.alert('Success', 'Location saved to your list!');
      }
    } catch (error) {
      console.error('💾 [Activity] Error saving location:', error);
      Alert.alert(
        'Error',
        error instanceof Error ? error.message : 'Failed to save location'
      );
    } finally {
      setSavingLocationIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(locationId);
        return newSet;
      });
    }
  };

  // Accept invitation
  const acceptInvitation = async (invitation: LocationInvitation) => {
    try {
      setAcceptingIds(prev => new Set(prev).add(invitation.id));
      console.log('🔔 [Activity] Accepting invitation:', invitation.id);
      console.log('🔔 [Activity] Location ID:', invitation.location.id);

      let saveSuccessful = false;
      let alreadySaved = false;

      // First, try to save the location
      try {
        const saveResponse = await fetch(`${API_CONFIG.BASE_URL}/map/${invitation.location.id}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${sessionToken}`,
          },
        });

        console.log('🔔 [Activity] Save location response status:', saveResponse.status);

        if (saveResponse.ok) {
          saveSuccessful = true;
          console.log('🔔 [Activity] Location saved successfully');
        } else {
          console.log('🔔 [Activity] Save location failed, attempting to read error...');
          
          let errorText = '';
          try {
            errorText = await saveResponse.text();
            console.log('🔔 [Activity] Error text:', errorText);
          } catch (textError) {
            console.error('🔔 [Activity] Could not read error text:', textError);
          }
          
          // Check if it's a duplicate/already saved error (500 often means duplicate)
          if (saveResponse.status === 409 || 
              saveResponse.status === 500 || 
              errorText.toLowerCase().includes('duplicate') || 
              errorText.toLowerCase().includes('already')) {
            console.log('🔔 [Activity] Treating as duplicate/already saved');
            alreadySaved = true;
          } else {
            console.log('🔔 [Activity] Unexpected save error, but continuing with cleanup');
          }
        }
      } catch (saveError) {
        console.error('🔔 [Activity] Exception while saving location:', saveError);
        // Continue to try deleting invitation anyway
      }
      
      console.log('🔔 [Activity] Proceeding to delete invitation...');

      // Always try to delete the invitation, regardless of save result
      try {
        const deleteResponse = await fetch(
          `${API_CONFIG.BASE_URL}/location-invitations/${invitation.id}`,
          {
            method: 'DELETE',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${sessionToken}`,
            },
          }
        );

        console.log('🔔 [Activity] Delete invitation response status:', deleteResponse.status);

        if (!deleteResponse.ok) {
          const deleteErrorText = await deleteResponse.text();
          console.error('🔔 [Activity] Delete invitation error:', deleteErrorText);
          // Don't throw - still remove from UI
        }
      } catch (deleteError) {
        console.error('🔔 [Activity] Network error while deleting invitation:', deleteError);
        // Still remove from UI
      }

      // Always remove from UI
      setInvitations(prev => prev.filter(inv => inv.id !== invitation.id));

      // Refresh locations if we successfully saved (or if already saved)
      if (saveSuccessful || alreadySaved) {
        // Clear the saved locations cache so the map will fetch fresh data
        clearSavedLocationsCache();
        console.log('🗑️ [Activity] Cleared saved locations cache after saving');
        
        try {
          await refreshLocations();
        } catch (refreshError) {
          console.error('🔔 [Activity] Error refreshing locations:', refreshError);
        }
      }

      // Show appropriate message
      if (saveSuccessful) {
        Alert.alert('Success', 'Location saved!');
      } else if (alreadySaved) {
        Alert.alert('Already Saved', 'You already have this location saved.');
      } else {
        Alert.alert('Notice', 'The invitation has been removed, but there was an issue saving the location.');
      }
      
    } catch (error) {
      console.error('🔔 [Activity] Unexpected error accepting invitation:', error);
      // Remove from UI even on error
      setInvitations(prev => prev.filter(inv => inv.id !== invitation.id));
      Alert.alert('Notice', 'The invitation has been removed.');
    } finally {
      // Always clear loading state
      setAcceptingIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(invitation.id);
        return newSet;
      });
    }
  };

  // Decline invitation
  const declineInvitation = async (invitationId: number) => {
    try {
      setDecliningIds(prev => new Set(prev).add(invitationId));
      console.log('🔔 [Activity] Declining invitation:', invitationId);

      const response = await fetch(
        `${API_CONFIG.BASE_URL}/location-invitations/${invitationId}`,
        {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${sessionToken}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error('Failed to decline invitation');
      }

      console.log('🔔 [Activity] Invitation declined');
      
      // Remove from list
      setInvitations(prev => prev.filter(inv => inv.id !== invitationId));
    } catch (error) {
      console.error('🔔 [Activity] Error declining invitation:', error);
      Alert.alert(
        'Error',
        error instanceof Error ? error.message : 'Failed to decline invitation'
      );
    } finally {
      setDecliningIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(invitationId);
        return newSet;
      });
    }
  };

  // View location details
  const viewLocation = (locationId: number, locationData?: any, topPosts?: any[]) => {
    if (locationData) {
      // Pass location data and topPosts from review to avoid showing placeholder data
      const dataToPass = {
        location: locationData,
        topPosts: topPosts || []
      };
      const encodedData = encodeURIComponent(JSON.stringify(dataToPass));
      router.push(`/_location?id=${locationId}&locationData=${encodedData}`);
    } else {
      router.push(`/_location?id=${locationId}`);
    }
  };

  // Open review detail modal
  const openReviewDetailModal = (review: FriendReview) => {
    setSelectedReview(review);
    setLikeCount(review.review.comments.length); // TODO: Get actual like count from API
    setIsLiked(false); // TODO: Check if user already liked this review
    setShowReviewDetailModal(true);
  };

  // Toggle like on review
  const toggleLike = async () => {
    if (!selectedReview || isTogglingLike) return;

    try {
      setIsTogglingLike(true);
      const method = isLiked ? 'DELETE' : 'POST';
      
      const response = await fetch(
        `${API_CONFIG.BASE_URL}/friends/reviews/${selectedReview.review.id}/like`,
        {
          method,
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${sessionToken}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error('Failed to update like');
      }

      setIsLiked(!isLiked);
      setLikeCount(prev => isLiked ? prev - 1 : prev + 1);
    } catch (error) {
      console.error('Error toggling like:', error);
      Alert.alert('Error', 'Failed to update like');
    } finally {
      setIsTogglingLike(false);
    }
  };

  // Add comment to review
  const addComment = async () => {
    if (!selectedReview || !newComment.trim() || isAddingComment) return;

    try {
      setIsAddingComment(true);
      
      const response = await fetch(
        `${API_CONFIG.BASE_URL}/friends/reviews/${selectedReview.review.id}/comments`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${sessionToken}`,
          },
          body: JSON.stringify({ comment: newComment.trim() }),
        }
      );

      if (!response.ok) {
        throw new Error('Failed to add comment');
      }

      // Refresh reviews to get the new comment
      await fetchReviews();
      
      // Update selected review with new comments
      const updatedReview = reviews.find(r => r.review.id === selectedReview.review.id);
      if (updatedReview) {
        setSelectedReview(updatedReview);
      }
      
      setNewComment('');
      Alert.alert('Success', 'Comment added!');
    } catch (error) {
      console.error('Error adding comment:', error);
      Alert.alert('Error', 'Failed to add comment');
    } finally {
      setIsAddingComment(false);
    }
  };

  // Format relative time
  const getRelativeTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  // Render star rating
  const renderStars = (rating: number) => {
    const stars = [];
    for (let i = 1; i <= 5; i++) {
      if (rating >= i) {
        stars.push(<Ionicons key={i} name="star" size={18} color="#FFD700" />);
      } else if (rating >= i - 0.5) {
        stars.push(<Ionicons key={i} name="star-half" size={18} color="#FFD700" />);
      } else {
        stars.push(<Ionicons key={i} name="star-outline" size={18} color="#FFD700" />);
      }
    }
    return <View style={{ flexDirection: 'row', gap: 2 }}>{stars}</View>;
  };

  // Combined activity feed - invitations first, then reviews
  const combinedActivityFeed = useMemo(() => {
    const invitationItems: ActivityItem[] = invitations.map(inv => ({
      type: 'invitation' as const,
      data: inv,
      timestamp: new Date(inv.createdAt).getTime(),
    }));
    
    const reviewItems: ActivityItem[] = reviews.map(rev => ({
      type: 'review' as const,
      data: rev,
      timestamp: new Date(rev.review.createdAt).getTime(),
    }));
    
    // Sort invitations by date DESC
    const sortedInvitations = invitationItems.sort((a, b) => b.timestamp - a.timestamp);
    
    // Sort reviews by date DESC
    const sortedReviews = reviewItems.sort((a, b) => b.timestamp - a.timestamp);
    
    // Return invitations first, then reviews
    return [...sortedInvitations, ...sortedReviews];
  }, [invitations, reviews]);

  // Render invitation card
  const renderInvitationCard = ({ item }: { item: LocationInvitation }) => {
    const sender = senderProfiles.get(item.creatorId);
    const isAccepting = acceptingIds.has(item.id);
    const isDeclining = decliningIds.has(item.id);

    return (
      <View style={[styles.card, { backgroundColor: theme.colors.surface }]}>
        {/* Sender Info */}
        <View style={styles.senderSection}>
          <View style={styles.senderInfo}>
            {sender?.pfpUrl ? (
              <Image source={{ uri: sender.pfpUrl }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatarPlaceholder, { backgroundColor: theme.colors.primary }]}>
                <Ionicons name="person" size={20} color={theme.colors.surface} />
              </View>
            )}
            <Text style={[styles.username, { color: theme.colors.text }]}>
              {sender?.username || 'Unknown'}
            </Text>
          </View>
          <Text style={[styles.timestamp, { color: theme.colors.textSecondary }]}>
            {getRelativeTime(item.createdAt)}
          </Text>
        </View>

        {/* Location Preview */}
        <TouchableOpacity
          style={styles.locationPreview}
          onPress={() => viewLocation(item.location.id, item.location)}
        >
          <Text style={styles.locationEmoji}>{item.location.emoji}</Text>
          <View style={styles.locationInfo}>
            <Text style={[styles.locationTitle, { color: theme.colors.text }]}>
              {item.location.title}
            </Text>
            <Text
              style={[styles.locationDescription, { color: theme.colors.textSecondary }]}
              numberOfLines={2}
            >
              {item.location.description}
            </Text>
          </View>
        </TouchableOpacity>

        {/* Message */}
        {item.message && (
          <View style={[styles.messageContainer, { backgroundColor: theme.colors.background }]}>
            <Text style={[styles.message, { color: theme.colors.text }]}>
              "{item.message}"
            </Text>
          </View>
        )}

        {/* Action Buttons */}
        <View style={styles.actionButtons}>
          <TouchableOpacity
            style={[
              styles.acceptButton,
              { backgroundColor: theme.colors.primary },
              (isAccepting || isDeclining) && { opacity: 0.6 },
            ]}
            onPress={() => acceptInvitation(item)}
            disabled={isAccepting || isDeclining}
          >
            {isAccepting ? (
              <ActivityIndicator size="small" color={theme.colors.surface} />
            ) : (
              <>
                <Ionicons name="checkmark" size={18} color={theme.colors.surface} />
                <Text style={[styles.acceptButtonText, { color: theme.colors.surface }]}>
                  Accept
                </Text>
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.declineButton,
              { 
                backgroundColor: theme.colors.background,
                borderColor: theme.colors.border,
              },
              (isAccepting || isDeclining) && { opacity: 0.6 },
            ]}
            onPress={() => declineInvitation(item.id)}
            disabled={isAccepting || isDeclining}
          >
            {isDeclining ? (
              <ActivityIndicator size="small" color={theme.colors.text} />
            ) : (
              <>
                <Ionicons name="close" size={18} color={theme.colors.text} />
                <Text style={[styles.declineButtonText, { color: theme.colors.text }]}>
                  Decline
                </Text>
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.viewButton,
              { 
                backgroundColor: theme.colors.background,
                borderColor: theme.colors.border,
              },
            ]}
            onPress={() => viewLocation(item.location.id, item.location)}
          >
            <Ionicons name="eye-outline" size={18} color={theme.colors.primary} />
            <Text style={[styles.viewButtonText, { color: theme.colors.primary }]}>
              View
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  // Render review card
  const renderReviewCard = ({ item }: { item: FriendReview }) => {
    const reviewer = reviewerProfiles.get(item.review.reviewerId);
    const commentCount = item.review.comments.length;
    
    return (
      <TouchableOpacity
        style={[styles.card, styles.reviewCard, { backgroundColor: theme.colors.surface }]}
        onPress={() => openReviewDetailModal(item)}
      >
        {/* Reviewer Info */}
        <View style={styles.senderSection}>
          <View style={styles.senderInfo}>
            {reviewer?.pfpUrl ? (
              <Image source={{ uri: reviewer.pfpUrl }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatarPlaceholder, { backgroundColor: theme.colors.primary }]}>
                <Ionicons name="person" size={20} color={theme.colors.surface} />
              </View>
            )}
            <Text style={[styles.username, { color: theme.colors.text }]}>
              {reviewer?.username || 'Unknown'}
            </Text>
          </View>
          <Text style={[styles.timestamp, { color: theme.colors.textSecondary }]}>
            {getRelativeTime(item.review.createdAt)}
          </Text>
        </View>
        
        {/* Location Preview */}
        <View style={styles.locationPreview}>
          <Text style={styles.locationEmoji}>{item.location.emoji}</Text>
          <View style={styles.locationInfo}>
            <Text style={[styles.locationTitle, { color: theme.colors.text }]}>
              {item.location.title}
            </Text>
          </View>
        </View>
        
        {/* Rating Stars */}
        <View style={styles.ratingStarsContainer}>
          {renderStars(item.review.rating)}
        </View>
        
        {/* Review Text (truncated) */}
        {item.review.review && (
          <Text
            style={[styles.reviewText, { color: theme.colors.textSecondary }]}
            numberOfLines={3}
          >
            {item.review.review}
          </Text>
        )}
        
        {/* Comment Count */}
        {commentCount > 0 && (
          <View style={styles.commentCountContainer}>
            <Ionicons name="chatbubble-outline" size={16} color={theme.colors.textSecondary} />
            <Text style={[styles.commentCount, { color: theme.colors.textSecondary }]}>
              {commentCount} {commentCount === 1 ? 'comment' : 'comments'}
            </Text>
          </View>
        )}
        
        {/* Likes Count */}
        {item.review.likes > 0 && (
          <View style={styles.likesCountContainer}>
            <Ionicons name="heart" size={16} color="#ff6b6b" />
            <Text style={[styles.likesCount, { color: theme.colors.textSecondary }]}>
              {item.review.likes} {item.review.likes === 1 ? 'like' : 'likes'}
            </Text>
          </View>
        )}
        
        {/* Save Location Button */}
        <TouchableOpacity
          style={[styles.saveLocationButton, { backgroundColor: theme.colors.primary }]}
          onPress={(e) => {
            e.stopPropagation();
            saveLocationFromReview(item.location.id);
          }}
          disabled={savingLocationIds.has(item.location.id)}
        >
          {savingLocationIds.has(item.location.id) ? (
            <ActivityIndicator size="small" color={theme.colors.surface} />
          ) : (
            <>
              <Ionicons name="bookmark" size={18} color={theme.colors.surface} />
              <Text style={[styles.saveLocationButtonText, { color: theme.colors.surface }]}>
                Save Location
              </Text>
            </>
          )}
        </TouchableOpacity>
        
        {/* Tap to view indicator */}
        <View style={styles.tapIndicator}>
          <Text style={[styles.tapText, { color: theme.colors.primary }]}>
            Tap to view details
          </Text>
          <Ionicons name="chevron-forward" size={16} color={theme.colors.primary} />
        </View>
      </TouchableOpacity>
    );
  };

  // Render activity item (invitation or review)
  const renderActivityItem = ({ item }: { item: ActivityItem }) => {
    if (item.type === 'invitation') {
      return renderInvitationCard({ item: item.data });
    } else {
      return renderReviewCard({ item: item.data });
    }
  };

  // Loading state
  if (isLoading || isLoadingReviews) {
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <View style={[styles.header, { 
          paddingTop: insets.top + 10,
          borderBottomColor: theme.colors.border,
        }]}>
          <Text style={[styles.headerTitle, { color: theme.colors.text }]}>Activity</Text>
        </View>
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text style={[styles.loadingText, { color: theme.colors.textSecondary }]}>
            Loading activity...
          </Text>
        </View>
      </View>
    );
  }

  // Error state
  if (error) {
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <View style={[styles.header, { 
          paddingTop: insets.top + 10,
          borderBottomColor: theme.colors.border,
        }]}>
          <Text style={[styles.headerTitle, { color: theme.colors.text }]}>Activity</Text>
        </View>
        <View style={styles.centerContainer}>
          <Ionicons name="alert-circle-outline" size={64} color={theme.colors.textSecondary} />
          <Text style={[styles.errorText, { color: theme.colors.text }]}>{error}</Text>
          <TouchableOpacity
            style={[styles.retryButton, { backgroundColor: theme.colors.primary }]}
            onPress={() => {
              setIsLoading(true);
              fetchInvitations();
            }}
          >
            <Text style={[styles.retryButtonText, { color: theme.colors.surface }]}>
              Try Again
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // Empty state
  if (invitations.length === 0 && reviews.length === 0) {
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <View style={[styles.header, { 
          paddingTop: insets.top + 10,
          borderBottomColor: theme.colors.border,
        }]}>
          <Text style={[styles.headerTitle, { color: theme.colors.text }]}>Activity</Text>
        </View>
        <View style={styles.centerContainer}>
          <Ionicons name="gift-outline" size={80} color={theme.colors.textSecondary} />
          <Text style={[styles.emptyTitle, { color: theme.colors.text }]}>
            No activity yet
          </Text>
          <Text style={[styles.emptySubtitle, { color: theme.colors.textSecondary }]}>
            Friends share locations and reviews with you
          </Text>
          <TouchableOpacity
            style={[styles.addFriendsButton, { backgroundColor: theme.colors.primary }]}
            onPress={() => router.push('/friends')}
          >
            <Ionicons name="person-add" size={20} color={theme.colors.surface} />
            <Text style={[styles.addFriendsButtonText, { color: theme.colors.surface }]}>
              Add Friends
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // Main content with combined feed
  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={[styles.header, { 
        paddingTop: insets.top + 10,
        borderBottomColor: theme.colors.border,
      }]}>
        <Text style={[styles.headerTitle, { color: theme.colors.text }]}>Activity</Text>
      </View>
      <FlatList
        data={combinedActivityFeed}
        renderItem={renderActivityItem}
        keyExtractor={(item) => `${item.type}-${item.type === 'invitation' ? item.data.id : item.data.review.id}`}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={onRefresh}
            tintColor={theme.colors.primary}
          />
        }
      />

      {/* Review Detail Modal */}
      {selectedReview && (
        <Modal
          visible={showReviewDetailModal}
          animationType="slide"
          presentationStyle="pageSheet"
          onRequestClose={() => setShowReviewDetailModal(false)}
        >
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={[styles.modalContainer, { backgroundColor: theme.colors.background }]}
          >
            {/* Header */}
            <View style={[styles.modalHeader, { 
              paddingTop: insets.top + 10,
              borderBottomColor: theme.colors.border,
            }]}>
              <TouchableOpacity onPress={() => setShowReviewDetailModal(false)}>
                <Ionicons name="close" size={28} color={theme.colors.text} />
              </TouchableOpacity>
              <Text style={[styles.modalHeaderTitle, { color: theme.colors.text }]}>
                Review
              </Text>
              <View style={{ width: 28 }} />
            </View>

            <ScrollView style={styles.modalScrollView}>
              {/* Reviewer Info */}
              <View style={styles.modalReviewerSection}>
                {reviewerProfiles.get(selectedReview.review.reviewerId)?.pfpUrl ? (
                  <Image 
                    source={{ uri: reviewerProfiles.get(selectedReview.review.reviewerId)?.pfpUrl }} 
                    style={styles.avatar} 
                  />
                ) : (
                  <View style={[styles.avatarPlaceholder, { backgroundColor: theme.colors.primary }]}>
                    <Ionicons name="person" size={20} color={theme.colors.surface} />
                  </View>
                )}
                <View style={{ flex: 1 }}>
                  <Text style={[styles.username, { color: theme.colors.text }]}>
                    {reviewerProfiles.get(selectedReview.review.reviewerId)?.username || 'Unknown'}
                  </Text>
                  <Text style={[styles.timestamp, { color: theme.colors.textSecondary }]}>
                    {getRelativeTime(selectedReview.review.createdAt)}
                  </Text>
                </View>
              </View>

              {/* Location Card */}
              <TouchableOpacity
                style={[styles.modalLocationSection, { backgroundColor: theme.colors.surface }]}
                onPress={() => {
                  setShowReviewDetailModal(false);
                  viewLocation(selectedReview.location.id, selectedReview.location, selectedReview.topPosts);
                }}
              >
                <Text style={styles.modalLocationEmoji}>{selectedReview.location.emoji}</Text>
                <View style={styles.modalLocationInfo}>
                  <Text style={[styles.modalLocationTitle, { color: theme.colors.text }]}>
                    {selectedReview.location.title}
                  </Text>
                  <Text style={[styles.modalLocationDescription, { color: theme.colors.textSecondary }]} numberOfLines={2}>
                    {selectedReview.location.description}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={theme.colors.textSecondary} />
              </TouchableOpacity>

              {/* Rating */}
              <View style={styles.modalRatingSection}>
                {renderStars(selectedReview.review.rating)}
              </View>

              {/* Review Text */}
              {selectedReview.review.review && (
                <View style={styles.modalReviewTextSection}>
                  <Text style={[styles.modalReviewText, { color: theme.colors.text }]}>
                    {selectedReview.review.review}
                  </Text>
                </View>
              )}

              {/* Like Section */}
              <View style={styles.modalLikeSection}>
                <TouchableOpacity
                  style={[styles.likeButton, { 
                    backgroundColor: isLiked ? theme.colors.primary + '20' : theme.colors.surface,
                    opacity: isTogglingLike ? 0.6 : 1,
                  }]}
                  onPress={toggleLike}
                  disabled={isTogglingLike}
                >
                  <Ionicons 
                    name={isLiked ? "heart" : "heart-outline"} 
                    size={24} 
                    color={isLiked ? theme.colors.primary : theme.colors.text} 
                  />
                  <Text style={[styles.likeText, { color: theme.colors.text }]}>
                    {likeCount} {likeCount === 1 ? 'like' : 'likes'}
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Comments Section */}
              <View style={styles.modalCommentsSection}>
                <Text style={[{ fontSize: 18, fontWeight: '700', marginBottom: 12, color: theme.colors.text }]}>
                  Comments
                </Text>
                {selectedReview.review.comments.length === 0 ? (
                  <Text style={[styles.noCommentsText, { color: theme.colors.textSecondary }]}>
                    No comments yet. Be the first to comment!
                  </Text>
                ) : (
                  selectedReview.review.comments.map((comment) => (
                    <View key={comment.id} style={[styles.commentCard, { backgroundColor: theme.colors.surface }]}>
                      <Text style={[styles.commentText, { color: theme.colors.text }]}>
                        {comment.comment}
                      </Text>
                      <Text style={[styles.commentTimestamp, { color: theme.colors.textSecondary }]}>
                        {getRelativeTime(comment.createdAt)}
                      </Text>
                    </View>
                  ))
                )}
              </View>
            </ScrollView>

            {/* Comment Input */}
            <View style={[styles.modalCommentInputSection, { 
              borderTopColor: theme.colors.border,
              backgroundColor: theme.colors.background,
              paddingBottom: insets.bottom + 12,
            }]}>
              <TextInput
                style={[styles.commentInput, { 
                  backgroundColor: theme.colors.surface,
                  color: theme.colors.text,
                  borderColor: theme.colors.border,
                }]}
                placeholder="Add a comment..."
                placeholderTextColor={theme.colors.textSecondary}
                value={newComment}
                onChangeText={setNewComment}
                multiline
              />
              <TouchableOpacity
                style={[styles.sendCommentButton, { 
                  backgroundColor: theme.colors.primary,
                  opacity: (!newComment.trim() || isAddingComment) ? 0.5 : 1,
                }]}
                onPress={addComment}
                disabled={!newComment.trim() || isAddingComment}
              >
                {isAddingComment ? (
                  <ActivityIndicator size="small" color={theme.colors.surface} />
                ) : (
                  <Ionicons name="send" size={20} color={theme.colors.surface} />
                )}
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        </Modal>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 15,
    borderBottomWidth: 1,
  },
  headerTitle: {
    fontSize: 32,
    fontWeight: 'bold',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
  },
  errorText: {
    marginTop: 10,
    marginBottom: 20,
    fontSize: 16,
    textAlign: 'center',
  },
  retryButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginTop: 20,
  },
  emptySubtitle: {
    fontSize: 16,
    marginTop: 8,
    marginBottom: 30,
    textAlign: 'center',
  },
  addFriendsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  addFriendsButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  listContent: {
    padding: 16,
  },
  card: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  senderSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  senderInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  avatarPlaceholder: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  username: {
    fontSize: 16,
    fontWeight: '600',
  },
  timestamp: {
    fontSize: 13,
  },
  locationPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  locationEmoji: {
    fontSize: 32,
  },
  locationInfo: {
    flex: 1,
  },
  locationTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 4,
  },
  locationDescription: {
    fontSize: 14,
    lineHeight: 20,
  },
  messageContainer: {
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  message: {
    fontSize: 15,
    fontStyle: 'italic',
    lineHeight: 20,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  acceptButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 8,
  },
  acceptButtonText: {
    fontSize: 15,
    fontWeight: '600',
  },
  declineButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
  },
  declineButtonText: {
    fontSize: 15,
    fontWeight: '600',
  },
  viewButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
  },
  viewButtonText: {
    fontSize: 15,
    fontWeight: '600',
  },
  // Review card styles
  reviewCard: {
    borderLeftWidth: 3,
    borderLeftColor: '#FFD700',
  },
  ratingStarsContainer: {
    marginBottom: 10,
  },
  reviewText: {
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 10,
  },
  commentCountContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  commentCount: {
    fontSize: 14,
  },
  likesCountContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  likesCount: {
    fontSize: 14,
  },
  saveLocationButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    marginTop: 12,
    marginBottom: 8,
  },
  saveLocationButtonText: {
    fontSize: 15,
    fontWeight: '600',
  },
  tapIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 4,
    marginTop: 4,
  },
  tapText: {
    fontSize: 13,
    fontWeight: '600',
  },
  // Review Detail Modal Styles
  modalContainer: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 15,
    borderBottomWidth: 1,
  },
  modalHeaderTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  modalScrollView: {
    flex: 1,
  },
  modalReviewerSection: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    gap: 12,
  },
  modalLocationSection: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 12,
    gap: 12,
  },
  modalLocationEmoji: {
    fontSize: 36,
  },
  modalLocationInfo: {
    flex: 1,
  },
  modalLocationTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 4,
  },
  modalLocationDescription: {
    fontSize: 14,
  },
  modalRatingSection: {
    padding: 20,
    alignItems: 'center',
  },
  modalReviewTextSection: {
    padding: 20,
    paddingTop: 0,
  },
  modalReviewText: {
    fontSize: 16,
    lineHeight: 24,
  },
  modalLikeSection: {
    padding: 20,
    paddingTop: 10,
  },
  likeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  likeText: {
    fontSize: 16,
    fontWeight: '600',
  },
  modalCommentsSection: {
    padding: 20,
    paddingTop: 10,
  },
  commentCard: {
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  commentText: {
    fontSize: 15,
    lineHeight: 20,
    marginBottom: 4,
  },
  commentTimestamp: {
    fontSize: 12,
  },
  noCommentsText: {
    fontSize: 15,
    textAlign: 'center',
    padding: 20,
    fontStyle: 'italic',
  },
  modalCommentInputSection: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: 12,
    gap: 8,
    borderTopWidth: 1,
  },
  commentInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    maxHeight: 100,
    fontSize: 15,
  },
  sendCommentButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
});


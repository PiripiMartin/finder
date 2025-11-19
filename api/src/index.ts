import { createPost, deletePost } from "./posts/routes";
import { getGuestRecommendations, getPostsForLocation, getSavedAndRecommendedLocations, getSavedLocations, deleteLocationForUser, getSavedLocationsOld, addLocation, createLocationReview } from "./map/routes";
import { login, validateSessionToken, signup, getProfileData, deleteUserAccount, editUserLocation, updateProfilePicture, getNotifications, markNotificationsSeen, initiatePasswordReset } from "./user/routes";
import { addFriend, createLocationInvitation, getFriends, getLocationInvitations, deleteLocationInvitation, getFriendsReviews, commentOnFriendReview, likeFriendReview, unlikeFriendReview, removeFriend } from "./friends/routes";
import { 
    addLocationToFolderEndpoint, 
    removeLocationFromFolderEndpoint, 
    followFolderEndpoint, 
    unfollowFolderEndpoint,
    getOwnedFolders,
    getFollowedFoldersEndpoint,
    getFolderLocations,
    createFolderEndpoint,
    editFolderEndpoint,
    deleteFolderEndpoint,
    joinFolderAsOwnerEndpoint,
    leaveFolderAsOwnerEndpoint
} from "./folders/routes";
import { checkAdminAccess, getDashboard, getLogin, refresh, toggleRefreshStatus } from "./utils";
import { startSessionCleanupTask } from "./background-tasks";
import { completePasswordReset } from "./email/routes";
import { getSignupsPerDay, getPostsPerDay, getPopularLocations, getErrorStats } from "./dashboard/routes";
import { withErrorTracking } from "./error-tracker";

// Start background tasks
startSessionCleanupTask();

/**
 * The main Bun server.
 * This server handles all API routes for the application.
 */
Bun.serve({
    port: 8000,
    routes: {
        // Account management
        "/api/login": { POST: withErrorTracking("POST /api/login", login) },
        "/api/signup": { POST: withErrorTracking("POST /api/signup", signup) },
        "/api/validate-token": { GET: withErrorTracking("GET /api/validate-token", validateSessionToken) },
        "/api/profile": { GET: withErrorTracking("GET /api/profile", getProfileData) },
        "/api/profile/pfp": { POST: withErrorTracking("POST /api/profile/pfp", updateProfilePicture) },
        "/api/delete-account": { DELETE: withErrorTracking("DELETE /api/delete-account", deleteUserAccount) },
        "/api/password-reset": { POST: withErrorTracking("POST /api/password-reset", initiatePasswordReset) },
        "/api/password-reset/complete": { POST: withErrorTracking("POST /api/password-reset/complete", completePasswordReset) },

        // Notifications
        "/api/notifications": { GET: withErrorTracking("GET /api/notifications", getNotifications) },
        "/api/notifications/seen": { POST: withErrorTracking("POST /api/notifications/seen", markNotificationsSeen) },
        
        // Friends
        "/api/friends": { POST: withErrorTracking("POST /api/friends", addFriend), GET: withErrorTracking("GET /api/friends", getFriends) },
        "/api/friends/:id": { DELETE: withErrorTracking("DELETE /api/friends/:id", removeFriend) },
        "/api/friends/reviews": { GET: withErrorTracking("GET /api/friends/reviews", getFriendsReviews) },
        "/api/friends/reviews/:id/comments": { POST: withErrorTracking("POST /api/friends/reviews/:id/comments", commentOnFriendReview) },
        "/api/friends/reviews/:id/like": { POST: withErrorTracking("POST /api/friends/reviews/:id/like", likeFriendReview), DELETE: withErrorTracking("DELETE /api/friends/reviews/:id/like", unlikeFriendReview) },
        "/api/location-invitation": { POST: withErrorTracking("POST /api/location-invitation", createLocationInvitation) },
        "/api/location-invitations": { GET: withErrorTracking("GET /api/location-invitations", getLocationInvitations) },
        "/api/location-invitations/:id": { DELETE: withErrorTracking("DELETE /api/location-invitations/:id", deleteLocationInvitation) },

        // Map data
        "/api/map/saved-and-recommended": { GET: withErrorTracking("GET /api/map/saved-and-recommended", getSavedAndRecommendedLocations) },
        "/api/map/guest-posts": { GET: withErrorTracking("GET /api/map/guest-posts", getGuestRecommendations) },
        "/api/map/saved-new": { GET: withErrorTracking("GET /api/map/saved-new", getSavedLocations) },
        "/api/map/saved": { GET: withErrorTracking("GET /api/map/saved", getSavedLocationsOld) },
        "/api/map/:id/posts": { GET: withErrorTracking("GET /api/map/:id/posts", getPostsForLocation) },
        "/api/map/:id": { POST: withErrorTracking("POST /api/map/:id", addLocation), DELETE: withErrorTracking("DELETE /api/map/:id", deleteLocationForUser) },
        "/api/map/edit/:id": { POST: withErrorTracking("POST /api/map/edit/:id", editUserLocation) },
        "/api/location-review": { POST: withErrorTracking("POST /api/location-review", createLocationReview) },

        // Post management
        "/api/post": { POST: withErrorTracking("POST /api/post", createPost) },
        "/api/post/:id": { DELETE: withErrorTracking("DELETE /api/post/:id", deletePost) },

        // Folder management
        "/api/folders": { POST: withErrorTracking("POST /api/folders", createFolderEndpoint) },
        "/api/folders/:folderId": { PATCH: withErrorTracking("PATCH /api/folders/:folderId", editFolderEndpoint), DELETE: withErrorTracking("DELETE /api/folders/:folderId", deleteFolderEndpoint) },
        "/api/folders/owned": { GET: withErrorTracking("GET /api/folders/owned", getOwnedFolders) },
        "/api/folders/followed": { GET: withErrorTracking("GET /api/folders/followed", getFollowedFoldersEndpoint) },
        "/api/folders/:folderId/locations": { 
            GET: withErrorTracking("GET /api/folders/:folderId/locations", getFolderLocations),
            POST: withErrorTracking("POST /api/folders/:folderId/locations", addLocationToFolderEndpoint) 
        },
        "/api/folders/:folderId/locations/:mapPointId": { DELETE: withErrorTracking("DELETE /api/folders/:folderId/locations/:mapPointId", removeLocationFromFolderEndpoint) },
        "/api/folders/:folderId/follow": { POST: withErrorTracking("POST /api/folders/:folderId/follow", followFolderEndpoint) },
        "/api/folders/:folderId/unfollow": { DELETE: withErrorTracking("DELETE /api/folders/:folderId/unfollow", unfollowFolderEndpoint) },
        "/api/folders/:folderId/join-as-owner": { POST: withErrorTracking("POST /api/folders/:folderId/join-as-owner", joinFolderAsOwnerEndpoint) },
        "/api/folders/:folderId/leave-as-owner": { POST: withErrorTracking("POST /api/folders/:folderId/leave-as-owner", leaveFolderAsOwnerEndpoint) },

        // Miscellaneous
        "/api/refresh": { GET: withErrorTracking("GET /api/refresh", refresh) },
        "/api/toggle-refresh": { POST: withErrorTracking("POST /api/toggle-refresh", toggleRefreshStatus) },
        "/api/admin/check": { GET: withErrorTracking("GET /api/admin/check", checkAdminAccess) },
        "/internal-dashboard": { GET: getDashboard },
        "/internal-dashboard/login": { GET: getLogin },

        // Dashboard data
        "/api/dashboard/signups-per-day": { GET: withErrorTracking("GET /api/dashboard/signups-per-day", getSignupsPerDay) },
        "/api/dashboard/posts-per-day": { GET: withErrorTracking("GET /api/dashboard/posts-per-day", getPostsPerDay) },
        "/api/dashboard/popular-locations": { GET: withErrorTracking("GET /api/dashboard/popular-locations", getPopularLocations) },
        "/api/dashboard/error-stats": { GET: withErrorTracking("GET /api/dashboard/error-stats", getErrorStats) }
    }
});

console.log("Server is running on port 8000");

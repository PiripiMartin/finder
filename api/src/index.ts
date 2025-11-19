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
import { getSignupsPerDay, getPostsPerDay, getPopularLocations } from "./dashboard/routes";

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
        "/api/login": { POST: login },
        "/api/signup": { POST: signup },
        "/api/validate-token": { GET: validateSessionToken },
        "/api/profile": { GET: getProfileData },
        "/api/profile/pfp": { POST: updateProfilePicture },
        "/api/delete-account": { DELETE: deleteUserAccount },
        "/api/password-reset": { POST: initiatePasswordReset },
        "/api/password-reset/complete": { POST: completePasswordReset },

        // Notifications
        "/api/notifications": { GET: getNotifications },
        "/api/notifications/seen": { POST: markNotificationsSeen },
        
        // Friends
        "/api/friends": { POST: addFriend, GET: getFriends },
        "/api/friends/:id": { DELETE: removeFriend },
        "/api/friends/reviews": { GET: getFriendsReviews },
        "/api/friends/reviews/:id/comments": { POST: commentOnFriendReview },
        "/api/friends/reviews/:id/like": { POST: likeFriendReview, DELETE: unlikeFriendReview },
        "/api/location-invitation": { POST: createLocationInvitation },
        "/api/location-invitations": { GET: getLocationInvitations },
        "/api/location-invitations/:id": { DELETE: deleteLocationInvitation },

        // Map data
        "/api/map/saved-and-recommended": { GET: getSavedAndRecommendedLocations },
        "/api/map/guest-posts": { GET: getGuestRecommendations },
        "/api/map/saved-new": { GET: getSavedLocations },
        "/api/map/saved": { GET: getSavedLocationsOld },
        "/api/map/:id/posts": { GET: getPostsForLocation },
        "/api/map/:id": { POST: addLocation, DELETE: deleteLocationForUser },
        "/api/map/edit/:id": { POST: editUserLocation },
        "/api/location-review": { POST: createLocationReview },

        // Post management
        "/api/post": { POST: createPost },
        "/api/post/:id": { DELETE: deletePost },

        // Folder management
        "/api/folders": { POST: createFolderEndpoint },
        "/api/folders/:folderId": { PATCH: editFolderEndpoint, DELETE: deleteFolderEndpoint },
        "/api/folders/owned": { GET: getOwnedFolders },
        "/api/folders/followed": { GET: getFollowedFoldersEndpoint },
        "/api/folders/:folderId/locations": { 
            GET: getFolderLocations,
            POST: addLocationToFolderEndpoint 
        },
        "/api/folders/:folderId/locations/:mapPointId": { DELETE: removeLocationFromFolderEndpoint },
        "/api/folders/:folderId/follow": { POST: followFolderEndpoint },
        "/api/folders/:folderId/unfollow": { DELETE: unfollowFolderEndpoint },
        "/api/folders/:folderId/join-as-owner": { POST: joinFolderAsOwnerEndpoint },
        "/api/folders/:folderId/leave-as-owner": { POST: leaveFolderAsOwnerEndpoint },

        // Miscellaneous
        "/api/refresh": { GET: refresh },
        "/api/toggle-refresh": { POST: toggleRefreshStatus },
        "/api/admin/check": { GET: checkAdminAccess },
        "/internal-dashboard": { GET: getDashboard },
        "/internal-dashboard/login": { GET: getLogin },

        // Dashboard data
        "/api/dashboard/signups-per-day": { GET: getSignupsPerDay },
        "/api/dashboard/posts-per-day": { GET: getPostsPerDay },
        "/api/dashboard/popular-locations": { GET: getPopularLocations }
    }
});

console.log("Server is running on port 8000");

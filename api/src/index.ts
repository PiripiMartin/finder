import { createPost, deletePost } from "./posts/routes";
import { getGuestRecommendations, getPostsForLocation, getSavedAndRecommendedLocations, getSavedLocations, deleteLocationForUser, getSavedLocationsOld, addLocation } from "./map/routes";
import { login, validateSessionToken, signup, getProfileData, deleteUserAccount, editUserLocation } from "./user/routes";
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
import { refresh, toggleRefreshStatus } from "./utils";
import { startSessionCleanupTask } from "./background-tasks";

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
        "/api/delete-account": { DELETE: deleteUserAccount },

        // Map data
        "/api/map/saved-and-recommended": { GET: getSavedAndRecommendedLocations },
        "/api/map/guest-posts": { GET: getGuestRecommendations },
        "/api/map/saved-new": { GET: getSavedLocations },
        "/api/map/saved": { GET: getSavedLocationsOld },
        "/api/map/:id/posts": { GET: getPostsForLocation },
        "/api/map/:id": { POST: addLocation, DELETE: deleteLocationForUser },
        "/api/map/edit/:id": { POST: editUserLocation },

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
    }
});

console.log("Server is running on port 8000");

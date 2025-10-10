import { createPost, deletePost } from "./posts/routes";
import { getGuestRecommendations, getPostsForLocation, getSavedAndRecommendedLocations, getSavedLocations } from "./map/routes";
import { login, validateSessionToken, signup, getProfileData, deleteUserAccount } from "./user/routes";
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
        "/api/map/saved": { GET: getSavedLocations },
        "/api/map/:id/posts": { GET: getPostsForLocation },

        // Post management
        "/api/post": { POST: createPost },
        "/api/post/:id": { DELETE: deletePost },

        // Miscellaneous
        "/api/refresh": { GET: refresh },
        "/api/toggle-refresh": { POST: toggleRefreshStatus },
    }
});

console.log("Server is running on port 8000");
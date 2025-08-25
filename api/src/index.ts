import { createPost } from "./posts/routes";
import { blockLocation, getGuestRecommendations, getPostsForLocation, getSavedAndRecommendedLocations, getSavedLocations } from "./map/routes";
import { login, validateSessionToken, signup, getProfileData, deleteUserAccount } from "./user/routes";


Bun.serve({
    port: 8000,
    routes: {
        // Account management routes
        "/api/login": {POST: login},
        "/api/signup": {POST: signup},
        "/api/validate-token": {GET: validateSessionToken},
        "/api/profile": {GET: getProfileData},
        "/api/delete-account": {DELETE: deleteUserAccount},

        // Map routes
        "/api/map/saved-and-recommended": {GET: getSavedAndRecommendedLocations},
        "/api/map/guest-posts": {GET: getGuestRecommendations},
        "/api/map/saved": {GET: getSavedLocations},
        "/api/map/:id/posts": {GET: getPostsForLocation},
        "/api/map/:id/block": {POST: blockLocation},

        // Post management routes
        "/api/post": {POST: createPost},
    }
});




import { db } from "./database";
import { getPostsForLocation, getSavedAndRecommendedLocations } from "./map/routes";
import { login, validateSessionToken, signup } from "./user/routes";


Bun.serve({
    port: 8000,
    routes: {
        // Account management routes
        "/api/login": {POST: login},
        "/api/signup": {POST: signup},
        "/api/validate-token": {GET: validateSessionToken},

        // Map routes
        "/api/map/saved-and-recommended": {GET: getSavedAndRecommendedLocations},
        "/api/map/:id/posts": {GET: getPostsForLocation}

    }
});




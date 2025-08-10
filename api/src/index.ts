import { db } from "./database";
import { getLocationPosts } from "./map/routes";
import { login, validateSessionToken, signup } from "./user/routes";


Bun.serve({
    port: 8000,
    routes: {
        // Account management routes
        "/api/login":          {POST: login},
        "/api/signup":         {POST: signup},
        "/api/validate-token": {GET: validateSessionToken},

        // Post management routes
        "/api/map/:id/posts":  {GET: getLocationPosts}
    }
});




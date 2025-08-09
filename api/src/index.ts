import { db } from "./database";
import { getPosts } from "./map/routes";
import { login, validateSessionToken } from "./user/routes";


Bun.serve({
    port: 8000,
    routes: {
        "/api/login":          {POST: login},
        "/api/validate-token": {GET: validateSessionToken},
        "/api/map/:id/posts":  {GET: getPosts}
    }
});




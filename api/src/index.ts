import { db } from "./database";
import { login, validateSessionToken } from "./user/routes";


Bun.serve({
    port: 8000,
    routes: {
        "/api/login": {
            POST: login
        },
        "/api/validate-token": {
            POST: validateSessionToken
        }
    }
});




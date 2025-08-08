import { db } from "./database";
import { login } from "./user/routes";


Bun.serve({
    port: 8000,
    routes: {
        "/api/login": {
            POST: login
        },
    }
});




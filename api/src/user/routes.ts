import type { BunRequest } from "bun";
import { db, toCamelCase } from "../database";
import type { User } from "./types";
import { generateSessionToken, verifySessionToken } from "./session";
import type { Post } from "../posts/types";
import type { MapPoint } from "../map/types";
import { getSavedLocationsWithTopPost, getRecommendedLocationsWithTopPost, type LocationAndPost } from "../map/queries";
import { checkedExtractBody } from "../utils";



interface LoginRequest {
    // General login information
    username: string,
    password: string,

    // Information for fetching initial data
    coordinates: {
        latitude: number,
        longitude: number
    }
};

interface SignupRequest {
    username: string,
    password: string,
    email: string
};

interface ProfileStats {
    username: string,
    email: string,
    createdAt: Date
};


export async function signup(req: BunRequest): Promise<Response> {

    const data = await checkedExtractBody(req, ["username", "password", "email"]);
    if (!data) {
        return new Response("Malformed body", {status: 400});
    }

    const signupRequest = data as SignupRequest;

    // Check if the username or email is already taken
    const [duplicateCheckRows, _1] = await db.execute(
        "SELECT COUNT(*) as count FROM users WHERE username = ? OR email = ?", 
        [signupRequest.username, signupRequest.email]
    ) as [any[], any];

    if (duplicateCheckRows[0].count > 0) {
        return new Response("Username or email already taken", {status: 400});
    }

    // Hash the password
    const passwordHash = await Bun.password.hash(signupRequest.password, "argon2id");

    // Create the account
    await db.execute(
        "INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)", 
        [signupRequest.username, signupRequest.email, passwordHash]
    );

    const [accountFetchRows, _2] = await db.execute(
        "SELECT LAST_INSERT_ID() as id"
    ) as [any[], any];
    const accountId = accountFetchRows[0].id;

    // Generate session token
    const sessionToken = await generateSessionToken(accountId);

    return new Response(
        JSON.stringify({sessionToken: sessionToken}),
        {status: 200, headers: {'Content-Type': 'application/json'}}
    );
}



export async function login(req: BunRequest): Promise<Response> {

    if (!req.body) {
        return new Response("Missing request body", {status: 400});
    }

    const loginRequest = await checkedExtractBody(req, ["username", "password", "coordinates"]) as LoginRequest | null;
    if (!loginRequest) {
        return new Response("Malformed body", {status: 400});
    }


    // Fetch the corresponding account
    const [rows, _] = await db.execute(
        "SELECT * FROM users WHERE username = ?", 
        [loginRequest.username]
    ) as [any[], any];

    const results: User[] = toCamelCase(rows);

    if (results.length == 0) {
        return new Response("Couldn't find an account with that name.", {status: 404});
    }

    // Can safely make this typecast now
    const account = results[0] as User;
    

    // Compare hashes
    const validCredentials = await Bun.password.verify(loginRequest.password, account.passwordHash || "", "argon2id");
    if (!validCredentials) {
        return new Response("Invalid credentials", {status: 401});
    }

    // Generate session token
    const sessionToken = await generateSessionToken(account.id);
    

    return new Response(JSON.stringify({sessionToken: sessionToken}), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
    });
}

/**
 * Standalone endpoint for checking if the user has a valid session token.
 * The primary use case for this is for preventing the user from accessing a page
 * that requires being logged in (e.g. map page), you can just call this endpoint 
 * and redirect away if they're not authenticated.
 */
export async function validateSessionToken(req: BunRequest): Promise<Response> {

    const sessionToken = req.headers.get("Authorization")?.split(" ")[1];
    if (!sessionToken) {
        return new Response("Missing session token", {status: 401});
    }
    const maybeUserId = await verifySessionToken(sessionToken);

    // Return user id if valid, null otherwise
    return new Response(maybeUserId?.toString() || null, {status: maybeUserId != null ? 200 : 401});
}


export async function getProfileData(req: BunRequest): Promise<Response> {

    const sessionToken = req.headers.get("Authorization")?.split(" ")[1];
    if (!sessionToken) {
        return new Response("Missing session token", {status: 401});
    }
    const maybeUserId = await verifySessionToken(sessionToken);

    if (!maybeUserId) {
        return new Response("Invalid session token", {status: 401});
    }

    /* 
    Currently this is the only 'profile data' we have. In the future we could
    potentially incorporate:
    - Profle picture
    - Post counts
    - Other 'fun stats' ??
    */
    const [rows, _] = await db.execute(`
        SELECT 
            username,
            email,
            created_at
        FROM users WHERE id = ?;`,
        [maybeUserId]
    ) as [any[], []];

    const results: ProfileStats = toCamelCase(rows);

    return new Response(
        JSON.stringify(results),
        {headers: {"Content-Type": "application/json"}}
    );
}






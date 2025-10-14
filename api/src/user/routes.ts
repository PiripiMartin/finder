import type { BunRequest } from "bun";
import { db, toCamelCase } from "../database";
import type { User } from "./types";
import { generateSessionToken, verifySessionToken } from "./session";
import { checkedExtractBody } from "../utils";
import { createUserLocationEdit, updateUserLocationEdit } from "./queries";
import { getGooglePlaceDetails, searchGooglePlaces } from "../posts/get-location";
import type { LocationEdit } from "../map/types";

/**
 * Represents the request body for a user login.
 */
interface LoginRequest {
    username: string;
    password: string;
}

/**
 * Represents the request body for a user signup.
 */
interface SignupRequest {
    username: string;
    password: string;
    email: string;
}

/**
 * Represents the statistics for a user profile.
 */
interface ProfileStats {
    username: string;
    email: string;
    createdAt: Date;
}

/**
 * Handles user signup.
 *
 * @param req - The Bun request, containing the signup credentials.
 * @returns A response with a new session token or an error message.
 */
export async function signup(req: BunRequest): Promise<Response> {
    const data = await checkedExtractBody(req, ["username", "password", "email"]);
    if (!data) {
        return new Response("Malformed request body", { status: 400 });
    }

    const { username, password, email } = data as SignupRequest;

    const [duplicateCheck] = await db.execute("SELECT COUNT(*) as count FROM users WHERE username = ? OR email = ?", [username, email]) as [any[], any];
    if (duplicateCheck[0].count > 0) {
        return new Response("Username or email is already taken", { status: 409 });
    }

    const passwordHash = await Bun.password.hash(password, "argon2id");

    await db.execute("INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)", [username, email, passwordHash]);

    const [accountRows] = await db.execute("SELECT LAST_INSERT_ID() as id") as [any[], any];
    const accountId = accountRows[0].id;

    const sessionToken = await generateSessionToken(accountId);

    return new Response(JSON.stringify({ sessionToken }), { status: 201, headers: { "Content-Type": "application/json" } });
}

/**
 * Handles user login.
 *
 * @param req - The Bun request, containing the login credentials.
 * @returns A response with a session token or an error message.
 */
export async function login(req: BunRequest): Promise<Response> {
    const data = await checkedExtractBody(req, ["username", "password"]);
    if (!data) {
        return new Response("Malformed request body", { status: 400 });
    }

    const { username, password } = data as LoginRequest;

    const [rows] = await db.execute("SELECT * FROM users WHERE username = ?", [username]) as [any[], any];
    const user = toCamelCase(rows[0]) as User | undefined;

    if (!user) {
        return new Response("Invalid username or password", { status: 401 });
    }

    const validCredentials = await Bun.password.verify(password, user.passwordHash || "");
    if (!validCredentials) {
        return new Response("Invalid username or password", { status: 401 });
    }

    const sessionToken = await generateSessionToken(user.id);

    return new Response(JSON.stringify({ sessionToken }), { status: 200, headers: { "Content-Type": "application/json" } });
}

/**
 * Validates a session token.
 *
 * @param req - The Bun request, containing the session token.
 * @returns A response with the user ID if the token is valid, or an error message.
 */
export async function validateSessionToken(req: BunRequest): Promise<Response> {
    const sessionToken = req.headers.get("Authorization")?.split(" ")[1];
    if (!sessionToken) {
        return new Response("Missing session token", { status: 401 });
    }

    const userId = await verifySessionToken(sessionToken);
    if (userId === null) {
        return new Response("Invalid or expired session token", { status: 401 });
    }

    return new Response(JSON.stringify({ userId }), { status: 200, headers: { "Content-Type": "application/json" } });
}

/**
 * Fetches the profile data for the authenticated user.
 *
 * @param req - The Bun request, containing the session token.
 * @returns A response with the user's profile data or an error message.
 */
export async function getProfileData(req: BunRequest): Promise<Response> {
    const sessionToken = req.headers.get("Authorization")?.split(" ")[1];

    if (!sessionToken) {
        return new Response("Missing session token", { status: 401 });
    }

    const userId = await verifySessionToken(sessionToken);
    if (userId === null) {
        return new Response("Invalid or expired session token", { status: 401 });
    }

    const [rows] = await db.execute("SELECT username, email, created_at FROM users WHERE id = ?", [userId]) as [any[], any];
    const profileData = toCamelCase(rows) as Array<ProfileStats>;


    return new Response(JSON.stringify(profileData), { status: 200, headers: { "Content-Type": "application/json" } });
}

/**
 * Deletes the authenticated user's account.
 *
 * @param req - The Bun request, containing the session token.
 * @returns A response indicating success or failure.
 */
export async function deleteUserAccount(req: BunRequest): Promise<Response> {
    const sessionToken = req.headers.get("Authorization")?.split(" ")[1];
    if (!sessionToken) {
        return new Response("Missing session token", { status: 401 });
    }

    const userId = await verifySessionToken(sessionToken);
    if (userId === null) {
        return new Response("Invalid or expired session token", { status: 401 });
    }

    await db.execute("DELETE FROM users WHERE id = ?", [userId]);

    const [verifyRows] = await db.execute("SELECT COUNT(*) as count FROM users WHERE id = ?", [userId]) as [any[], any];
    const deleted = (verifyRows[0]?.count ?? 1) === 0;

    return new Response(JSON.stringify({ deleted }), { status: deleted ? 200 : 500, headers: { "Content-Type": "application/json" } });
}

export async function editUserLocation(req: BunRequest): Promise<Response> {
    const sessionToken = req.headers.get("Authorization")?.split(" ")[1];
    if (!sessionToken) {
        return new Response("Missing session token", { status: 401 });
    }

    const userId = await verifySessionToken(sessionToken);
    if (userId === null) {
        return new Response("Invalid or expired session token", { status: 401 });
    }

    const mapPointId = parseInt((req.params as any).id);
    if (isNaN(mapPointId)) {
        return new Response("Invalid map point ID", { status: 400 });
    }

    const edits = await req.json() as Partial<LocationEdit>;

    if (edits.address) {
        const searchResult = await searchGooglePlaces(edits.address);
        if (searchResult && searchResult.places.length > 0) {
            const placeId = searchResult.places[0]!.id;
            edits.googlePlaceId = placeId;

            const placeDetails = await getGooglePlaceDetails(placeId);
            if (placeDetails) {
                edits.latitude = placeDetails.location.latitude;
                edits.longitude = placeDetails.location.longitude;
            }
        }
    }

    const [existingEdit] = await db.execute("SELECT * FROM user_location_edits WHERE user_id = ? AND map_point_id = ?", [userId, mapPointId]) as [any[], any];

    if (existingEdit.length > 0) {
        await updateUserLocationEdit(userId, mapPointId, edits);
    } else {
        await createUserLocationEdit(userId, mapPointId, edits);
    }

    return new Response(JSON.stringify({ success: true }), { status: 200, headers: { "Content-Type": "application/json" } });
}

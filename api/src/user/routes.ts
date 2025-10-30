import type { BunRequest } from "bun";
import { db, toCamelCase } from "../database";
import type { User } from "./types";
import { generateSessionToken, verifySessionToken } from "./session";
import { checkedExtractBody } from "../utils";
import { createUserLocationEdit, updateUserLocationEdit } from "./queries";
import { getGooglePlaceDetails, searchGooglePlaces } from "../posts/get-location";
import type { LocationEdit } from "../map/types";
import { s3, write as bunWrite } from "bun";

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

    const [rows] = await db.execute("SELECT username, email, pfp_url, created_at FROM users WHERE id = ?", [userId]) as [any[], any];
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

                if (placeDetails.websiteUri) edits.websiteUrl = placeDetails.websiteUri;
                if (placeDetails.nationalPhoneNumber) edits.phoneNumber = placeDetails.nationalPhoneNumber;
                if (placeDetails.formattedAddress) edits.address = placeDetails.formattedAddress;
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

/**
 * Updates the authenticated user's profile picture.
 * Expects the request body to contain raw image bytes with a valid image Content-Type.
 */
export async function updateProfilePicture(req: BunRequest): Promise<Response> {
    const sessionToken = req.headers.get("Authorization")?.split(" ")[1];
    if (!sessionToken) {
        return new Response("Missing session token", { status: 401 });
    }

    const userId = await verifySessionToken(sessionToken);
    if (userId === null) {
        return new Response("Invalid or expired session token", { status: 401 });
    }

    const contentType = req.headers.get("Content-Type") || "";
    if (!contentType.startsWith("image/")) {
        return new Response("Unsupported content type", { status: 415 });
    }

    const body = await req.arrayBuffer();
    const maxBytes = 5 * 1024 * 1024; // 5MB
    if (body.byteLength === 0 || body.byteLength > maxBytes) {
        return new Response("Invalid image size", { status: 400 });
    }

    const ext = (() => {
        if (contentType === "image/jpeg" || contentType === "image/jpg") return "jpg";
        if (contentType === "image/png") return "png";
        if (contentType === "image/webp") return "webp";
        return "bin";
    })();

    const bucket = process.env.S3_BUCKET;
    const region = process.env.S3_REGION;
    if (!bucket || !region) {
        return new Response("Server misconfigured", { status: 500 });
    }

    // Remember old URL for cleanup
    const [oldRows] = await db.execute("SELECT pfp_url FROM users WHERE id = ?", [userId]) as [any[], any];
    const oldUrl: string | null = oldRows?.[0]?.pfp_url ?? null;

    const key = `avatars/${userId}/${crypto.randomUUID()}.${ext}`;
    const fileRef = s3.file(key);
    await bunWrite(fileRef, new Uint8Array(body));

    const assetBase = process.env.ASSET_BASE_URL || `https://${bucket}.s3.${region}.amazonaws.com`;
    const pfpUrl = `${assetBase}/${key}`;

    await db.execute("UPDATE users SET pfp_url = ? WHERE id = ?", [pfpUrl, userId]);

    // Best-effort delete of previous avatar to save storage
    if (oldUrl) {
        try {
            const prefixB = `https://${bucket}.s3.${region}.amazonaws.com/`;
            if (oldUrl.startsWith(prefixB)) {
                await s3.file(oldUrl.slice(prefixB.length)).delete();
            }
        } catch (_) {
            // ignore cleanup errors
        }
    }

    return new Response(JSON.stringify({ pfpUrl }), { status: 200, headers: { "Content-Type": "application/json" } });
}

/**
 * Adds a friend relationship between the authenticated user and another user.
 * Expects JSON body: { friendUserId: number }
 */
export async function addFriend(req: BunRequest): Promise<Response> {
    const sessionToken = req.headers.get("Authorization")?.split(" ")[1];
    if (!sessionToken) {
        return new Response("Missing session token", { status: 401 });
    }

    const userId = await verifySessionToken(sessionToken);
    if (userId === null) {
        return new Response("Invalid or expired session token", { status: 401 });
    }

    const data = await checkedExtractBody(req, ["friendUserId"]);
    if (!data) {
        return new Response("Malformed request body", { status: 400 });
    }

    const friendUserId = Number((data as any).friendUserId);
    if (!Number.isInteger(friendUserId) || friendUserId <= 0) {
        return new Response("Invalid friend user id", { status: 400 });
    }

    if (friendUserId === userId) {
        return new Response("Cannot add yourself as a friend", { status: 400 });
    }

    // Verify target user exists
    const [userRows] = await db.execute("SELECT id FROM users WHERE id = ?", [friendUserId]) as [any[], any];
    if ((userRows as any[]).length === 0) {
        return new Response("User not found", { status: 404 });
    }

    // Normalize ordering so friendship is undirected and unique
    const userId1 = Math.min(userId, friendUserId);
    const userId2 = Math.max(userId, friendUserId);

    // Check if friendship already exists in either direction
    const [existingRows] = await db.execute(
        "SELECT COUNT(*) as count FROM friends WHERE (user_id_1 = ? AND user_id_2 = ?)",
        [userId1, userId2]
    ) as [any[], any];

    if (existingRows[0]?.count > 0) {
        return new Response(JSON.stringify({ added: false, message: "Already friends" }), { status: 200, headers: { "Content-Type": "application/json" } });
    }

    await db.execute(
        "INSERT INTO friends (user_id_1, user_id_2) VALUES (?, ?)",
        [userId1, userId2]
    );

    return new Response(JSON.stringify({ added: true }), { status: 201, headers: { "Content-Type": "application/json" } });
}

/**
 * Returns a list of the authenticated user's friends (bidirectional).
 * Returns: [{ id, username, email, pfp_url, created_at }]
 */
export async function getFriends(req: BunRequest): Promise<Response> {
    const sessionToken = req.headers.get("Authorization")?.split(" ")[1];
    if (!sessionToken) {
        return new Response("Missing session token", { status: 401 });
    }

    const userId = await verifySessionToken(sessionToken);
    if (userId === null) {
        return new Response("Invalid or expired session token", { status: 401 });
    }

    // Select friends in either direction
    const query = `
        SELECT u.id, u.username, u.email, u.pfp_url, u.created_at
        FROM friends f
        JOIN users u ON (u.id = IF(f.user_id_1 = ?, f.user_id_2, f.user_id_1))
        WHERE ? IN (f.user_id_1, f.user_id_2)
    `;
    const [rows] = await db.execute(query, [userId, userId]) as [any[], any];
    const friends = toCamelCase(rows as any[]);

    return new Response(JSON.stringify(friends), {
        status: 200,
        headers: { "Content-Type": "application/json" }
    });
}

import type { BunRequest } from "bun";
import { db, toCamelCase } from "../database";
import type { User } from "./types";
import { generateSessionToken, verifySessionToken } from "./session";
import { checkedExtractBody } from "../utils";
import { createUserLocationEdit, updateUserLocationEdit } from "./queries";
import { getGooglePlaceDetails, searchGooglePlaces } from "../posts/get-location";
import type { LocationEdit } from "../map/types";
import { s3, write as bunWrite } from "bun";
import { createAuthChallenge, deleteAuthChallenge } from "../email/queries";
import { sendPasswordResetEmail } from "../email/utils";

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
 * Represents the request body for initiating a password reset.
 */
interface InitiatePasswordResetRequest {
    username?: string;
    email?: string;
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
 * GET endpoint to retrieve unseen notifications for the authenticated user.
 * 
 * @param req - The incoming Bun request.
 * @returns A response with unseen notifications or an error status.
 */
export async function getNotifications(req: BunRequest): Promise<Response> {
    const sessionToken = req.headers.get("Authorization")?.split(" ")[1];
    if (!sessionToken) {
        return new Response("Missing session token", { status: 401 });
    }

    const userId = await verifySessionToken(sessionToken);
    if (userId === null) {
        return new Response("Invalid or expired session token", { status: 401 });
    }

    // Get all unseen notifications for this user using LEFT JOIN
    // Only include notifications created after the user's account was created
    const [results] = await db.execute(`
        SELECT n.*
        FROM notifications n
        LEFT JOIN notifications_seen s 
            ON s.notification_id = n.id 
            AND s.user_id = ?
        JOIN users u
            ON u.id = ?
        WHERE s.notification_id IS NULL
          AND n.created_at >= u.created_at
        ORDER BY n.created_at DESC
    `, [userId, userId]) as [any[], any];

    return new Response(JSON.stringify(results), {
        status: 200,
        headers: { "Content-Type": "application/json" }
    });
}

/**
 * POST endpoint to mark notifications as seen for the authenticated user.
 * 
 * @param req - The incoming Bun request with notification IDs in the body.
 * @returns A response indicating success or failure.
 */
export async function markNotificationsSeen(req: BunRequest): Promise<Response> {
    const sessionToken = req.headers.get("Authorization")?.split(" ")[1];
    if (!sessionToken) {
        return new Response("Missing session token", { status: 401 });
    }

    const userId = await verifySessionToken(sessionToken);
    if (userId === null) {
        return new Response("Invalid or expired session token", { status: 401 });
    }

    const body = await req.json() as { notificationIds?: unknown };
    const notificationIds = body.notificationIds;

    if (!Array.isArray(notificationIds) || notificationIds.length === 0) {
        return new Response("Invalid request: notificationIds must be a non-empty array", { 
            status: 400 
        });
    }

    // Validate all IDs are numbers
    if (!notificationIds.every(id => typeof id === "number")) {
        return new Response("Invalid request: all notificationIds must be numbers", { 
            status: 400 
        });
    }

    // Build multi-value INSERT query
    const values = notificationIds.map(notificationId => [userId, notificationId]);
    const placeholders = values.map(() => "(?, ?)").join(", ");
    const flatValues = values.flat();

    await db.execute(`
        INSERT IGNORE INTO notifications_seen (user_id, notification_id)
        VALUES ${placeholders}
    `, flatValues);

    return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" }
    });
}

/**
 * Handles password reset initiation.
 * Generates a 6-digit code, stores it in the database, and emails it to the user.
 * For security, returns success even if the account doesn't exist (to avoid revealing account existence).
 * However, if the account exists and email sending fails, returns an error to inform the user.
 *
 * @param req - The Bun request, containing the username or email.
 * @returns A response indicating success or an error if email sending fails.
 */
export async function initiatePasswordReset(req: BunRequest): Promise<Response> {
    // Note: We don't use checkedExtractBody here because username/email are optional (either one is required)
    let data: InitiatePasswordResetRequest;
    try {
        data = await req.json() as InitiatePasswordResetRequest;
    } catch {
        return new Response("Malformed request body", { status: 400 });
    }
    
    // Must provide either username or email
    if (!data || (!data.username && !data.email)) {
        return new Response("Must provide either username or email", { status: 400 });
    }

    // Find the user by username or email
    let user: User | null = null;
    if (data.username) {
        const [rows] = await db.execute("SELECT * FROM users WHERE username = ?", [data.username]) as [any[], any];
        if (rows.length > 0) {
            user = toCamelCase(rows[0]) as User;
        }
    } else if (data.email) {
        const [rows] = await db.execute("SELECT * FROM users WHERE email = ?", [data.email]) as [any[], any];
        if (rows.length > 0) {
            user = toCamelCase(rows[0]) as User;
        }
    }

    // If user exists, generate code and send email
    if (user) {
        // Generate a 6-digit numeric code
        const challengeCode = Math.floor(100000 + Math.random() * 900000).toString();

        // Set expiration to 15 minutes from now
        const expiresAt = new Date();
        expiresAt.setMinutes(expiresAt.getMinutes() + 15);

        // Create the challenge in the database
        const challenge = await createAuthChallenge(user.id, challengeCode, expiresAt);

        // Send email via Resend
        try {
            await sendPasswordResetEmail(user.email, challengeCode);
        } catch (error) {
            // If email fails to send, delete the challenge and return an error to the user
            // The email sending failure is already logged in sendPasswordResetEmail
            await deleteAuthChallenge(challenge.id);
            return new Response(JSON.stringify({ 
                success: false, 
                error: "Failed to send password reset email. Please try again later." 
            }), {
                status: 500,
                headers: { "Content-Type": "application/json" }
            });
        }
    }

    // Always return success for security (don't reveal if account exists)
    // Only return error if user exists and email fails (handled above)
    return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" }
    });
}


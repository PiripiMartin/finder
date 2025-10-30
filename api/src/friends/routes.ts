import { verifySessionToken } from "../user/session";
import { checkedExtractBody } from "../utils";
import type { BunRequest } from "bun";
import { toCamelCase, db } from "../database";

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

/**
 * Creates a shared location invitation for another user.
 * Expects JSON body: { recipientUserId: number, mapPointId: number, message: string }
 * Requires authentication.
 */
export async function createLocationInvitation(req: BunRequest): Promise<Response> {
    const sessionToken = req.headers.get("Authorization")?.split(" ")[1];
    if (!sessionToken) {
        return new Response("Missing session token", { status: 401 });
    }

    const creatorId = await verifySessionToken(sessionToken);
    if (creatorId === null) {
        return new Response("Invalid or expired session token", { status: 401 });
    }

    const data = await checkedExtractBody(req, ["recipientUserId", "mapPointId", "message"]);
    if (!data) {
        return new Response("Malformed request body", { status: 400 });
    }
    const recipientId = Number((data as any).recipientUserId);
    const mapPointId = Number((data as any).mapPointId);
    const message = (data as any).message;

    if (!Number.isInteger(recipientId) || recipientId <= 0) {
        return new Response("Invalid recipient user id", { status: 400 });
    }
    if (!Number.isInteger(mapPointId) || mapPointId <= 0) {
        return new Response("Invalid map point id", { status: 400 });
    }
    if (typeof message !== "string") {
        return new Response("Message is required and must be a non-empty string", { status: 400 });
    }
    if (recipientId === creatorId) {
        return new Response("Cannot invite yourself", { status: 400 });
    }

    // Verify recipient exists
    const [userRows] = await db.execute("SELECT id FROM users WHERE id = ?", [recipientId]) as [any[], any];
    if ((userRows as any[]).length === 0) {
        return new Response("Recipient user not found", { status: 404 });
    }
    // Verify map point exists
    const [mapRows] = await db.execute("SELECT id FROM map_points WHERE id = ?", [mapPointId]) as [any[], any];
    if ((mapRows as any[]).length === 0) {
        return new Response("Map point not found", { status: 404 });
    }

    // Create the invitation
    await db.execute(
        `INSERT INTO location_invitations (creator_id, recipient_id, map_point_id, message) VALUES (?, ?, ?, ?)`,
        [creatorId, recipientId, mapPointId, message]
    );
    const [idRows] = await db.execute("SELECT LAST_INSERT_ID() as id") as [any[], any];
    const invitationId = idRows[0].id;

    // Fetch created invitation for response
    const [inviteRows] = await db.execute(
        `SELECT * FROM location_invitations WHERE id = ?`,
        [invitationId]
    ) as [any[], any];
    if (!inviteRows || inviteRows.length === 0) {
        return new Response("Failed to fetch created invitation", { status: 500 });
    }

    return new Response(
        JSON.stringify(inviteRows[0]),
        { status: 201, headers: { "Content-Type": "application/json" } }
    );
}
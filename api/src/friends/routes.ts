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
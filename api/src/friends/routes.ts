import { verifySessionToken } from "../user/session";
import { checkedExtractBody } from "../utils";
import type { BunRequest } from "bun";
import { toCamelCase, db } from "../database";
import { fetchUserLocationEdits } from "../map/queries";
import type { MapPoint } from "../map/types";
import { createUserLocationEdit } from "../user/queries";

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

    // Check if creator has a location edit for this map point and duplicate it for recipient
    const [creatorEditRows] = await db.execute(
        `SELECT 
            google_place_id,
            title,
            description,
            emoji,
            ST_X(location) as longitude,
            ST_Y(location) as latitude,
            website_url,
            phone_number,
            address
        FROM user_location_edits
        WHERE user_id = ? AND map_point_id = ?`,
        [creatorId, mapPointId]
    ) as [any[], any];

    // Check if recipient already has an edit (don't overwrite if they do)
    const [recipientEditRows] = await db.execute(
        `SELECT user_id FROM user_location_edits WHERE user_id = ? AND map_point_id = ?`,
        [recipientId, mapPointId]
    ) as [any[], any];

    // If creator has an edit and recipient doesn't, duplicate it
    if (creatorEditRows.length > 0 && recipientEditRows.length === 0) {
        const creatorEdit = toCamelCase([creatorEditRows[0]])[0] as any;
        
        await createUserLocationEdit(recipientId, mapPointId, {
            googlePlaceId: creatorEdit.googlePlaceId ?? null,
            title: creatorEdit.title ?? null,
            description: creatorEdit.description ?? null,
            emoji: creatorEdit.emoji ?? null,
            latitude: creatorEdit.latitude ?? null,
            longitude: creatorEdit.longitude ?? null,
            websiteUrl: creatorEdit.websiteUrl ?? null,
            phoneNumber: creatorEdit.phoneNumber ?? null,
            address: creatorEdit.address ?? null
        });
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

/**
 * Returns a list of location invitations for the authenticated user (as recipient).
 * Returns: [{ id, creatorId, recipientId, location, message, createdAt }]
 * where location is a MapPoint object replacing map_point_id.
 */
export async function getLocationInvitations(req: BunRequest): Promise<Response> {
    const sessionToken = req.headers.get("Authorization")?.split(" ")[1];
    if (!sessionToken) {
        return new Response("Missing session token", { status: 401 });
    }

    const userId = await verifySessionToken(sessionToken);
    if (userId === null) {
        return new Response("Invalid or expired session token", { status: 401 });
    }

    // Query location invitations with location data
    const query = `
        SELECT 
            li.id,
            li.creator_id,
            li.recipient_id,
            li.map_point_id,
            li.message,
            li.created_at,
            mp.google_place_id,
            mp.title,
            mp.description,
            mp.emoji,
            mp.website_url,
            mp.phone_number,
            mp.address,
            mp.created_at as mp_created_at,
            mp.is_valid_location,
            mp.recommendable,
            ST_X(mp.location) as longitude,
            ST_Y(mp.location) as latitude
        FROM location_invitations li
        INNER JOIN map_points mp ON li.map_point_id = mp.id
        WHERE li.recipient_id = ?
        ORDER BY li.created_at DESC
    `;

    const [rows] = await db.execute(query, [userId]) as [any[], any];
    const results = toCamelCase(rows) as any[];

    // Fetch user location edits to apply customizations
    const userEdits = await fetchUserLocationEdits(userId);
    const editsMap = new Map(userEdits.map(edit => [edit.mapPointId, edit]));

    // Format the response with location object replacing map_point_id
    const invitations = results.map(row => {
        const location: MapPoint = {
            id: row.mapPointId,
            googlePlaceId: row.googlePlaceId,
            title: row.title,
            description: row.description,
            emoji: row.emoji,
            latitude: row.latitude,
            longitude: row.longitude,
            recommendable: row.recommendable,
            isValidLocation: row.isValidLocation,
            websiteUrl: row.websiteUrl,
            phoneNumber: row.phoneNumber,
            address: row.address,
            createdAt: row.mpCreatedAt
        };

        // Apply user location edits if they exist
        const edit = editsMap.get(row.mapPointId);
        if (edit) {
            const addressUpdated = edit.googlePlaceId != null && edit.googlePlaceId !== location.googlePlaceId;
            
            location.title = edit.title ?? location.title;
            location.description = edit.description ?? location.description;
            location.emoji = edit.emoji ?? location.emoji;
            location.websiteUrl = edit.websiteUrl ?? location.websiteUrl;
            location.phoneNumber = edit.phoneNumber ?? location.phoneNumber;
            location.address = edit.address ?? location.address;
            location.googlePlaceId = edit.googlePlaceId ?? location.googlePlaceId;
            location.latitude = edit.latitude ?? location.latitude;
            location.longitude = edit.longitude ?? location.longitude;

            if (addressUpdated) {
                // If the location changed in Google Maps but the new website/phone number 
                // wasn't found, make sure we're not just reporting the old website/phone.
                location.websiteUrl = edit.websiteUrl ?? "";
                location.phoneNumber = edit.phoneNumber ?? "";
            }
        }

        return {
            id: row.id,
            creatorId: row.creatorId,
            recipientId: row.recipientId,
            location: location,
            message: row.message,
            createdAt: row.createdAt
        };
    });

    return new Response(JSON.stringify(invitations), {
        status: 200,
        headers: { "Content-Type": "application/json" }
    });
}
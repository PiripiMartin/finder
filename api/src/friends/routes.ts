import { verifySessionToken } from "../user/session";
import { checkedExtractBody } from "../utils";
import type { BunRequest } from "bun";
import { toCamelCase, db } from "../database";
import { fetchUserLocationEdits, fetchPostsForLocation, fetchUserLocationEditsForUsersAndMapPoints } from "../map/queries";
import type { MapPoint } from "../map/types";
import { createUserLocationEdit } from "../user/queries";

/**
 * Adds a friend relationship between the authenticated user and another user.
 * Expects JSON body: { username: string }
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

    const data = await checkedExtractBody(req, ["username"]);
    if (!data) {
        return new Response("Malformed request body", { status: 400 });
    }

    const username = String((data as any).username ?? "").trim();
    if (username.length === 0) {
        return new Response("Username is required and must be a non-empty string", { status: 400 });
    }

    // Verify target user exists and get their ID
    const [userRows] = await db.execute("SELECT id FROM users WHERE username = ?", [username]) as [any[], any];
    if ((userRows as any[]).length === 0) {
        return new Response("User not found", { status: 404 });
    }

    const friendUserId = userRows[0].id;
    if (friendUserId === userId) {
        return new Response("Cannot add yourself as a friend", { status: 400 });
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

/**
 * Deletes a location invitation (used by recipient to decline).
 * Expects invitation ID in URL path: /api/location-invitations/:id
 * Requires authentication and verifies the user is the recipient.
 */
export async function deleteLocationInvitation(req: BunRequest): Promise<Response> {
    const sessionToken = req.headers.get("Authorization")?.split(" ")[1];
    if (!sessionToken) {
        return new Response("Missing session token", { status: 401 });
    }

    const userId = await verifySessionToken(sessionToken);
    if (userId === null) {
        return new Response("Invalid or expired session token", { status: 401 });
    }

    // Validate invitation ID from path params
    const invitationId = parseInt((req.params as any).id, 10);
    if (!invitationId || Number.isNaN(invitationId)) {
        return new Response("Invalid invitation id", { status: 400 });
    }

    // Fetch the invitation to verify it exists and check ownership
    const [inviteRows] = await db.execute(
        "SELECT recipient_id FROM location_invitations WHERE id = ?",
        [invitationId]
    ) as [any[], any];

    if (inviteRows.length === 0) {
        return new Response("Invitation not found", { status: 404 });
    }

    const recipientId = inviteRows[0].recipient_id as number;
    if (recipientId !== userId) {
        return new Response("Forbidden: Only the recipient can delete an invitation", { status: 403 });
    }

    // Delete the invitation
    await db.execute("DELETE FROM location_invitations WHERE id = ?", [invitationId]);

    return new Response(
        JSON.stringify({ success: true }),
        { status: 200, headers: { "Content-Type": "application/json" } }
    );
}

/**
 * Number of top videos to include per location in friends' reviews.
 */
const TOP_VIDEOS_PER_LOCATION = 10;

/**
 * Returns reviews created by the authenticated user's friends.
 * Each review includes the full location object and the top N videos for that location.
 * GET /api/friends/reviews
 */
export async function getFriendsReviews(req: BunRequest): Promise<Response> {
    const sessionToken = req.headers.get("Authorization")?.split(" ")[1];
    if (!sessionToken) {
        return new Response("Missing session token", { status: 401 });
    }

    const userId = await verifySessionToken(sessionToken);
    if (userId === null) {
        return new Response("Invalid or expired session token", { status: 401 });
    }

    try {
        // Get friend ids (bidirectional friendship)
        const [friendRows] = await db.execute(
            `SELECT IF(f.user_id_1 = ?, f.user_id_2, f.user_id_1) AS friend_id
             FROM friends f
             WHERE ? IN (f.user_id_1, f.user_id_2)`,
            [userId, userId]
        ) as [any[], any];

        const friendIds: number[] = (friendRows as any[]).map(r => r.friend_id).filter((id: any) => Number.isInteger(id));
        if (friendIds.length === 0) {
            return new Response(JSON.stringify([]), { status: 200, headers: { "Content-Type": "application/json" } });
        }

        // Build placeholders for IN clause
        const placeholders = friendIds.map(() => "?").join(", ");

        // Fetch friends' reviews joined with location data
        const query = `
            SELECT 
                lr.id as review_id,
                lr.user_id as reviewer_id,
                lr.map_point_id,
                lr.rating,
                lr.review,
                lr.created_at as review_created_at,
                mp.id as location_id,
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
            FROM location_reviews lr
            INNER JOIN map_points mp ON mp.id = lr.map_point_id
            WHERE lr.user_id IN (${placeholders})
            ORDER BY lr.created_at DESC
        `;

        const [rows] = await db.execute(query, friendIds) as [any[], any];
        const results = toCamelCase(rows) as any[];

        // Precompute top posts per location id to avoid repeated queries where possible
        const uniqueLocationIds = Array.from(new Set(results.map(r => r.mapPointId as number)));

        const topPostsByLocation = new Map<number, any[]>();
        for (const locId of uniqueLocationIds) {
            try {
                const posts = await fetchPostsForLocation(locId);
                topPostsByLocation.set(locId, posts.slice(0, TOP_VIDEOS_PER_LOCATION));
            } catch (e) {
                topPostsByLocation.set(locId, []);
            }
        }

        // Fetch relevant edits: viewer's own edits first, then reviewer's edits as fallback
        const viewerEdits = await fetchUserLocationEdits(userId);
        const viewerEditsByMapPoint = new Map<number, any>(viewerEdits.map(e => [e.mapPointId, e]));

        const reviewerIds = Array.from(new Set(results.map(r => r.reviewerId as number)));
        const reviewerEdits = await fetchUserLocationEditsForUsersAndMapPoints(reviewerIds, uniqueLocationIds);

        // Map reviewer edits by composite key reviewerId:mapPointId, keeping the most recent
        const reviewerEditsMap = new Map<string, any>();
        for (const edit of reviewerEdits) {
            const key = `${edit.userId}:${edit.mapPointId}`;
            const existing = reviewerEditsMap.get(key);
            if (!existing || new Date(edit.lastUpdated).getTime() > new Date(existing.lastUpdated).getTime()) {
                reviewerEditsMap.set(key, edit);
            }
        }

        // Fetch comments for all reviews
        const reviewIds = Array.from(new Set(results.map(r => r.reviewId as number)));
        const commentsByReviewId = new Map<number, any[]>();
        if (reviewIds.length > 0) {
            const placeholdersComments = reviewIds.map(() => "?").join(", ");
            const [commentRows] = await db.execute(
                `SELECT 
                    id,
                    review_id,
                    commenter_id,
                    comment,
                    created_at
                 FROM location_review_comments
                 WHERE review_id IN (${placeholdersComments})
                 ORDER BY created_at ASC`,
                reviewIds
            ) as [any[], any];
            const comments = toCamelCase(commentRows) as any[];
            for (const c of comments) {
                const list = commentsByReviewId.get(c.reviewId) ?? [];
                list.push(c);
                commentsByReviewId.set(c.reviewId, list);
            }
        }

        // Format payload with applied edits and comments
        const payload = results.map(row => {
            const baseLocation: MapPoint = {
                id: row.locationId,
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

            // Apply viewer edit first; if none, fall back to reviewer's edit
            const viewerEdit = viewerEditsByMapPoint.get(row.mapPointId);
            const reviewerEdit = reviewerEditsMap.get(`${row.reviewerId}:${row.mapPointId}`);
            const edit = viewerEdit ?? reviewerEdit ?? null;

            const location: MapPoint = { ...baseLocation } as any;
            if (edit) {
                const addressUpdated = edit.googlePlaceId != null && edit.googlePlaceId !== baseLocation.googlePlaceId;
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
                    location.websiteUrl = edit.websiteUrl ?? "";
                    location.phoneNumber = edit.phoneNumber ?? "";
                }
            }

            return {
                review: {
                    id: row.reviewId,
                    reviewerId: row.reviewerId,
                    rating: row.rating,
                    review: row.review,
                    createdAt: row.reviewCreatedAt,
                    comments: commentsByReviewId.get(row.reviewId) ?? []
                },
                location,
                topPosts: topPostsByLocation.get(row.mapPointId) ?? []
            };
        });

        return new Response(JSON.stringify(payload), { status: 200, headers: { "Content-Type": "application/json" } });
    } catch (error) {
        console.error("Error fetching friends' reviews:", error);
        return new Response("Internal server error", { status: 500 });
    }
}

/**
 * Creates a comment on a friend's review.
 * Path: POST /api/friends/reviews/:id/comments
 * Body: { comment: string }
 */
export async function commentOnFriendReview(req: BunRequest): Promise<Response> {
    const sessionToken = req.headers.get("Authorization")?.split(" ")[1];
    if (!sessionToken) {
        return new Response("Missing session token", { status: 401 });
    }

    const userId = await verifySessionToken(sessionToken);
    if (userId === null) {
        return new Response("Invalid or expired session token", { status: 401 });
    }

    const reviewId = parseInt((req.params as any).id, 10);
    if (!reviewId || Number.isNaN(reviewId)) {
        return new Response("Invalid review id", { status: 400 });
    }

    const data = await checkedExtractBody(req, ["comment"]);
    if (!data) {
        return new Response("Malformed request body", { status: 400 });
    }
    const commentText = String((data as any).comment ?? "").trim();
    if (commentText.length === 0) {
        return new Response("Comment cannot be empty", { status: 400 });
    }

    // Fetch the review and its owner
    const [reviewRows] = await db.execute(
        "SELECT id, user_id FROM location_reviews WHERE id = ?",
        [reviewId]
    ) as [any[], any];
    if (reviewRows.length === 0) {
        return new Response("Review not found", { status: 404 });
    }
    const reviewerId = reviewRows[0].user_id as number;
    if (reviewerId === userId) {
        // Allow commenting on own review as well (optional behavior)
    }

    // Validate friend relationship (bidirectional)
    const [friendRows] = await db.execute(
        `SELECT COUNT(*) as cnt
         FROM friends
         WHERE (user_id_1 = ? AND user_id_2 = ?) OR (user_id_1 = ? AND user_id_2 = ?)`,
        [userId, reviewerId, reviewerId, userId]
    ) as [any[], any];
    const isFriend = (friendRows[0]?.cnt ?? 0) > 0;
    if (!isFriend && reviewerId !== userId) {
        return new Response("Forbidden: can only comment on friends' reviews", { status: 403 });
    }

    // Insert the comment
    await db.execute(
        "INSERT INTO location_review_comments (review_id, commenter_id, comment) VALUES (?, ?, ?)",
        [reviewId, userId, commentText]
    );

    const [idRows] = await db.execute("SELECT LAST_INSERT_ID() as id") as [any[], any];
    const commentId = idRows[0].id as number;

    // Fetch created comment for response
    const [commentRows] = await db.execute(
        `SELECT 
            id,
            review_id,
            commenter_id,
            comment,
            created_at
         FROM location_review_comments
         WHERE id = ?`,
        [commentId]
    ) as [any[], any];

    const created = toCamelCase(commentRows[0]) as any;
    return new Response(JSON.stringify(created), { status: 201, headers: { "Content-Type": "application/json" } });
}

/**
 * Likes a friend's review.
 * Path: POST /api/friends/reviews/:id/like
 */
export async function likeFriendReview(req: BunRequest): Promise<Response> {
    const sessionToken = req.headers.get("Authorization")?.split(" ")[1];
    if (!sessionToken) {
        return new Response("Missing session token", { status: 401 });
    }

    const userId = await verifySessionToken(sessionToken);
    if (userId === null) {
        return new Response("Invalid or expired session token", { status: 401 });
    }

    const reviewId = parseInt((req.params as any).id, 10);
    if (!reviewId || Number.isNaN(reviewId)) {
        return new Response("Invalid review id", { status: 400 });
    }

    // Fetch the review and its owner
    const [reviewRows] = await db.execute(
        "SELECT id, user_id, like_count FROM location_reviews WHERE id = ?",
        [reviewId]
    ) as [any[], any];
    if (reviewRows.length === 0) {
        return new Response("Review not found", { status: 404 });
    }
    const reviewerId = reviewRows[0].user_id as number;

    // Validate friend relationship (allow self-like)
    if (reviewerId !== userId) {
        const [friendRows] = await db.execute(
            `SELECT COUNT(*) as cnt
             FROM friends
             WHERE (user_id_1 = ? AND user_id_2 = ?) OR (user_id_1 = ? AND user_id_2 = ?)`,
            [userId, reviewerId, reviewerId, userId]
        ) as [any[], any];
        const isFriend = (friendRows[0]?.cnt ?? 0) > 0;
        if (!isFriend) {
            return new Response("Forbidden: can only like friends' reviews", { status: 403 });
        }
    }

    // Insert like if not already liked (idempotent)
    try {
        const [res] = await db.execute(
            "INSERT INTO location_review_likes (review_id, user_id) VALUES (?, ?)",
            [reviewId, userId]
        ) as [any, any];
        // Only increment if insert happened
        if (res.affectedRows && res.affectedRows > 0) {
            await db.execute(
                "UPDATE location_reviews SET like_count = like_count + 1 WHERE id = ?",
                [reviewId]
            );
        }
    } catch (e: any) {
        // Duplicate like: ignore and proceed
    }

    // Return updated like count
    const [countRows] = await db.execute(
        "SELECT like_count FROM location_reviews WHERE id = ?",
        [reviewId]
    ) as [any[], any];
    const likeCount = countRows[0]?.like_count ?? 0;

    return new Response(
        JSON.stringify({ liked: true, likeCount }),
        { status: 200, headers: { "Content-Type": "application/json" } }
    );
}

/**
 * Unlikes a friend's review.
 * Path: DELETE /api/friends/reviews/:id/like
 */
export async function unlikeFriendReview(req: BunRequest): Promise<Response> {
    const sessionToken = req.headers.get("Authorization")?.split(" ")[1];
    if (!sessionToken) {
        return new Response("Missing session token", { status: 401 });
    }

    const userId = await verifySessionToken(sessionToken);
    if (userId === null) {
        return new Response("Invalid or expired session token", { status: 401 });
    }

    const reviewId = parseInt((req.params as any).id, 10);
    if (!reviewId || Number.isNaN(reviewId)) {
        return new Response("Invalid review id", { status: 400 });
    }

    // Fetch the review and its owner
    const [reviewRows] = await db.execute(
        "SELECT id, user_id, like_count FROM location_reviews WHERE id = ?",
        [reviewId]
    ) as [any[], any];
    if (reviewRows.length === 0) {
        return new Response("Review not found", { status: 404 });
    }
    const reviewerId = reviewRows[0].user_id as number;

    // Validate friend relationship (allow self-unlike)
    if (reviewerId !== userId) {
        const [friendRows] = await db.execute(
            `SELECT COUNT(*) as cnt
             FROM friends
             WHERE (user_id_1 = ? AND user_id_2 = ?) OR (user_id_1 = ? AND user_id_2 = ?)`,
            [userId, reviewerId, reviewerId, userId]
        ) as [any[], any];
        const isFriend = (friendRows[0]?.cnt ?? 0) > 0;
        if (!isFriend) {
            return new Response("Forbidden: can only unlike friends' reviews", { status: 403 });
        }
    }

    // Delete like if exists
    const [res] = await db.execute(
        "DELETE FROM location_review_likes WHERE review_id = ? AND user_id = ?",
        [reviewId, userId]
    ) as [any, any];
    // Only decrement if deletion happened
    if (res.affectedRows && res.affectedRows > 0) {
        await db.execute(
            "UPDATE location_reviews SET like_count = CASE WHEN like_count > 0 THEN like_count - 1 ELSE 0 END WHERE id = ?",
            [reviewId]
        );
    }

    // Return updated like count
    const [countRows] = await db.execute(
        "SELECT like_count FROM location_reviews WHERE id = ?",
        [reviewId]
    ) as [any[], any];
    const likeCount = countRows[0]?.like_count ?? 0;

    return new Response(
        JSON.stringify({ liked: false, likeCount }),
        { status: 200, headers: { "Content-Type": "application/json" } }
    );
}
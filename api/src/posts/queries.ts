import { db, toCamelCase } from "../database";
import { generateLocationDetails } from "../posts/get-location";
import type { MapPoint } from "../map/types";
import type { TikTokEmbedResponse, InstagramPostInformation, Post } from "./types";

/**
 * Represents an attempt to save a post.
 */
export interface PostSaveAttempt {
    id: number;
    requestId: string | null;
    url: string | null;
    sessionToken: string | null;
    userId: number | null;
    createdAt: Date;
}

/**
 * The input for creating a post save attempt.
 */
export interface CreatePostSaveAttemptInput {
    requestId?: string | null;
    url?: string | null;
    sessionToken?: string | null;
    userId?: number | null;
}

/**
 * The request to create a new post.
 */
export interface CreatePostRequest {
    url: string;
    postedBy: number;
    mapPointId: number;
    postType: string | null;
}

/**
 * The request to create a new location.
 */
export interface CreateLocationRequest {
    googlePlaceId: string | null;
    title: string;
    description: string | null;
    emoji: string;
    latitude: number;
    longitude: number;
    isValidLocation: boolean;
    recommendable: boolean;
    websiteUrl: string | null;
    phoneNumber: string | null;
    address: string | null;
}

/**
 * Creates a record of a post save attempt.
 *
 * @param input - The details of the post save attempt.
 * @returns A promise that resolves to the created post save attempt record.
 */
export async function createPostSaveAttempt(input: CreatePostSaveAttemptInput): Promise<PostSaveAttempt> {
    const query = `
        INSERT INTO post_save_attempts (request_id, url, session_token, user_id)
        VALUES (?, ?, ?, ?)
    `;
    await db.execute(query, [input.requestId || null, input.url || null, input.sessionToken || null, input.userId ?? null]);

    const [idRows] = await db.execute("SELECT LAST_INSERT_ID() as id") as [any[], any];
    const attemptId = idRows[0].id;

    const [rows] = await db.execute("SELECT * FROM post_save_attempts WHERE id = ?", [attemptId]) as [any[], any];
    return toCamelCase(rows[0]) as PostSaveAttempt;
}

/**
 * Creates a new location in the database.
 *
 * @param location - The details of the location to create.
 * @returns A promise that resolves to the newly created map point, or null on failure.
 */
export async function createLocation(location: CreateLocationRequest): Promise<MapPoint | null> {
    const query = `
        INSERT INTO map_points (google_place_id, title, description, emoji, location, is_valid_location, recommendable, website_url, phone_number, address)
        VALUES (?, ?, ?, ?, POINT(?, ?), ?, ?, ?, ?, ?)
    `;
    await db.execute(query, [
        location.googlePlaceId || null,
        location.title || null,
        location.description || null,
        location.emoji || null,
        location.longitude || null,
        location.latitude || null,
        location.isValidLocation || null,
        location.recommendable || false,
        location.websiteUrl || null,
        location.phoneNumber || null,
        location.address || null,
    ]);

    const [idRows] = await db.execute("SELECT LAST_INSERT_ID() as id") as [any[], any];
    const locationId = idRows[0].id;

    const [locations] = await db.execute("SELECT * FROM map_points WHERE id = ?", [locationId]) as [any[], any];
    if (locations.length === 0) {
        return null;
    }

    return toCamelCase(locations[0]) as MapPoint;
}

/**
 * Creates a new post in the database.
 *
 * @param post - The details of the post to create.
 * @returns A promise that resolves to the newly created post, or null on failure.
 */
export async function createPost(post: CreatePostRequest): Promise<Post | null> {
    const query = `
        INSERT INTO posts (url, posted_by, map_point_id, post_type)
        VALUES (?, ?, ?, ?)
    `;
    await db.execute(query, [post.url, post.postedBy, post.mapPointId, post.postType]);

    const [idRows] = await db.execute("SELECT LAST_INSERT_ID() as id") as [any[], any];
    const postId = idRows[0].id;

    const [posts] = await db.execute("SELECT * FROM posts WHERE id = ?", [postId]) as [any[], any];
    if (posts.length === 0) {
        return null;
    }

    return toCamelCase(posts[0]) as Post;
}

/**
 * Creates a new invalid location in the database.
 *
 * @param embedInfo - The embed information for the TikTok video.
 * @returns A promise that resolves to the newly created map point, or null on failure.
 */
export async function createInvalidLocation(embedInfo: TikTokEmbedResponse | InstagramPostInformation): Promise<MapPoint | null> {
    const locationDetails = await generateLocationDetails(embedInfo);
    if (!locationDetails) {
        return null;
    }

    const { title, description, emoji } = locationDetails;

    return await createLocation({
        googlePlaceId: null,
        title: title,
        description: description,
        emoji: emoji,
        latitude: 0,
        longitude: 0,
        isValidLocation: false,
        recommendable: false,
        websiteUrl: null,
        phoneNumber: null,
        address: null,
    });
}

/**
 * Adds a location to a user's saved locations.
 * This function is idempotent - it won't create duplicates if the record already exists.
 *
 * @param userId - The ID of the user.
 * @param mapPointId - The ID of the map point to save.
 * @returns A promise that resolves when the location is saved.
 */
export async function saveLocationForUser(userId: number, mapPointId: number): Promise<void> {
    const query = `
        INSERT IGNORE INTO user_saved_locations (user_id, map_point_id)
        VALUES (?, ?)
    `;
    await db.execute(query, [userId, mapPointId]);
}

/**
 * Removes a location from a user's saved locations.
 *
 * @param userId - The ID of the user.
 * @param mapPointId - The ID of the map point to remove.
 * @returns A promise that resolves when the location is removed.
 */
export async function removeSavedLocationForUser(userId: number, mapPointId: number): Promise<void> {
    const query = `
        DELETE FROM user_saved_locations 
        WHERE user_id = ? AND map_point_id = ?
    `;
    await db.execute(query, [userId, mapPointId]);
}

/**
 * Checks if a user has saved a specific location.
 *
 * @param userId - The ID of the user.
 * @param mapPointId - The ID of the map point to check.
 * @returns A promise that resolves to true if the location is saved, false otherwise.
 */
export async function isLocationSavedByUser(userId: number, mapPointId: number): Promise<boolean> {
    const query = `
        SELECT 1 FROM user_saved_locations 
        WHERE user_id = ? AND map_point_id = ?
        LIMIT 1
    `;
    const [rows] = await db.execute(query, [userId, mapPointId]) as [any[], any];
    return rows.length > 0;
}

/**
 * Gets all saved locations for a user.
 *
 * @param userId - The ID of the user.
 * @returns A promise that resolves to an array of map point IDs that the user has saved.
 */
export async function getUserSavedLocationIds(userId: number): Promise<number[]> {
    const query = `
        SELECT map_point_id FROM user_saved_locations 
        WHERE user_id = ?
        ORDER BY created_at DESC
    `;
    const [rows] = await db.execute(query, [userId]) as [any[], any];
    return rows.map(row => row.map_point_id);
}


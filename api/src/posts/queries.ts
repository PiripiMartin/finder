import { db, toCamelCase } from "../database";
import { generateLocationDetails } from "../posts/get-location";
import type { MapPoint } from "../map/types";
import type { EmbedResponse, Post } from "./types";

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
        INSERT INTO posts (url, posted_by, map_point_id)
        VALUES (?, ?, ?)
    `;
    await db.execute(query, [post.url, post.postedBy, post.mapPointId]);

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
export async function createInvalidLocation(embedInfo: EmbedResponse): Promise<MapPoint | null> {
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


import { db, toCamelCase } from "../database";
import type { MapPoint } from "../map/types";
import type { Post } from "./types";

// The name of the fallback location to attribute a failed post resolution to.
export const fallbackPoint: string = "fallback_location";

export interface PostSaveAttempt {
    id: number;
    requestId: string | null;
    url: string | null;
    sessionToken: string | null;
    userId: number | null;
    createdAt: Date;
}

export interface CreatePostSaveAttemptInput {
    requestId?: string | null;
    url?: string | null;
    sessionToken?: string | null;
    userId?: number | null;
}

export interface CreatePostRequest {
    url: string,
    postedBy: number,
    mapPointId: number
}

export async function createPostSaveAttempt(input: CreatePostSaveAttemptInput): Promise<PostSaveAttempt> {
    const query = `
        INSERT INTO post_save_attempts (request_id, url, session_token, user_id)
        VALUES (?, ?, ?, ?)
    `;
    await db.execute(query, [input.requestId || null, input.url || null, input.sessionToken || null, input.userId ?? null]);

    const [idRows, _] = await db.execute("SELECT LAST_INSERT_ID() as id") as [any[], any];
    const attemptId = idRows[0].id;
    const [rows, __] = await db.execute("SELECT * FROM post_save_attempts WHERE id = ?", [attemptId]) as [any[], any];
    return toCamelCase(rows[0]) as PostSaveAttempt;
}

export interface CreateLocationRequest {
    googlePlaceId: string | null,
    title: string,
    description: string | null,
    emoji: string,
    latitude: number,
    longitude: number,
    isValidLocation: boolean,
    recommendable: boolean,

    websiteUrl: string | null,
    phoneNumber: string | null,
    address: string | null,
}

export async function createLocation(location: CreateLocationRequest): Promise<MapPoint | null> {

    const query = `
        INSERT INTO map_points (google_place_id, title, description, emoji, location, is_valid_location, recommendable, website_url, phone_number, address)
        VALUES (?, ?, ?, ?, POINT(?, ?), ?, ?, ?, ?, ?)
    `;
    await db.execute(query, [location.googlePlaceId || null, location.title || null, location.description || null, location.emoji || null, location.longitude || null, location.latitude || null, location.isValidLocation || null, location.recommendable || false, location.websiteUrl || null, location.phoneNumber || null, location.address || null]);

    // Get the inserted ID
    const [idRows, _] = await db.execute("SELECT LAST_INSERT_ID() as id") as [any[], any];
    const locationId = idRows[0].id;

    // Fetch the created location to return it
    const [locations, __] = await db.execute("SELECT * FROM map_points WHERE id = ?", [locationId]) as [any[], any];
    if (locations.length === 0) {
        return null;
    }

    return toCamelCase(locations[0]) as MapPoint;
}

export async function getOrCreateFallbackLocationId(): Promise<number> {

    // Try find existing fallback location by title
    const [existingRows, _] = await db.execute(
        "SELECT id FROM map_points WHERE title = ?",
        [fallbackPoint]
    ) as [any[], any];
    if (existingRows.length > 0) {
        return existingRows[0].id as number;
    }

    // Otherwise, create a minimal non-recommendable placeholder at (0,0)
    const insertQuery = `
        INSERT INTO map_points (google_place_id, title, description, emoji, location, is_valid_location, recommendable, website_url, phone_number, address)
        VALUES (?, ?, ?, ?, POINT(?, ?), ?, ?, ?, ?, ?)
    `;
    await db.execute(insertQuery, [
        null,
        fallbackPoint,
        "Fallback Location",
        "❓",
        0,
        0,
        false,
        false,
        null,
        null,
        null,
    ]);

    const [idRows, __] = await db.execute("SELECT LAST_INSERT_ID() as id") as [any[], any];
    return idRows[0].id as number;
}

export async function createPost(post: CreatePostRequest): Promise<Post | null> {
    const query = `
        INSERT INTO posts (url, posted_by, map_point_id)
        VALUES (?, ?, ?)
    `;
    await db.execute(query, [post.url, post.postedBy, post.mapPointId]);

    // Get the inserted ID
    const [idRows, _] = await db.execute("SELECT LAST_INSERT_ID() as id") as [any[], any];
    const postId = idRows[0].id;

    // Fetch the created post to return it
    const [posts, __] = await db.execute("SELECT * FROM posts WHERE id = ?", [postId]) as [any[], any];
    if (posts.length === 0) {
        return null;
    }

    return toCamelCase(posts[0]) as Post;
}


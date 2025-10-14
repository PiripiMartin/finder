import { db, toCamelCase } from "../database";
import type { LocationEdit, MapPoint } from "./types";
import type { Post } from "../posts/types";

/**
 * Represents a location with its top post.
 */
export interface LocationAndPost {
    location: MapPoint;
    topPost: Post;
}

/**
 * Fetches saved locations for a user (locations where they've posted) along with their most recent post.
 * These are locations the user has personally posted to and should not appear in recommendations.
 *
 * @param userId - The ID of the user whose saved locations are to be fetched.
 * @returns A promise that resolves to an array of saved locations with their top posts.
 */
export async function getSavedLocationsWithTopPost(userId: number): Promise<LocationAndPost[]> {
    const query = `
        SELECT 
            mp.id,
            mp.title,
            mp.description,
            mp.emoji,
            mp.website_url,
            mp.phone_number,
            mp.address,
            mp.created_at,
            mp.is_valid_location,
            ST_X(mp.location) as longitude,
            ST_Y(mp.location) as latitude,
            p.id as post_id,
            p.url as post_url,
            p.posted_by as post_posted_by,
            p.posted_at as post_posted_at
        FROM map_points mp
        INNER JOIN (
            -- Find the most recent post for each location by the user
            SELECT DISTINCT
                map_point_id,
                FIRST_VALUE(id) OVER (PARTITION BY map_point_id ORDER BY posted_at DESC) as id,
                FIRST_VALUE(url) OVER (PARTITION BY map_point_id ORDER BY posted_at DESC) as url,
                FIRST_VALUE(posted_by) OVER (PARTITION BY map_point_id ORDER BY posted_at DESC) as posted_by,
                FIRST_VALUE(posted_at) OVER (PARTITION BY map_point_id ORDER BY posted_at DESC) as posted_at
            FROM posts
            WHERE posted_by = ?
        ) p ON mp.id = p.map_point_id
        ORDER BY p.posted_at DESC
    `;

    const [rows] = await db.execute(query, [userId]) as [any[], any];
    const results = toCamelCase(rows) as any[];
    
    return results.map(row => ({
        location: {
            id: row.id,
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
            createdAt: row.createdAt
        },
        topPost: {
            id: row.postId,
            url: row.postUrl,
            postedBy: row.postPostedBy,
            mapPointId: parseInt(row.id),
            postedAt: row.postPostedAt
        }
    }));
}

/**
 * Fetches recommended locations near a user's coordinates with their most recent post.
 * Excludes locations where the user has already posted.
 *
 * @param accountId - The ID of the user.
 * @param latitude - The latitude of the user's location.
 * @param longitude - The longitude of the user's location.
 * @param radiusKm - The search radius in kilometers (default: 10).
 * @param limit - The maximum number of recommendations to return (default: 20).
 * @param opts - Optional parameters, including whether to include unrecommendable locations.
 * @returns A promise that resolves to an array of recommended locations with their top posts.
 */
export async function getRecommendedLocationsWithTopPost(
    accountId: number,
    latitude: number, 
    longitude: number, 
    radiusKm: number = 10,
    limit: number = 20,
    opts?: { includeUnrecommendable?: boolean }
): Promise<LocationAndPost[]> {
    const includeUnrecommendable = opts?.includeUnrecommendable ?? false;
    const recommendableCondition = includeUnrecommendable ? "1 = 1" : "mp.recommendable = TRUE";

    const query = `
        SELECT DISTINCT
            mp.id,
            mp.title,
            mp.description,
            mp.emoji,
            mp.website_url,
            mp.phone_number,
            mp.address,
            mp.created_at,
            mp.is_valid_location,
            ST_X(mp.location) as longitude,
            ST_Y(mp.location) as latitude,
            p.id as post_id,
            p.url as post_url,
            p.posted_by as post_posted_by,
            p.posted_at as post_posted_at,
            ST_Distance_Sphere(mp.location, POINT(?, ?)) / 1000 as distance_km
        FROM map_points mp
        LEFT JOIN (
            SELECT
                map_point_id,
                FIRST_VALUE(id) OVER (PARTITION BY map_point_id ORDER BY posted_at DESC) as id,
                FIRST_VALUE(url) OVER (PARTITION BY map_point_id ORDER BY posted_at DESC) as url,
                FIRST_VALUE(posted_by) OVER (PARTITION BY map_point_id ORDER BY posted_at DESC) as posted_by,
                FIRST_VALUE(posted_at) OVER (PARTITION BY map_point_id ORDER BY posted_at DESC) as posted_at
            FROM posts
        ) p ON mp.id = p.map_point_id
        WHERE ST_Distance_Sphere(mp.location, POINT(?, ?)) <= ? * 1000
        -- Exclude locations where the current user has posted (these are saved locations)
        AND mp.id NOT IN (
            SELECT DISTINCT map_point_id 
            FROM posts 
            WHERE posted_by = ?
        )
        -- Only include recommendable locations unless explicitly overridden (e.g., guests)
        AND ${recommendableCondition}
        -- Only include locations that have at least one post
        AND p.id IS NOT NULL
        ORDER BY distance_km ASC, mp.created_at DESC
        LIMIT ${Number(limit)}
    ;`

    const [rows, _] = await db.execute(query, [
        Number(longitude),
        Number(latitude),
        Number(longitude),
        Number(latitude),
        Number(radiusKm),
        Number(accountId)
    ]) as [any[], any];

    const results = toCamelCase(rows) as any[];
    
    return results.map(row => ({
        location: {
            id: row.id,
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
            createdAt: row.createdAt
        },
        topPost: {
            id: row.postId,
            url: row.postUrl,
            postedBy: row.postPostedBy,
            mapPointId: parseInt(row.id),
            postedAt: row.postPostedAt
        }
    }));
}

/**
 * Fetches all posts for a specific location.
 *
 * @param locationId - The ID of the location.
 * @returns A promise that resolves to an array of posts for the given location.
 */
export async function fetchPostsForLocation(locationId: number): Promise<Post[]> {
    const query = `
        SELECT 
            id,
            url,
            posted_by,
            map_point_id,
            posted_at
        FROM posts
        WHERE map_point_id = ?
    `;

    const [rows] = await db.execute(query, [locationId]) as [any[], any];
    return toCamelCase(rows) as Post[];
}


export async function fetchUserLocationEdits(userId: number): Promise<LocationEdit[]> {
    const query = `
        SELECT
            google_place_id,
            title,
            description,
            emoji,
            location,
            website_url,
            phone_number,
            address,
            created_at,
            last_edited
        FROM 
            user_location_edits
        WHERE
            user_id = ?;
    `;

    const [rows] = await db.execute(query, [userId]) as [any[], any];
    return toCamelCase(rows) as LocationEdit[];
}



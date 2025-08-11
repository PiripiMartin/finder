import { db, toCamelCase } from "../database";
import type { MapPoint } from "./types";
import type { Post } from "../posts/types";


export interface LocationAndPost {
    location: MapPoint;
    topPost: Post;
} 


/**
 * Fetches saved locations for a user (locations where they've posted) with their top post (most recent)
 */
export async function getSavedLocationsWithTopPost(userId: number): Promise<LocationAndPost[]> {
    const query = `
        SELECT 
            mp.id,
            mp.title,
            mp.description,
            mp.emoji,
            ST_X(mp.location) as longitude,
            ST_Y(mp.location) as latitude,
            p.id as post_id,
            p.url as post_url,
            p.posted_by as post_posted_by,
            p.posted_at as post_posted_at
        FROM map_points mp
        INNER JOIN (
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

    const [rows, _] = await db.execute(query, [userId]) as [any[], any];
    const results = toCamelCase(rows) as any[];
    
    return results.map(row => ({
        location: {
            id: row.id,
            title: row.title,
            description: row.description,
            emoji: row.emoji,
            latitude: row.latitude,
            longitude: row.longitude,
            recommendable: row.recommendable
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
 * Fetches recommended locations near user coordinates with their top post (most recent)
 */
export async function getRecommendedLocationsWithTopPost(
    accountId: number,
    latitude: number, 
    longitude: number, 
    radiusKm: number = 10,
    limit: number = 20
): Promise<LocationAndPost[]> {
    const query = `
        SELECT DISTINCT
            mp.id,
            mp.title,
            mp.description,
            mp.emoji,
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
        AND mp.id NOT IN (
            SELECT map_point_id FROM posts WHERE posted_by = ?
        )
        AND mp.recommendable = TRUE
        ORDER BY distance_km ASC, mp.created_at DESC
        LIMIT ${Number(limit)}
    `;

    const [rows, _] = await db.execute(query, [
        Number(longitude),
        Number(latitude),
        Number(longitude),
        Number(latitude),
        Number(radiusKm),
        Number(accountId)
    ]) as [any[], any];
    const results = toCamelCase(rows) as any[];
    
    // Filter out locations without posts and transform to LocationAndPost format
    return results
        .filter(row => row.postId) // Only include locations that have posts
        .map(row => ({
            location: {
                id: row.id,
                title: row.title,
                description: row.description,
                emoji: row.emoji,
                latitude: row.latitude,
                longitude: row.longitude,
                recommendable: row.recommendable
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

    const [rows, _] = await db.execute(query, [locationId]) as [any[], any];
    const results = toCamelCase(rows) as Post[];

    return results;
}

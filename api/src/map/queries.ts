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
 * Fetches saved locations for a user including:
 * - Directly saved locations (user_saved_locations table)
 * - Locations in folders created by the user
 * - Locations in folders followed by the user
 * 
 * These are locations the user has personally posted to and should not appear in recommendations.
 *
 * @param userId - The ID of the user whose saved locations are to be fetched.
 * @returns A promise that resolves to an array of saved locations with their top posts.
 */
export async function getSavedLocationsWithTopPost(userId: number): Promise<LocationAndPost[]> {
    const query = `
        SELECT 
            mp.id,
            mp.google_place_id,
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
        FROM user_saved_locations usl
        INNER JOIN map_points mp ON usl.map_point_id = mp.id
        LEFT JOIN (
            SELECT DISTINCT
                map_point_id,
                FIRST_VALUE(id) OVER (PARTITION BY map_point_id ORDER BY posted_at DESC) as id,
                FIRST_VALUE(url) OVER (PARTITION BY map_point_id ORDER BY posted_at DESC) as url,
                FIRST_VALUE(posted_by) OVER (PARTITION BY map_point_id ORDER BY posted_at DESC) as posted_by,
                FIRST_VALUE(posted_at) OVER (PARTITION BY map_point_id ORDER BY posted_at DESC) as posted_at
            FROM posts
        ) p ON mp.id = p.map_point_id
        WHERE usl.user_id = ?
        ORDER BY usl.created_at DESC
    `;

    const [rows] = await db.execute(query, [userId]) as [any[], any];
    const results = toCamelCase(rows) as any[];

    const userEdits = await fetchUserLocationEdits(userId);
    const editsMap = new Map(userEdits.map(edit => [edit.mapPointId, edit]));

    return results.map(row => {
        const location: MapPoint = {
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
        };

        const edit = editsMap.get(row.id);

        const addressUpdated = edit?.googlePlaceId != location.googlePlaceId;

        if (edit) {
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
            location,
            topPost: {
                id: row.postId,
                url: row.postUrl,
                postedBy: row.postPostedBy,
                mapPointId: parseInt(row.id),
                postedAt: row.postPostedAt
            }
        };
    });
}

export async function getSavedLocationsWithTopPostOld(userId: number): Promise<any[]> {
    const query = `
        SELECT 
            mp.id,
            mp.google_place_id,
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
        -- Exclude locations the user has soft-deleted
        WHERE mp.id NOT IN (
            SELECT map_point_id FROM user_deleted_locations WHERE user_id = ?
        )
        ORDER BY p.posted_at DESC
    `;
    
    const [rows] = await db.execute(query, [userId, userId]) as [any[], any];
    const results = toCamelCase(rows) as any[];
    
    const userEdits = await fetchUserLocationEdits(userId);
    const editsMap = new Map(userEdits.map(edit => [edit.mapPointId, edit]));
    
    return results.map(row => {
        const location: MapPoint = {
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
        };
    
        const edit = editsMap.get(row.id);
    
        const addressUpdated = edit?.googlePlaceId != location.googlePlaceId;
    
        if (edit) {
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
            location,
            topPost: {
                id: row.postId,
                url: row.postUrl,
                postedBy: row.postPostedBy,
                mapPointId: parseInt(row.id),
                postedAt: row.postPostedAt
            }
        };
    });
}



/**
 * Returns folder IDs owned by the given user, ordered by creation date (desc).
 */
export async function getPersonalFolderIds(userId: number): Promise<number[]> {
    const [rows] = await db.execute(
        "SELECT folder_id as id FROM folder_owners WHERE user_id = ?;",
        [userId]
    ) as [any[], any];
    return rows.map(r => r.id as number);
}

/**
 * Returns folder IDs created by the given user.
 */
export async function getCreatedFolderIds(userId: number): Promise<number[]> {
    const [rows] = await db.execute(
        "SELECT id FROM folders WHERE creator_id = ?",
        [userId]
    ) as [any[], any];
    return rows.map(r => r.id as number);
}

/**
 * Returns folder IDs the user co-owns but did not create.
 */
export async function getCoOwnedFolderIds(userId: number): Promise<number[]> {
    const query = `
        SELECT fo.folder_id AS id
        FROM folder_owners fo
        INNER JOIN folders f ON f.id = fo.folder_id
        WHERE fo.user_id = ? AND (f.creator_id IS NULL OR f.creator_id <> ?)
    `;
    const [rows] = await db.execute(query, [userId, userId]) as [any[], any];
    return rows.map(r => r.id as number);
}

/**
 * Returns folder IDs followed by the given user.
 */
export async function getFollowedFolderIds(userId: number): Promise<number[]> {
    const [rows] = await db.execute(
        "SELECT folder_id FROM folder_follows WHERE user_id = ?",
        [userId]
    ) as [any[], any];
    return rows.map(r => r.folder_id as number);
}

/**
 * Fetches locations in a specific folder with their latest top post (any user).
 */
export async function getFolderLocationsWithTopPost(folderId: number): Promise<any[]> {
    const query = `
        SELECT DISTINCT
            mp.id,
            mp.google_place_id,
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
        FROM folder_locations fl
        INNER JOIN map_points mp ON fl.map_point_id = mp.id
        LEFT JOIN (
            SELECT DISTINCT
                map_point_id,
                FIRST_VALUE(id) OVER (PARTITION BY map_point_id ORDER BY posted_at DESC) as id,
                FIRST_VALUE(url) OVER (PARTITION BY map_point_id ORDER BY posted_at DESC) as url,
                FIRST_VALUE(posted_by) OVER (PARTITION BY map_point_id ORDER BY posted_at DESC) as posted_by,
                FIRST_VALUE(posted_at) OVER (PARTITION BY map_point_id ORDER BY posted_at DESC) as posted_at
            FROM posts
        ) p ON mp.id = p.map_point_id
        WHERE fl.folder_id = ?
        ORDER BY COALESCE(p.posted_at, mp.created_at) DESC
    `;
    const [rows] = await db.execute(query, [folderId]) as [any[], any];
    return rows;
}

/**
 * Fetches locations that are saved by user but not attributed to any folder the user has access to, with latest top post.
 */
export async function getUncategorisedSavedLocationsWithTopPost(userId: number): Promise<any[]> {
    const query = `
        SELECT DISTINCT
            mp.id,
            mp.google_place_id,
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
        FROM user_saved_locations usl
        INNER JOIN map_points mp ON usl.map_point_id = mp.id
        LEFT JOIN (
            SELECT DISTINCT
                map_point_id,
                FIRST_VALUE(id) OVER (PARTITION BY map_point_id ORDER BY posted_at DESC) as id,
                FIRST_VALUE(url) OVER (PARTITION BY map_point_id ORDER BY posted_at DESC) as url,
                FIRST_VALUE(posted_by) OVER (PARTITION BY map_point_id ORDER BY posted_at DESC) as posted_by,
                FIRST_VALUE(posted_at) OVER (PARTITION BY map_point_id ORDER BY posted_at DESC) as posted_at
            FROM posts
        ) p ON mp.id = p.map_point_id
        WHERE usl.user_id = ?
          AND mp.id NOT IN (
            -- Exclude locations that are in folders the user has access to
            SELECT DISTINCT fl.map_point_id
            FROM folder_locations fl
            INNER JOIN (
                -- Get all folders the user has access to (created, co-owned, or followed)
                SELECT DISTINCT folder_id
                FROM (
                    SELECT id as folder_id FROM folders WHERE creator_id = ?
                    UNION
                    SELECT folder_id FROM folder_owners WHERE user_id = ?
                    UNION
                    SELECT folder_id FROM folder_follows WHERE user_id = ?
                ) user_folders
            ) uf ON fl.folder_id = uf.folder_id
        )
        ORDER BY usl.created_at DESC
    `;
    const [rows] = await db.execute(query, [userId, userId, userId, userId]) as [any[], any];
    return rows;
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
            mp.google_place_id,
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
        -- Exclude locations the user has soft-deleted
        AND mp.id NOT IN (
            SELECT map_point_id FROM user_deleted_locations WHERE user_id = ?
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
        Number(accountId),
        Number(accountId)
    ]) as [any[], any];

    const results = toCamelCase(rows) as any[];
    const userEdits = await fetchUserLocationEdits(accountId);
    const editsMap = new Map(userEdits.map(edit => [edit.mapPointId, edit]));

    return results.map(row => {
        const location: MapPoint = {
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
        };

        const edit = editsMap.get(row.id);
        if (edit) {
            location.title = edit.title ?? location.title;
            location.description = edit.description ?? location.description;
            location.emoji = edit.emoji ?? location.emoji;
            location.websiteUrl = edit.websiteUrl ?? location.websiteUrl;
            location.phoneNumber = edit.phoneNumber ?? location.phoneNumber;
            location.address = edit.address ?? location.address;
            location.googlePlaceId = edit.googlePlaceId ?? location.googlePlaceId;
            location.latitude = edit.latitude ?? location.latitude;
            location.longitude = edit.longitude ?? location.longitude;
        }

        return {
            location,
            topPost: {
                id: row.postId,
                url: row.postUrl,
                postedBy: row.postPostedBy,
                mapPointId: parseInt(row.id),
                postedAt: row.postPostedAt
            }
        };
    });
}

/**
 * Fetches all posts for a specific location, excluding posts with duplicate URLs.
 * For duplicate URLs, only the most recent post is returned.
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
        FROM (
            SELECT 
                id,
                url,
                posted_by,
                map_point_id,
                posted_at,
                ROW_NUMBER() OVER (PARTITION BY url ORDER BY posted_at DESC) as rn
            FROM posts
            WHERE map_point_id = ?
        ) ranked_posts
        WHERE rn = 1
        ORDER BY posted_at DESC
    `;

    const [rows] = await db.execute(query, [locationId]) as [any[], any];
    return toCamelCase(rows) as Post[];
}


export async function fetchUserLocationEdits(userId: number): Promise<LocationEdit[]> {
    const query = `
        SELECT
            user_id,
            map_point_id,
            title,
            description,
            emoji,
            ST_X(location) as longitude,
            ST_Y(location) as latitude,
            website_url,
            phone_number,
            address,
            created_at,
            last_updated
        FROM 
            user_location_edits
        WHERE
            user_id = ?;
    `;

    const [rows] = await db.execute(query, [userId]) as [any[], any];
    return toCamelCase(rows) as LocationEdit[];
}


/**
 * Fetches user location edits for a set of users and a set of map points.
 * Useful for applying shared edits from folder owners to followers/co-owners.
 */
export async function fetchUserLocationEditsForUsersAndMapPoints(
    userIds: number[],
    mapPointIds: number[]
): Promise<LocationEdit[]> {
    if (userIds.length === 0 || mapPointIds.length === 0) {
        return [];
    }

    const userPlaceholders = userIds.map(() => '?').join(', ');
    const mapPointPlaceholders = mapPointIds.map(() => '?').join(', ');

    const query = `
        SELECT
            user_id,
            map_point_id,
            title,
            description,
            emoji,
            ST_X(location) as longitude,
            ST_Y(location) as latitude,
            website_url,
            phone_number,
            address,
            created_at,
            last_updated
        FROM user_location_edits
        WHERE user_id IN (${userPlaceholders})
          AND map_point_id IN (${mapPointPlaceholders})
    `;

    const [rows] = await db.execute(query, [...userIds, ...mapPointIds]) as [any[], any];
    return toCamelCase(rows) as LocationEdit[];
}

/**
 * Fetches all folder locations with their top posts in a single optimized query.
 * Returns data grouped by folder_id for efficient processing.
 */
export async function getAllFolderLocationsWithTopPost(folderIds: number[]): Promise<Map<number, any[]>> {
    if (folderIds.length === 0) {
        return new Map();
    }

    const folderPlaceholders = folderIds.map(() => '?').join(', ');
    
    const query = `
        SELECT DISTINCT
            fl.folder_id,
            mp.id,
            mp.google_place_id,
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
        FROM folder_locations fl
        INNER JOIN map_points mp ON fl.map_point_id = mp.id
        LEFT JOIN (
            SELECT DISTINCT
                map_point_id,
                FIRST_VALUE(id) OVER (PARTITION BY map_point_id ORDER BY posted_at DESC) as id,
                FIRST_VALUE(url) OVER (PARTITION BY map_point_id ORDER BY posted_at DESC) as url,
                FIRST_VALUE(posted_by) OVER (PARTITION BY map_point_id ORDER BY posted_at DESC) as posted_by,
                FIRST_VALUE(posted_at) OVER (PARTITION BY map_point_id ORDER BY posted_at DESC) as posted_at
            FROM posts
        ) p ON mp.id = p.map_point_id
        WHERE fl.folder_id IN (${folderPlaceholders})
        ORDER BY fl.folder_id, COALESCE(p.posted_at, mp.created_at) DESC
    `;
    
    const [rows] = await db.execute(query, folderIds) as [any[], any];
    
    // Group results by folder_id
    const folderMap = new Map<number, any[]>();
    for (const row of rows) {
        const folderId = row.folder_id;
        if (!folderMap.has(folderId)) {
            folderMap.set(folderId, []);
        }
        folderMap.get(folderId)!.push(row);
    }
    
    return folderMap;
}

/**
 * Fetches all folder owners in a single optimized query.
 * Returns a map of folder_id -> owner_ids for efficient processing.
 */
export async function getAllFolderOwners(folderIds: number[]): Promise<Map<number, number[]>> {
    if (folderIds.length === 0) {
        return new Map();
    }

    const folderPlaceholders = folderIds.map(() => '?').join(', ');
    
    const query = `
        SELECT fo.folder_id, fo.user_id
        FROM folder_owners fo
        WHERE fo.folder_id IN (${folderPlaceholders})
        ORDER BY fo.folder_id
    `;
    
    const [rows] = await db.execute(query, folderIds) as [any[], any];
    
    // Group results by folder_id
    const ownerMap = new Map<number, number[]>();
    for (const row of rows) {
        const folderId = row.folder_id;
        if (!ownerMap.has(folderId)) {
            ownerMap.set(folderId, []);
        }
        ownerMap.get(folderId)!.push(row.user_id);
    }
    
    return ownerMap;
}

/**
 * Fetches folder info (name and color) for multiple folders in a single query.
 * Returns a map of folder_id -> { name, color } for efficient processing.
 */
export async function getAllFolderInfo(folderIds: number[]): Promise<Map<number, { name: string; color: string }>> {
    if (folderIds.length === 0) {
        return new Map();
    }

    const folderPlaceholders = folderIds.map(() => '?').join(', ');
    
    const query = `
        SELECT id, name, color
        FROM folders
        WHERE id IN (${folderPlaceholders})
    `;
    
    const [rows] = await db.execute(query, folderIds) as [any[], any];
    
    const folderInfoMap = new Map<number, { name: string; color: string }>();
    for (const row of rows) {
        folderInfoMap.set(row.id, {
            name: row.name,
            color: row.color
        });
    }
    
    return folderInfoMap;
}


export async function insertLocationForUser(userId: number, locationId: number): Promise<void> {
    const query = `
        INSERT INTO user_saved_locations (user_id, map_point_id)
        VALUES (?, ?);
    `;

    await db.execute(query, [userId, locationId]);
}



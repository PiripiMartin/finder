import type { BunRequest } from "bun";
import { db, toCamelCase } from "../database";
import { verifySessionToken } from "../user/session";
import { checkedExtractBody } from "../utils";
import { fetchPostsForLocation, getRecommendedLocationsWithTopPost, fetchUserLocationEdits, getFollowedFolderIds, getFolderLocationsWithTopPost, getUncategorisedSavedLocationsWithTopPost, getSavedLocationsWithTopPost, getSavedLocationsWithTopPostOld, getCreatedFolderIds, getCoOwnedFolderIds, fetchUserLocationEditsForUsersAndMapPoints, getAllFolderLocationsWithTopPost, getAllFolderOwners, getAllFolderInfo, insertLocationForUser } from "./queries";
import { getFolderOwners, removeLocationFromFolder } from "../folders/queries";
import { removeSavedLocationForUser } from "../posts/queries";

/**
 * Fetches all posts for a given map point ID.
 *
 * @param req - The Bun request, containing the map point ID in the URL parameters.
 * @returns A response containing the posts or an error message.
 */
export async function getPostsForLocation(req: BunRequest): Promise<Response> {
    const sessionToken = req.headers.get("Authorization")?.split(" ")[1];
    if (!sessionToken) {
        return new Response("Missing or malformed session token", { status: 401 });
    }

    const accountId = await verifySessionToken(sessionToken);
    if (accountId === null) {
        return new Response("Invalid or expired session token", { status: 401 });
    }

    const id = parseInt((req.params as any).id, 10);
    if (isNaN(id)) {
        return new Response("Invalid map point ID", { status: 400 });
    }

    try {
        const posts = await fetchPostsForLocation(id);
        return new Response(JSON.stringify(posts), { status: 200, headers: { "Content-Type": "application/json" } });
    } catch (error) {
        console.error(`Error fetching posts for location ${id}:`, error);
        return new Response("Internal server error", { status: 500 });
    }
}

/**
 * Fetches the saved locations for the authenticated user.
 *
 * @param req - The Bun request, containing the session token in the Authorization header.
 * @returns A response containing the saved locations or an error message.
 */
export async function getSavedLocations(req: BunRequest): Promise<Response> {
    const sessionToken = req.headers.get("Authorization")?.split(" ")[1];
    if (!sessionToken) {
        return new Response("Missing or malformed session token", { status: 401 });
    }

    const accountId = await verifySessionToken(sessionToken);
    if (accountId === null) {
        return new Response("Invalid or expired session token", { status: 401 });
    }

    try {
        // Fetch all folder IDs in parallel
        const [createdFolderIds, coOwnedFolderIds, followedFolderIds] = await Promise.all([
            getCreatedFolderIds(accountId),
            getCoOwnedFolderIds(accountId),
            getFollowedFolderIds(accountId)
        ]);

        // Collect all folder IDs for batch processing
        const allFolderIds = [...createdFolderIds, ...coOwnedFolderIds, ...followedFolderIds];
        
        // Fetch user location edits once to apply to all results
        const userEdits = await fetchUserLocationEdits(accountId);
        const editsMap = new Map(userEdits.map(edit => [edit.mapPointId, edit]));

        // Batch fetch all folder locations, owners, and folder info in parallel
        const [folderLocationsMap, folderOwnersMap, folderInfoMap, uncategorisedRows] = await Promise.all([
            getAllFolderLocationsWithTopPost(allFolderIds),
            getAllFolderOwners(allFolderIds),
            getAllFolderInfo(allFolderIds),
            getUncategorisedSavedLocationsWithTopPost(accountId)
        ]);

        // Collect all unique owner IDs and map point IDs for batch edit fetching
        const allOwnerIds = new Set<number>();
        const allMapPointIds = new Set<number>();
        
        for (const ownerIds of folderOwnersMap.values()) {
            ownerIds.forEach(id => allOwnerIds.add(id));
        }
        
        for (const locationRows of folderLocationsMap.values()) {
            locationRows.forEach(row => allMapPointIds.add(row.id));
        }

        // Batch fetch all owner edits
        const allOwnerEdits = allOwnerIds.size > 0 && allMapPointIds.size > 0 
            ? await fetchUserLocationEditsForUsersAndMapPoints(Array.from(allOwnerIds), Array.from(allMapPointIds))
            : [];

        // Group owner edits by map point ID for efficient lookup
        const ownerEditsByMapPoint = new Map<number, any>();
        for (const edit of allOwnerEdits) {
            const existing = ownerEditsByMapPoint.get(edit.mapPointId);
            if (!existing || new Date(edit.lastUpdated).getTime() > new Date(existing.lastUpdated).getTime()) {
                ownerEditsByMapPoint.set(edit.mapPointId, edit);
            }
        }

        const formatRows = (rows: any[], ownerEditsMap?: Map<number, any>) => rows.map(row => {
            const location = {
                id: row.id,
                googlePlaceId: row.google_place_id,
                title: row.title,
                description: row.description,
                emoji: row.emoji,
                latitude: row.latitude,
                longitude: row.longitude,
                recommendable: row.recommendable,
                isValidLocation: row.is_valid_location,
                websiteUrl: row.website_url,
                phoneNumber: row.phone_number,
                address: row.address,
                createdAt: row.created_at
            } as any;

            // Prefer viewer's own edit; otherwise if provided, fall back to owner edit
            const edit = editsMap.get(row.id) ?? ownerEditsMap?.get(row.id);
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
                    location.websiteUrl = edit.websiteUrl ?? "";
                    location.phoneNumber = edit.phoneNumber ?? "";
                }
            }

            return {
                location,
                topPost: {
                    id: row.post_id ?? null,
                    url: row.post_url ?? null,
                    postedBy: row.post_posted_by ?? null,
                    mapPointId: row.id,
                    postedAt: row.post_posted_at ?? null,
                }
            };
        });

        // Build personal folders object (folders created by the user)
        const personal: any = { uncategorised: formatRows(uncategorisedRows) };
        for (const folderId of createdFolderIds) {
            const rows = folderLocationsMap.get(folderId) || [];
            const folderInfo = folderInfoMap.get(folderId) || { name: "", color: "" };

            //personal[folderId] = {
            //    name: folderInfo.name,
            //    color: folderInfo.color,
            //    locations: formatRows(rows)
            //};

            personal[folderId] = formatRows(rows);

        }

        // Build shared folders object (folders co-owned but not created by user)
        const shared: any = {};
        for (const folderId of coOwnedFolderIds) {
            const rows = folderLocationsMap.get(folderId) || [];
            const ownerIds = folderOwnersMap.get(folderId) || [];
            const folderInfo = folderInfoMap.get(folderId) || { name: "", color: "" };
            
            // Create owner edits map for this folder's locations
            const folderOwnerEditsMap = new Map<number, any>();
            for (const row of rows) {
                const edit = ownerEditsByMapPoint.get(row.id);
                if (edit) {
                    folderOwnerEditsMap.set(row.id, edit);
                }
            }
            
            //shared[folderId] = {
            //    name: folderInfo.name,
            //    color: folderInfo.color,
            //    locations: formatRows(rows, folderOwnerEditsMap)
            //};

            shared[folderId] = formatRows(rows, folderOwnerEditsMap);
        }

        // Build followed folders object; apply fallbacks to owners' edits if viewer has none
        const followed: any = {};
        for (const folderId of followedFolderIds) {
            const rows = folderLocationsMap.get(folderId) || [];
            const ownerIds = folderOwnersMap.get(folderId) || [];
            const folderInfo = folderInfoMap.get(folderId) || { name: "", color: "" };
            
            // Create owner edits map for this folder's locations
            const folderOwnerEditsMap = new Map<number, any>();
            for (const row of rows) {
                const edit = ownerEditsByMapPoint.get(row.id);
                if (edit) {
                    folderOwnerEditsMap.set(row.id, edit);
                }
            }
            
            //followed[folderId] = {
            //    name: folderInfo.name,
            //    color: folderInfo.color,
            //    locations: formatRows(rows, folderOwnerEditsMap)
            //};

            followed[folderId] = formatRows(rows, folderOwnerEditsMap);

        }

        const payload = { personal, shared, followed };
        return new Response(JSON.stringify(payload), { status: 200, headers: { "Content-Type": "application/json" } });
    } catch (error) {
        console.error(`Error fetching saved locations for account ${accountId}:`, error);
        return new Response("Internal server error", { status: 500 });
    }
}

export async function getSavedLocationsOld(req: BunRequest): Promise<Response> {
    const sessionToken = req.headers.get("Authorization")?.split(" ")[1];
    if (!sessionToken) {
        return new Response("Missing or malformed session token", { status: 401 });
    }

    const accountId = await verifySessionToken(sessionToken);
    if (accountId === null) {
        return new Response("Invalid or expired session token", { status: 401 });
    }

    try {
        const savedLocations = await getSavedLocationsWithTopPostOld(accountId);
        return new Response(JSON.stringify(savedLocations), { status: 200, headers: { "Content-Type": "application/json" } });
    } catch (error) {
        console.error(`Error fetching saved locations for account ${accountId}:`, error);
        return new Response("Internal server error", { status: 500 });
    }
}

/**
 * Fetches the user's saved locations and recommended locations based on their coordinates.
 *
 * @param req - The Bun request, containing the session token and coordinates.
 * @returns A response containing the saved and recommended locations or an error message.
 */
export async function getSavedAndRecommendedLocations(req: BunRequest): Promise<Response> {
    const sessionToken = req.headers.get("Authorization")?.split(" ")[1];
    if (!sessionToken) {
        return new Response("Missing or malformed session token", { status: 401 });
    }

    const accountId = await verifySessionToken(sessionToken);
    if (accountId === null) {
        return new Response("Invalid or expired session token", { status: 401 });
    }

    const url = new URL(req.url);
    const latitude = parseFloat(url.searchParams.get("lat") || "");
    const longitude = parseFloat(url.searchParams.get("lon") || "");

    if (isNaN(latitude) || isNaN(longitude)) {
        return new Response("Invalid or missing coordinates", { status: 400 });
    }

    try {
        const [savedLocations, recommendedLocations] = await Promise.all([
            getSavedLocationsWithTopPost(accountId),
            getRecommendedLocationsWithTopPost(accountId, latitude, longitude, 10, 20),
        ]);

        return new Response(
            JSON.stringify({ savedLocations, recommendedLocations }),
            { status: 200, headers: { "Content-Type": "application/json" } }
        );
    } catch (error) {
        console.error(`Error fetching saved and recommended locations for account ${accountId}:`, error);
        return new Response("Internal server error", { status: 500 });
    }
}


/**
 * Deletes a location for the authenticated user by removing it from saved locations,
 * setting posted_by to null for all their posts at that location, and removing the
 * location from all folders where the user is a co-owner.
 *
 * @param req - The Bun request, containing the session token and the location ID.
 * @returns A response indicating success or failure.
 */
export async function deleteLocationForUser(req: BunRequest): Promise<Response> {
    const sessionToken = req.headers.get("Authorization")?.split(" ")[1];
    if (!sessionToken) {
        return new Response("Missing or malformed session token", { status: 401 });
    }

    const accountId = await verifySessionToken(sessionToken);
    if (accountId === null) {
        return new Response("Invalid or expired session token", { status: 401 });
    }

    const id = parseInt((req.params as any).id, 10);
    if (isNaN(id)) {
        return new Response("Invalid map point ID", { status: 400 });
    }

    try {
        // Remove the location from user's saved locations
        await removeSavedLocationForUser(accountId, id);
        
        // Set posted_by to null for all posts by this user at this location
        await db.execute(
            "UPDATE posts SET posted_by = NULL WHERE posted_by = ? AND map_point_id = ?",
            [accountId, id]
        );
        
        // Remove the location from all folders the user owns or co-owns
        const [createdFolderIds, coOwnedFolderIds] = await Promise.all([
            getCreatedFolderIds(accountId),
            getCoOwnedFolderIds(accountId)
        ]);
        const uniqueFolderIds = Array.from(new Set([...createdFolderIds, ...coOwnedFolderIds]));
        for (const folderId of uniqueFolderIds) {
            try {
                await removeLocationFromFolder(folderId, id);
            } catch (folderError) {
                console.error(`Error removing location ${id} from folder ${folderId}:`, folderError);
                // Continue with other folders even if one fails
            }
        }
        
        return new Response(null, { status: 204 });
    } catch (error) {
        console.error(`Error deleting location ${id} for account ${accountId}:`, error);
        return new Response("Internal server error", { status: 500 });
    }
}

/**
 * Fetches recommended locations for guest users based on their coordinates.
 *
 * @param req - The Bun request, containing the coordinates.
 * @returns A response containing the recommended locations or an error message.
 */
export async function getGuestRecommendations(req: BunRequest): Promise<Response> {
    const url = new URL(req.url);
    const latitude = parseFloat(url.searchParams.get("lat") || "");
    const longitude = parseFloat(url.searchParams.get("lon") || "");

    if (isNaN(latitude) || isNaN(longitude)) {
        return new Response("Invalid or missing coordinates", { status: 400 });
    }

    try {
        // Guests have an account ID of -1, which ensures no saved posts are matched
        const recommendedLocations = await getRecommendedLocationsWithTopPost(-1, latitude, longitude, 10, 20, { includeUnrecommendable: true });
        return new Response(JSON.stringify(recommendedLocations), { status: 200, headers: { "Content-Type": "application/json" } });
    } catch (error) {
        console.error("Error fetching guest recommendations:", error);
        return new Response("Internal server error", { status: 500 });
    }
}


export async function addLocation(req: BunRequest): Promise<Response> {
    const sessionToken = req.headers.get("Authorization")?.split(" ")[1];
    if (!sessionToken) {
        return new Response("Missing or malformed session token", { status: 401 });
    }

    const accountId = await verifySessionToken(sessionToken);
    if (accountId === null) {
        return new Response("Invalid or expired session token", { status: 401 });
    }

    const locationId = parseInt((req.params as any).id, 10);
    if (isNaN(locationId)) {
        return new Response("Invalid map point ID", { status: 400 });
    }

    await insertLocationForUser(accountId, locationId);
    
    
    return new Response("Successfully added location", { status: 200 });
}

/**
 * Rounds a rating value to the nearest 0.5 increment.
 * Valid range is 1.0 to 5.0.
 * 
 * @param rating - The rating value to round.
 * @returns The rating rounded to the nearest 0.5 increment.
 */
function roundToHalfIncrement(rating: number): number {
    return Math.round(rating * 2) / 2;
}

/**
 * Creates or updates a review for a location.
 * Expects JSON body: { mapPointId: number, rating: number, review?: string }
 * Requires authentication.
 */
export async function createLocationReview(req: BunRequest): Promise<Response> {
    const sessionToken = req.headers.get("Authorization")?.split(" ")[1];
    if (!sessionToken) {
        return new Response("Missing session token", { status: 401 });
    }

    const userId = await verifySessionToken(sessionToken);
    if (userId === null) {
        return new Response("Invalid or expired session token", { status: 401 });
    }

    const data = await checkedExtractBody(req, ["mapPointId", "rating"]);
    if (!data) {
        return new Response("Malformed request body", { status: 400 });
    }

    const mapPointId = Number((data as any).mapPointId);
    const ratingInput = Number((data as any).rating);
    const reviewText = (data as any).review || null;

    if (!Number.isInteger(mapPointId) || mapPointId <= 0) {
        return new Response("Invalid map point id", { status: 400 });
    }

    if (isNaN(ratingInput) || ratingInput < 1 || ratingInput > 5) {
        return new Response("Rating must be a number between 1 and 5", { status: 400 });
    }

    if (reviewText !== null && typeof reviewText !== "string") {
        return new Response("Review must be a string or null", { status: 400 });
    }

    // Round rating to nearest 0.5 increment
    const roundedRating = roundToHalfIncrement(ratingInput);
    if (roundedRating < 1 || roundedRating > 5) {
        return new Response("Rating must be between 1 and 5", { status: 400 });
    }

    // Verify map point exists
    const [mapRows] = await db.execute("SELECT id FROM map_points WHERE id = ?", [mapPointId]) as [any[], any];
    if ((mapRows as any[]).length === 0) {
        return new Response("Map point not found", { status: 404 });
    }

    try {
        // Check if user already has a review for this location
        const [existingRows] = await db.execute(
            "SELECT id FROM location_reviews WHERE user_id = ? AND map_point_id = ?",
            [userId, mapPointId]
        ) as [any[], any];

        if (existingRows.length > 0) {
            // Update existing review
            await db.execute(
                "UPDATE location_reviews SET rating = ?, review = ? WHERE user_id = ? AND map_point_id = ?",
                [roundedRating, reviewText, userId, mapPointId]
            );

            // Fetch updated review
            const [updatedRows] = await db.execute(
                "SELECT * FROM location_reviews WHERE user_id = ? AND map_point_id = ?",
                [userId, mapPointId]
            ) as [any[], any];

            return new Response(
                JSON.stringify(toCamelCase(updatedRows[0])),
                { status: 200, headers: { "Content-Type": "application/json" } }
            );
        } else {
            // Insert new review
            await db.execute(
                "INSERT INTO location_reviews (map_point_id, user_id, rating, review) VALUES (?, ?, ?, ?)",
                [mapPointId, userId, roundedRating, reviewText]
            );

            const [idRows] = await db.execute("SELECT LAST_INSERT_ID() as id") as [any[], any];
            const reviewId = idRows[0].id;

            // Fetch created review
            const [reviewRows] = await db.execute(
                "SELECT * FROM location_reviews WHERE id = ?",
                [reviewId]
            ) as [any[], any];

            return new Response(
                JSON.stringify(toCamelCase(reviewRows[0])),
                { status: 201, headers: { "Content-Type": "application/json" } }
            );
        }
    } catch (error) {
        console.error(`Error creating review for location ${mapPointId}:`, error);
        return new Response("Internal server error", { status: 500 });
    }
}




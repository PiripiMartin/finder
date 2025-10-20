import type { BunRequest } from "bun";
import { db } from "../database";
import { verifySessionToken } from "../user/session";
import { fetchPostsForLocation, getRecommendedLocationsWithTopPost, fetchUserLocationEdits, getPersonalFolderIds, getFollowedFolderIds, getFolderLocationsWithTopPost, getUncategorisedSavedLocationsWithTopPost, getSavedLocationsWithTopPost, getSavedLocationsWithTopPostOld } from "./queries";
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
        const personalFolderIds = await getPersonalFolderIds(accountId);
        const followedFolderIds = await getFollowedFolderIds(accountId);

        // Helper: fetch locations with top post for a given folder id
        const fetchFolderLocations = async (folderId: number) => getFolderLocationsWithTopPost(folderId);

        // Helper: fetch uncategorised (in user_saved_locations but not in any folder)
        const fetchUncategorised = async () => getUncategorisedSavedLocationsWithTopPost(accountId);

        // Fetch user location edits once to apply to all results
        const userEdits = await fetchUserLocationEdits(accountId);
        const editsMap = new Map(userEdits.map(edit => [edit.mapPointId, edit]));

        const formatRows = (rows: any[]) => rows.map(row => {
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

        // Build personal folders object
        const personal: any = { uncategorised: [] };
        for (const folderId of personalFolderIds) {
            const rows = await fetchFolderLocations(folderId);
            personal[folderId] = formatRows(rows);
        }
        const uncategorisedRows = await fetchUncategorised();
        personal.uncategorised = formatRows(uncategorisedRows);

        // Build followed folders object
        const followed: any = {};
        for (const folderId of followedFolderIds) {
            const rows = await fetchFolderLocations(folderId);
            followed[folderId] = formatRows(rows);
        }

        const payload = { personal, followed };
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
 * Deletes a location for the authenticated user by removing it from saved locations
 * and setting posted_by to null for all their posts at that location.
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

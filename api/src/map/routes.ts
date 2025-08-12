import type { BunRequest } from "bun";
import { verifySessionToken } from "../user/session";
import { fetchPostsForLocation, getRecommendedLocationsWithTopPost, getSavedLocationsWithTopPost } from "./queries";


/**
 * Fetches the posts for a given map point id
 * 
 * @param req - The request object (Must contain the map point id in the URL path)
 * @returns A response object containing the posts
 */
export async function getPostsForLocation(req: BunRequest): Promise<Response> {

    // First, check user has a valid session
    const sessionToken = req.headers.get("Authorization")?.split(" ")[1];
    if (!sessionToken) {
        return new Response("Missing session token", {status: 401});
    }
    if ((await verifySessionToken(sessionToken)) == null) {
        return new Response("Invalid session token", {status: 401});
    }

    // Then, get the map point id
    const id: number = parseInt((req.params as any).id);
    if (!id) {
        return new Response("Missing map point id", {status: 400});
    }

    const posts = await fetchPostsForLocation(id);

    return new Response(
        JSON.stringify(posts),
        {status: 200, headers: {'Content-Type': 'application/json'}}
    );
}


export async function getSavedLocations(req: BunRequest): Promise<Response> {
    const sessionToken = req.headers.get("Authorization")?.split(" ")[1];
    if (!sessionToken) {
        return new Response("Missing session token", {status: 401});
    }
    const accountId = await verifySessionToken(sessionToken);
    if (accountId == null) {
        return new Response("Invalid session token", {status: 401});
    }

    const savedLocations = await getSavedLocationsWithTopPost(accountId);

    return new Response(
        JSON.stringify(savedLocations),
        {status: 200, headers: {'Content-Type': 'application/json'}}
    );
}

/**
 * Fetches:
 * - The user's saved locations (and their top posts)
 * - The recommended locations near the user's coordinates (and their top posts)
 * 
 * @param req - The request object (Must contain the coordinates in the query parameters as lat and lon)
 * @returns A response object containing the relevant locations
 */
export async function getSavedAndRecommendedLocations(req: BunRequest): Promise<Response> {

    // First, check user has a valid session
    const sessionToken = req.headers.get("Authorization")?.split(" ")[1];
    if (!sessionToken) {
        return new Response("Missing session token", {status: 401});
    }
    const accountId = await verifySessionToken(sessionToken);
    if (accountId == null) {
        return new Response("Invalid session token", {status: 401});
    }

    // Then, get the provided coordinates
    const url = new URL(req.url);
    if (!url.searchParams.has("lat") || !url.searchParams.has("lon")) {
        return new Response("Missing coordinates", {status: 400});
    }

    const latitude = parseFloat(url.searchParams.get("lat") || "0");
    const longitude = parseFloat(url.searchParams.get("lon") || "0");

    const [savedLocations, recommendedLocations] = await Promise.all([
        getSavedLocationsWithTopPost(accountId),
        getRecommendedLocationsWithTopPost(accountId, latitude, longitude)
    ]);

    // Debug logging to ensure no overlap between saved and recommended locations
    const savedIds = new Set(savedLocations.map(loc => loc.location.id));
    const recommendedIds = new Set(recommendedLocations.map(loc => loc.location.id));
    const overlap = [...savedIds].filter(id => recommendedIds.has(id));
    
    //if (overlap.length > 0) {
    //    console.warn(`⚠️ WARNING: Found ${overlap.length} overlapping locations between saved and recommended:`, overlap);
    //    console.warn('This should not happen - locations where user has posted should only appear in saved locations');
    //}

    //console.log(`📊 [getSavedAndRecommendedLocations] Response summary:`, {
    //    accountId,
    //    coordinates: { latitude, longitude },
    //    savedCount: savedLocations.length,
    //    recommendedCount: recommendedLocations.length,
    //    overlapCount: overlap.length,
    //    savedIds: Array.from(savedIds),
    //    recommendedIds: Array.from(recommendedIds)
    //});

    return new Response(
        JSON.stringify({savedLocations, recommendedLocations}), 
        {status: 200, headers: {'Content-Type': 'application/json'}}
    );
}


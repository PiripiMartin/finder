import type { BunRequest } from "bun";
import { db } from "../database";
import { verifySessionToken } from "../user/session";
import { fetchPostsForLocation, getRecommendedLocationsWithTopPost, getSavedLocationsWithTopPost } from "./queries";

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
        const savedLocations = await getSavedLocationsWithTopPost(accountId);
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
 * Blocks a location, preventing it from being recommended to the user.
 *
 * @param req - The Bun request, containing the session token and the location ID.
 * @returns A response indicating success or failure.
 */
export async function blockLocation(req: BunRequest): Promise<Response> {
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
        await db.execute("UPDATE map_points SET recommendable = FALSE WHERE id = ?", [id]);
        return new Response(null, { status: 204 });
    } catch (error) {
        console.error(`Error blocking location ${id} for account ${accountId}:`, error);
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

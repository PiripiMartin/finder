import type { BunRequest } from "bun";
import { verifySessionToken } from "../user/session";
import { checkedExtractBody } from "../utils";
import { 
    addLocationToFolder, 
    removeLocationFromFolder, 
    followFolder, 
    unfollowFolder,
    isFollowingFolder,
    isLocationInFolder,
    getFoldersByCreator,
    getFollowedFolders,
    getLocationsInFolder,
    getFolderById,
    createFolder,
    type CreateFolderRequest
} from "./queries";

/**
 * Creates a new folder.
 *
 * @param req - The Bun request, containing the session token and folder data.
 * @returns A response containing the created folder or an error message.
 */
export async function createFolderEndpoint(req: BunRequest): Promise<Response> {
    const sessionToken = req.headers.get("Authorization")?.split(" ")[1];
    if (!sessionToken) {
        return new Response("Missing or malformed session token", { status: 401 });
    }

    const userId = await verifySessionToken(sessionToken);
    if (userId === null) {
        return new Response("Invalid or expired session token", { status: 401 });
    }

    const data = await checkedExtractBody(req, ["name", "color"]);
    if (!data) {
        return new Response("Missing name or color in request body", { status: 400 });
    }

    // Validate input
    if (!data.name || typeof data.name !== "string" || data.name.trim().length === 0) {
        return new Response("Name is required and must be a non-empty string", { status: 400 });
    }

    if (!data.color || typeof data.color !== "string" || data.color.trim().length === 0) {
        return new Response("Color is required and must be a non-empty string", { status: 400 });
    }

    // Validate name length (max 100 characters as per schema)
    if (data.name.length > 100) {
        return new Response("Name must be 100 characters or less", { status: 400 });
    }

    // Validate color length (max 16 characters as per schema)
    if (data.color.length > 16) {
        return new Response("Color must be 16 characters or less", { status: 400 });
    }

    try {
        const folderData: CreateFolderRequest = {
            name: data.name.trim(),
            color: data.color.trim()
        };

        const folder = await createFolder(userId, folderData);
        
        return new Response(
            JSON.stringify(folder),
            { status: 201, headers: { "Content-Type": "application/json" } }
        );
    } catch (error) {
        console.error(`Error creating folder for user ${userId}:`, error);
        return new Response("Internal server error", { status: 500 });
    }
}

/**
 * Adds a location to a folder.
 *
 * @param req - The Bun request, containing the session token, folder ID, and location ID.
 * @returns A response indicating success or failure.
 */
export async function addLocationToFolderEndpoint(req: BunRequest): Promise<Response> {
    const sessionToken = req.headers.get("Authorization")?.split(" ")[1];
    if (!sessionToken) {
        return new Response("Missing or malformed session token", { status: 401 });
    }

    const userId = await verifySessionToken(sessionToken);
    if (userId === null) {
        return new Response("Invalid or expired session token", { status: 401 });
    }

    const folderId = parseInt((req.params as any).folderId, 10);
    if (isNaN(folderId)) {
        return new Response("Invalid folder ID", { status: 400 });
    }

    const data = await checkedExtractBody(req, ["mapPointId"]);
    if (!data) {
        return new Response("Missing mapPointId in request body", { status: 400 });
    }

    const mapPointId = parseInt(data.mapPointId, 10);
    if (isNaN(mapPointId)) {
        return new Response("Invalid mapPointId", { status: 400 });
    }

    try {
        // Verify the folder exists and user has access to it
        const folder = await getFolderById(folderId);
        if (!folder) {
            return new Response("Folder not found", { status: 404 });
        }

        // Check if user is the creator or follows the folder
        const isCreator = folder.creatorId === userId;
        const isFollowing = await isFollowingFolder(userId, folderId);
        
        if (!isCreator && !isFollowing) {
            return new Response("You don't have permission to add locations to this folder", { status: 403 });
        }

        await addLocationToFolder(folderId, mapPointId);
        
        return new Response(
            JSON.stringify({ success: true, message: "Location added to folder" }),
            { status: 200, headers: { "Content-Type": "application/json" } }
        );
    } catch (error) {
        console.error(`Error adding location ${mapPointId} to folder ${folderId}:`, error);
        return new Response("Internal server error", { status: 500 });
    }
}

/**
 * Removes a location from a folder.
 *
 * @param req - The Bun request, containing the session token, folder ID, and location ID.
 * @returns A response indicating success or failure.
 */
export async function removeLocationFromFolderEndpoint(req: BunRequest): Promise<Response> {
    const sessionToken = req.headers.get("Authorization")?.split(" ")[1];
    if (!sessionToken) {
        return new Response("Missing or malformed session token", { status: 401 });
    }

    const userId = await verifySessionToken(sessionToken);
    if (userId === null) {
        return new Response("Invalid or expired session token", { status: 401 });
    }

    const folderId = parseInt((req.params as any).folderId, 10);
    if (isNaN(folderId)) {
        return new Response("Invalid folder ID", { status: 400 });
    }

    const mapPointId = parseInt((req.params as any).mapPointId, 10);
    if (isNaN(mapPointId)) {
        return new Response("Invalid mapPointId", { status: 400 });
    }

    try {
        // Verify the folder exists and user has access to it
        const folder = await getFolderById(folderId);
        if (!folder) {
            return new Response("Folder not found", { status: 404 });
        }

        // Check if user is the creator or follows the folder
        const isCreator = folder.creatorId === userId;
        const isFollowing = await isFollowingFolder(userId, folderId);
        
        if (!isCreator && !isFollowing) {
            return new Response("You don't have permission to remove locations from this folder", { status: 403 });
        }

        await removeLocationFromFolder(folderId, mapPointId);
        
        return new Response(
            JSON.stringify({ success: true, message: "Location removed from folder" }),
            { status: 200, headers: { "Content-Type": "application/json" } }
        );
    } catch (error) {
        console.error(`Error removing location ${mapPointId} from folder ${folderId}:`, error);
        return new Response("Internal server error", { status: 500 });
    }
}

/**
 * Follows a folder.
 *
 * @param req - The Bun request, containing the session token and folder ID.
 * @returns A response indicating success or failure.
 */
export async function followFolderEndpoint(req: BunRequest): Promise<Response> {
    const sessionToken = req.headers.get("Authorization")?.split(" ")[1];
    if (!sessionToken) {
        return new Response("Missing or malformed session token", { status: 401 });
    }

    const userId = await verifySessionToken(sessionToken);
    if (userId === null) {
        return new Response("Invalid or expired session token", { status: 401 });
    }

    const folderId = parseInt((req.params as any).folderId, 10);
    if (isNaN(folderId)) {
        return new Response("Invalid folder ID", { status: 400 });
    }

    try {
        // Verify the folder exists
        const folder = await getFolderById(folderId);
        if (!folder) {
            return new Response("Folder not found", { status: 404 });
        }

        // Check if user is already following
        const alreadyFollowing = await isFollowingFolder(userId, folderId);
        if (alreadyFollowing) {
            return new Response("You are already following this folder", { status: 400 });
        }

        await followFolder(userId, folderId);
        
        return new Response(
            JSON.stringify({ success: true, message: "Folder followed successfully" }),
            { status: 200, headers: { "Content-Type": "application/json" } }
        );
    } catch (error) {
        console.error(`Error following folder ${folderId}:`, error);
        return new Response("Internal server error", { status: 500 });
    }
}

/**
 * Unfollows a folder.
 *
 * @param req - The Bun request, containing the session token and folder ID.
 * @returns A response indicating success or failure.
 */
export async function unfollowFolderEndpoint(req: BunRequest): Promise<Response> {
    const sessionToken = req.headers.get("Authorization")?.split(" ")[1];
    if (!sessionToken) {
        return new Response("Missing or malformed session token", { status: 401 });
    }

    const userId = await verifySessionToken(sessionToken);
    if (userId === null) {
        return new Response("Invalid or expired session token", { status: 401 });
    }

    const folderId = parseInt((req.params as any).folderId, 10);
    if (isNaN(folderId)) {
        return new Response("Invalid folder ID", { status: 400 });
    }

    try {
        // Check if user is following the folder
        const isFollowing = await isFollowingFolder(userId, folderId);
        if (!isFollowing) {
            return new Response("You are not following this folder", { status: 400 });
        }

        await unfollowFolder(userId, folderId);
        
        return new Response(
            JSON.stringify({ success: true, message: "Folder unfollowed successfully" }),
            { status: 200, headers: { "Content-Type": "application/json" } }
        );
    } catch (error) {
        console.error(`Error unfollowing folder ${folderId}:`, error);
        return new Response("Internal server error", { status: 500 });
    }
}

/**
 * Gets all folders created by the user.
 *
 * @param req - The Bun request, containing the session token.
 * @returns A response containing the folders or an error message.
 */
export async function getCreatedFolders(req: BunRequest): Promise<Response> {
    const sessionToken = req.headers.get("Authorization")?.split(" ")[1];
    if (!sessionToken) {
        return new Response("Missing or malformed session token", { status: 401 });
    }

    const userId = await verifySessionToken(sessionToken);
    if (userId === null) {
        return new Response("Invalid or expired session token", { status: 401 });
    }

    try {
        const folders = await getFoldersByCreator(userId);
        return new Response(
            JSON.stringify(folders),
            { status: 200, headers: { "Content-Type": "application/json" } }
        );
    } catch (error) {
        console.error(`Error fetching created folders for user ${userId}:`, error);
        return new Response("Internal server error", { status: 500 });
    }
}

/**
 * Gets all folders followed by the user.
 *
 * @param req - The Bun request, containing the session token.
 * @returns A response containing the folders or an error message.
 */
export async function getFollowedFoldersEndpoint(req: BunRequest): Promise<Response> {
    const sessionToken = req.headers.get("Authorization")?.split(" ")[1];
    if (!sessionToken) {
        return new Response("Missing or malformed session token", { status: 401 });
    }

    const userId = await verifySessionToken(sessionToken);
    if (userId === null) {
        return new Response("Invalid or expired session token", { status: 401 });
    }

    try {
        const folders = await getFollowedFolders(userId);
        return new Response(
            JSON.stringify(folders),
            { status: 200, headers: { "Content-Type": "application/json" } }
        );
    } catch (error) {
        console.error(`Error fetching followed folders for user ${userId}:`, error);
        return new Response("Internal server error", { status: 500 });
    }
}

/**
 * Gets all locations in a folder.
 *
 * @param req - The Bun request, containing the session token and folder ID.
 * @returns A response containing the location IDs or an error message.
 */
export async function getFolderLocations(req: BunRequest): Promise<Response> {
    const sessionToken = req.headers.get("Authorization")?.split(" ")[1];
    if (!sessionToken) {
        return new Response("Missing or malformed session token", { status: 401 });
    }

    const userId = await verifySessionToken(sessionToken);
    if (userId === null) {
        return new Response("Invalid or expired session token", { status: 401 });
    }

    const folderId = parseInt((req.params as any).folderId, 10);
    if (isNaN(folderId)) {
        return new Response("Invalid folder ID", { status: 400 });
    }

    try {
        // Verify the folder exists and user has access to it
        const folder = await getFolderById(folderId);
        if (!folder) {
            return new Response("Folder not found", { status: 404 });
        }

        // Check if user is the creator or follows the folder
        const isCreator = folder.creatorId === userId;
        const isFollowing = await isFollowingFolder(userId, folderId);
        
        if (!isCreator && !isFollowing) {
            return new Response("You don't have permission to view this folder", { status: 403 });
        }

        const locationIds = await getLocationsInFolder(folderId);
        return new Response(
            JSON.stringify({ locationIds }),
            { status: 200, headers: { "Content-Type": "application/json" } }
        );
    } catch (error) {
        console.error(`Error fetching locations for folder ${folderId}:`, error);
        return new Response("Internal server error", { status: 500 });
    }
}

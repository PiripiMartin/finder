import type { BunRequest } from "bun";
import { verifySessionToken } from "../user/session";
import { checkedExtractBody } from "../utils";
import { 
    addLocationToFolder, 
    addLocationsToFolder,
    removeLocationFromFolder, 
    followFolder, 
    unfollowFolder,
    isFollowingFolder,
    isLocationInFolder,
    getFoldersByOwner,
    getFollowedFolders,
    getLocationsInFolder,
    getFolderById,
    createFolder,
    addFolderOwner,
    removeFolderOwner,
    isFolderOwner,
    getFolderOwners,
    type CreateFolderRequest,
    updateFolder,
    deleteFolder
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
 * Updates a folder (name/color). Only the creator can edit.
 */
export async function editFolderEndpoint(req: BunRequest): Promise<Response> {
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

    const data = await checkedExtractBody(req, []);
    if (!data) {
        return new Response("Missing body", { status: 400 });
    }

    const updates: Partial<CreateFolderRequest> = {};
    if (typeof data.name === "string") {
        const name = data.name.trim();
        if (name.length === 0 || name.length > 100) {
            return new Response("Name must be 1-100 characters", { status: 400 });
        }
        updates.name = name;
    }
    if (typeof data.color === "string") {
        const color = data.color.trim();
        if (color.length === 0 || color.length > 16) {
            return new Response("Color must be 1-16 characters", { status: 400 });
        }
        updates.color = color;
    }

    if (Object.keys(updates).length === 0) {
        return new Response("No valid fields to update", { status: 400 });
    }

    try {
        const folder = await getFolderById(folderId);
        if (!folder) {
            return new Response("Folder not found", { status: 404 });
        }

        // Only creator can edit
        if (folder.creatorId !== userId) {
            return new Response("Only the creator can edit this folder", { status: 403 });
        }

        await updateFolder(folderId, updates);
        const updated = await getFolderById(folderId);
        return new Response(
            JSON.stringify(updated),
            { status: 200, headers: { "Content-Type": "application/json" } }
        );
    } catch (error) {
        console.error(`Error editing folder ${folderId}:`, error);
        return new Response("Internal server error", { status: 500 });
    }
}

/**
 * Deletes a folder. Only the creator can delete.
 */
export async function deleteFolderEndpoint(req: BunRequest): Promise<Response> {
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
        const folder = await getFolderById(folderId);
        if (!folder) {
            return new Response("Folder not found", { status: 404 });
        }

        if (folder.creatorId !== userId) {
            return new Response("Only the creator can delete this folder", { status: 403 });
        }

        await deleteFolder(folderId);
        return new Response(null, { status: 204 });
    } catch (error) {
        console.error(`Error deleting folder ${folderId}:`, error);
        return new Response("Internal server error", { status: 500 });
    }
}

/**
 * Adds locations to a folder in bulk.
 *
 * @param req - The Bun request, containing the session token, folder ID in path, and locationIds array in body.
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

    const data = await checkedExtractBody(req, ["locationIds"]);
    if (!data) {
        return new Response("Missing locationIds in request body", { status: 400 });
    }

    // Validate locationIds is an array
    if (!Array.isArray(data.locationIds)) {
        return new Response("locationIds must be an array", { status: 400 });
    }

    // Validate that all locationIds are valid numbers
    const locationIds = data.locationIds.map((id: any) => parseInt(id, 10));
    if (locationIds.some(isNaN)) {
        return new Response("All locationIds must be valid numbers", { status: 400 });
    }

    if (locationIds.length === 0) {
        return new Response("At least one locationId must be provided", { status: 400 });
    }

    try {
        // Verify the folder exists and user has access to it
        const folder = await getFolderById(folderId);
        if (!folder) {
            return new Response("Folder not found", { status: 404 });
        }

        // Check if user is an owner or follows the folder
        const isOwner = await isFolderOwner(userId, folderId);
        
        if (!isOwner) {
            return new Response("You don't have permission to add locations to this folder", { status: 403 });
        }

        await addLocationsToFolder(folderId, locationIds);
        
        return new Response(
            JSON.stringify({ 
                success: true, 
                message: `${locationIds.length} location(s) added to folder`,
                addedCount: locationIds.length
            }),
            { status: 200, headers: { "Content-Type": "application/json" } }
        );
    } catch (error) {
        console.error(`Error adding locations to folder ${folderId}:`, error);
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

        // Check if user is an owner or follows the folder
        const isOwner = await isFolderOwner(userId, folderId);
        
        if (!isOwner) {
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
 * Gets all folders owned by the user.
 *
 * @param req - The Bun request, containing the session token.
 * @returns A response containing the folders or an error message.
 */
export async function getOwnedFolders(req: BunRequest): Promise<Response> {
    const sessionToken = req.headers.get("Authorization")?.split(" ")[1];
    if (!sessionToken) {
        return new Response("Missing or malformed session token", { status: 401 });
    }

    const userId = await verifySessionToken(sessionToken);
    if (userId === null) {
        return new Response("Invalid or expired session token", { status: 401 });
    }

    try {
        const folders = await getFoldersByOwner(userId);
        return new Response(
            JSON.stringify(folders),
            { status: 200, headers: { "Content-Type": "application/json" } }
        );
    } catch (error) {
        console.error(`Error fetching owned folders for user ${userId}:`, error);
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

        // Check if user is an owner or follows the folder
        const isOwner = await isFolderOwner(userId, folderId);
        const isFollowing = await isFollowingFolder(userId, folderId);
        
        if (!isOwner && !isFollowing) {
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

/**
 * Adds an owner to a folder.
 *
 * @param req - The Bun request, containing the session token, folder ID, and user ID.
 * @returns A response indicating success or failure.
 */
export async function addFolderOwnerEndpoint(req: BunRequest): Promise<Response> {
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

    const data = await checkedExtractBody(req, ["newOwnerId"]);
    if (!data) {
        return new Response("Missing newOwnerId in request body", { status: 400 });
    }

    const newOwnerId = parseInt(data.newOwnerId, 10);
    if (isNaN(newOwnerId)) {
        return new Response("Invalid newOwnerId", { status: 400 });
    }

    try {
        // Verify the folder exists and user is an owner
        const folder = await getFolderById(folderId);
        if (!folder) {
            return new Response("Folder not found", { status: 404 });
        }

        const isOwner = await isFolderOwner(userId, folderId);
        if (!isOwner) {
            return new Response("You don't have permission to add owners to this folder", { status: 403 });
        }

        // Check if the new owner is already an owner
        const isAlreadyOwner = await isFolderOwner(newOwnerId, folderId);
        if (isAlreadyOwner) {
            return new Response("User is already an owner of this folder", { status: 400 });
        }

        await addFolderOwner(folderId, newOwnerId);
        
        return new Response(
            JSON.stringify({ success: true, message: "Owner added to folder" }),
            { status: 200, headers: { "Content-Type": "application/json" } }
        );
    } catch (error) {
        console.error(`Error adding owner ${newOwnerId} to folder ${folderId}:`, error);
        return new Response("Internal server error", { status: 500 });
    }
}

/**
 * Removes an owner from a folder.
 *
 * @param req - The Bun request, containing the session token, folder ID, and user ID.
 * @returns A response indicating success or failure.
 */
export async function removeFolderOwnerEndpoint(req: BunRequest): Promise<Response> {
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

    const data = await checkedExtractBody(req, ["ownerId"]);
    if (!data) {
        return new Response("Missing ownerId in request body", { status: 400 });
    }

    const ownerId = parseInt(data.ownerId, 10);
    if (isNaN(ownerId)) {
        return new Response("Invalid ownerId", { status: 400 });
    }

    try {
        // Verify the folder exists and user is an owner
        const folder = await getFolderById(folderId);
        if (!folder) {
            return new Response("Folder not found", { status: 404 });
        }

        const isOwner = await isFolderOwner(userId, folderId);
        if (!isOwner) {
            return new Response("You don't have permission to remove owners from this folder", { status: 403 });
        }

        // Check if the owner to remove is actually an owner
        const isTargetOwner = await isFolderOwner(ownerId, folderId);
        if (!isTargetOwner) {
            return new Response("User is not an owner of this folder", { status: 400 });
        }

        // Prevent removing the last owner
        const owners = await getFolderOwners(folderId);
        if (owners.length <= 1) {
            return new Response("Cannot remove the last owner from a folder", { status: 400 });
        }

        await removeFolderOwner(folderId, ownerId);
        
        return new Response(
            JSON.stringify({ success: true, message: "Owner removed from folder" }),
            { status: 200, headers: { "Content-Type": "application/json" } }
        );
    } catch (error) {
        console.error(`Error removing owner ${ownerId} from folder ${folderId}:`, error);
        return new Response("Internal server error", { status: 500 });
    }
}

/**
 * Gets all owners of a folder.
 *
 * @param req - The Bun request, containing the session token and folder ID.
 * @returns A response containing the owner IDs or an error message.
 */
export async function getFolderOwnersEndpoint(req: BunRequest): Promise<Response> {
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

        // Check if user is an owner or follows the folder
        const isOwner = await isFolderOwner(userId, folderId);
        const isFollowing = await isFollowingFolder(userId, folderId);
        
        if (!isOwner && !isFollowing) {
            return new Response("You don't have permission to view this folder's owners", { status: 403 });
        }

        const owners = await getFolderOwners(folderId);
        return new Response(
            JSON.stringify({ owners }),
            { status: 200, headers: { "Content-Type": "application/json" } }
        );
    } catch (error) {
        console.error(`Error fetching owners for folder ${folderId}:`, error);
        return new Response("Internal server error", { status: 500 });
    }
}

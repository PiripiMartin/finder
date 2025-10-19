import { db, toCamelCase } from "../database";

/**
 * Interface for a folder
 */
export interface Folder {
    id: number;
    creatorId: number | null;
    name: string;
    color: string;
    createdAt: Date;
}

/**
 * Interface for creating a new folder
 */
export interface CreateFolderRequest {
    name: string;
    color: string;
}

/**
 * Interface for folder location relationship
 */
export interface FolderLocation {
    folderId: number;
    mapPointId: number;
}

/**
 * Interface for folder follow relationship
 */
export interface FolderFollow {
    userId: number;
    folderId: number;
}

/**
 * Adds a location to a folder.
 *
 * @param folderId - The ID of the folder.
 * @param mapPointId - The ID of the map point to add.
 * @returns A promise that resolves when the location is added.
 */
export async function addLocationToFolder(folderId: number, mapPointId: number): Promise<void> {
    const query = `
        INSERT IGNORE INTO folder_locations (folder_id, map_point_id)
        VALUES (?, ?)
    `;
    await db.execute(query, [folderId, mapPointId]);
}

/**
 * Removes a location from a folder.
 *
 * @param folderId - The ID of the folder.
 * @param mapPointId - The ID of the map point to remove.
 * @returns A promise that resolves when the location is removed.
 */
export async function removeLocationFromFolder(folderId: number, mapPointId: number): Promise<void> {
    const query = `
        DELETE FROM folder_locations 
        WHERE folder_id = ? AND map_point_id = ?
    `;
    await db.execute(query, [folderId, mapPointId]);
}

/**
 * Follows a folder.
 *
 * @param userId - The ID of the user.
 * @param folderId - The ID of the folder to follow.
 * @returns A promise that resolves when the folder is followed.
 */
export async function followFolder(userId: number, folderId: number): Promise<void> {
    const query = `
        INSERT IGNORE INTO folder_follows (user_id, folder_id)
        VALUES (?, ?)
    `;
    await db.execute(query, [userId, folderId]);
}

/**
 * Unfollows a folder.
 *
 * @param userId - The ID of the user.
 * @param folderId - The ID of the folder to unfollow.
 * @returns A promise that resolves when the folder is unfollowed.
 */
export async function unfollowFolder(userId: number, folderId: number): Promise<void> {
    const query = `
        DELETE FROM folder_follows 
        WHERE user_id = ? AND folder_id = ?
    `;
    await db.execute(query, [userId, folderId]);
}

/**
 * Checks if a user is following a folder.
 *
 * @param userId - The ID of the user.
 * @param folderId - The ID of the folder.
 * @returns A promise that resolves to true if the user is following the folder, false otherwise.
 */
export async function isFollowingFolder(userId: number, folderId: number): Promise<boolean> {
    const query = `
        SELECT 1 FROM folder_follows 
        WHERE user_id = ? AND folder_id = ?
        LIMIT 1
    `;
    const [rows] = await db.execute(query, [userId, folderId]) as [any[], any];
    return rows.length > 0;
}

/**
 * Checks if a location is in a folder.
 *
 * @param folderId - The ID of the folder.
 * @param mapPointId - The ID of the map point.
 * @returns A promise that resolves to true if the location is in the folder, false otherwise.
 */
export async function isLocationInFolder(folderId: number, mapPointId: number): Promise<boolean> {
    const query = `
        SELECT 1 FROM folder_locations 
        WHERE folder_id = ? AND map_point_id = ?
        LIMIT 1
    `;
    const [rows] = await db.execute(query, [folderId, mapPointId]) as [any[], any];
    return rows.length > 0;
}

/**
 * Gets all folders created by a user.
 *
 * @param userId - The ID of the user.
 * @returns A promise that resolves to an array of folders.
 */
export async function getFoldersByCreator(userId: number): Promise<Folder[]> {
    const query = `
        SELECT * FROM folders 
        WHERE creator_id = ?
        ORDER BY created_at DESC
    `;
    const [rows] = await db.execute(query, [userId]) as [any[], any];
    return toCamelCase(rows) as Folder[];
}

/**
 * Gets all folders followed by a user.
 *
 * @param userId - The ID of the user.
 * @returns A promise that resolves to an array of folders.
 */
export async function getFollowedFolders(userId: number): Promise<Folder[]> {
    const query = `
        SELECT f.* FROM folders f
        INNER JOIN folder_follows ff ON f.id = ff.folder_id
        WHERE ff.user_id = ?
        ORDER BY f.created_at DESC
    `;
    const [rows] = await db.execute(query, [userId]) as [any[], any];
    return toCamelCase(rows) as Folder[];
}

/**
 * Gets all locations in a folder.
 *
 * @param folderId - The ID of the folder.
 * @returns A promise that resolves to an array of map point IDs.
 */
export async function getLocationsInFolder(folderId: number): Promise<number[]> {
    const query = `
        SELECT map_point_id FROM folder_locations 
        WHERE folder_id = ?
        ORDER BY map_point_id
    `;
    const [rows] = await db.execute(query, [folderId]) as [any[], any];
    return rows.map(row => row.map_point_id);
}

/**
 * Creates a new folder.
 *
 * @param userId - The ID of the user creating the folder.
 * @param folderData - The folder data.
 * @returns A promise that resolves to the created folder.
 */
export async function createFolder(userId: number, folderData: CreateFolderRequest): Promise<Folder> {
    const query = `
        INSERT INTO folders (creator_id, name, color)
        VALUES (?, ?, ?)
    `;
    await db.execute(query, [userId, folderData.name, folderData.color]);

    const [idRows] = await db.execute("SELECT LAST_INSERT_ID() as id") as [any[], any];
    const folderId = idRows[0].id;

    const [rows] = await db.execute("SELECT * FROM folders WHERE id = ?", [folderId]) as [any[], any];
    return toCamelCase(rows[0]) as Folder;
}

/**
 * Gets folder details by ID.
 *
 * @param folderId - The ID of the folder.
 * @returns A promise that resolves to the folder or null if not found.
 */
export async function getFolderById(folderId: number): Promise<Folder | null> {
    const query = `
        SELECT * FROM folders 
        WHERE id = ?
    `;
    const [rows] = await db.execute(query, [folderId]) as [any[], any];
    if (rows.length === 0) {
        return null;
    }
    return toCamelCase(rows[0]) as Folder;
}

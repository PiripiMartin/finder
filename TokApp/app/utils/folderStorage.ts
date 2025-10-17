import AsyncStorage from '@react-native-async-storage/async-storage';

const FOLDERS_STORAGE_KEY = '@saved_location_folders';

export interface Folder {
  id: string;
  title: string;
  color: string;
  locationIds: number[];
  createdAt: string;
}

/**
 * Generate a unique folder ID
 */
function generateFolderId(): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 15);
  return `folder-${timestamp}-${random}`;
}

/**
 * Load all folders from AsyncStorage
 */
export async function loadFolders(): Promise<Folder[]> {
  try {
    const foldersString = await AsyncStorage.getItem(FOLDERS_STORAGE_KEY);
    if (foldersString) {
      const folders = JSON.parse(foldersString);
      console.log('📂 [Folders] Loaded folders:', folders.length);
      return Array.isArray(folders) ? folders : [];
    }
    console.log('📂 [Folders] No saved folders found');
    return [];
  } catch (error) {
    console.error('❌ [Folders] Error loading folders:', error);
    return [];
  }
}

/**
 * Save folders to AsyncStorage
 */
export async function saveFolders(folders: Folder[]): Promise<void> {
  try {
    const foldersString = JSON.stringify(folders);
    await AsyncStorage.setItem(FOLDERS_STORAGE_KEY, foldersString);
    console.log('💾 [Folders] Saved folders:', folders.length);
  } catch (error) {
    console.error('❌ [Folders] Error saving folders:', error);
  }
}

/**
 * Create a new folder
 */
export async function createFolder(title: string, color: string): Promise<Folder> {
  const newFolder: Folder = {
    id: generateFolderId(),
    title: title.trim().substring(0, 30), // Max 30 chars
    color,
    locationIds: [],
    createdAt: new Date().toISOString(),
  };

  const folders = await loadFolders();
  folders.push(newFolder);
  await saveFolders(folders);

  console.log('✅ [Folders] Created folder:', newFolder.id);
  return newFolder;
}

/**
 * Delete a folder
 */
export async function deleteFolder(folderId: string): Promise<void> {
  const folders = await loadFolders();
  const updatedFolders = folders.filter(f => f.id !== folderId);
  await saveFolders(updatedFolders);
  console.log('🗑️ [Folders] Deleted folder:', folderId);
}

/**
 * Update folder properties (title, color)
 */
export async function updateFolder(
  folderId: string,
  updates: Partial<Pick<Folder, 'title' | 'color'>>
): Promise<void> {
  const folders = await loadFolders();
  const folderIndex = folders.findIndex(f => f.id === folderId);
  
  if (folderIndex !== -1) {
    if (updates.title !== undefined) {
      folders[folderIndex].title = updates.title.trim().substring(0, 30);
    }
    if (updates.color !== undefined) {
      folders[folderIndex].color = updates.color;
    }
    await saveFolders(folders);
    console.log('✏️ [Folders] Updated folder:', folderId);
  }
}

/**
 * Add a location to a folder (removes from other folders first)
 */
export async function addLocationToFolder(folderId: string, locationId: number): Promise<void> {
  const folders = await loadFolders();
  
  // Remove location from all other folders first
  folders.forEach(folder => {
    folder.locationIds = folder.locationIds.filter(id => id !== locationId);
  });
  
  // Add to target folder
  const targetFolder = folders.find(f => f.id === folderId);
  if (targetFolder && !targetFolder.locationIds.includes(locationId)) {
    targetFolder.locationIds.push(locationId);
  }
  
  await saveFolders(folders);
  console.log('➕ [Folders] Added location', locationId, 'to folder', folderId);
}

/**
 * Remove a location from a folder
 */
export async function removeLocationFromFolder(folderId: string, locationId: number): Promise<void> {
  const folders = await loadFolders();
  const folder = folders.find(f => f.id === folderId);
  
  if (folder) {
    folder.locationIds = folder.locationIds.filter(id => id !== locationId);
    await saveFolders(folders);
    console.log('➖ [Folders] Removed location', locationId, 'from folder', folderId);
  }
}

/**
 * Get a specific folder by ID
 */
export async function getFolder(folderId: string): Promise<Folder | null> {
  const folders = await loadFolders();
  return folders.find(f => f.id === folderId) || null;
}

/**
 * Get all location IDs that are in folders
 */
export async function getFiledLocationIds(): Promise<number[]> {
  const folders = await loadFolders();
  const filedIds = new Set<number>();
  
  folders.forEach(folder => {
    folder.locationIds.forEach(id => filedIds.add(id));
  });
  
  return Array.from(filedIds);
}

/**
 * Clear all folders
 */
export async function clearAllFolders(): Promise<void> {
  try {
    await AsyncStorage.removeItem(FOLDERS_STORAGE_KEY);
    console.log('🗑️ [Folders] Cleared all folders');
  } catch (error) {
    console.error('❌ [Folders] Error clearing folders:', error);
  }
}


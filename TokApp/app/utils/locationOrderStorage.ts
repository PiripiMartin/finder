import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = '@saved_locations_order';

interface SavedLocation {
  location: {
    id: number;
    title: string;
    description: string;
    emoji: string;
    latitude: number | null;
    longitude: number | null;
    isValidLocation: number;
    websiteUrl: string | null;
    phoneNumber: string | null;
    address: string | null;
    createdAt: string;
  };
  topPost: {
    id: number;
    url: string;
    postedBy: number;
    mapPointId: number;
    postedAt: string;
  };
}

/**
 * Save the custom order of location IDs to AsyncStorage
 */
export async function saveLocationOrder(locationIds: number[]): Promise<void> {
  try {
    const orderString = JSON.stringify(locationIds);
    await AsyncStorage.setItem(STORAGE_KEY, orderString);
    console.log('💾 [LocationOrder] Saved order:', locationIds);
  } catch (error) {
    console.error('❌ [LocationOrder] Error saving order:', error);
  }
}

/**
 * Load the custom order of location IDs from AsyncStorage
 */
export async function loadLocationOrder(): Promise<number[]> {
  try {
    const orderString = await AsyncStorage.getItem(STORAGE_KEY);
    if (orderString) {
      const order = JSON.parse(orderString);
      console.log('📂 [LocationOrder] Loaded order:', order);
      
      // Handle new folder format: extract unfiledLocations array
      if (order && typeof order === 'object' && order.unfiledLocations) {
        console.log('📂 [LocationOrder] Using unfiled locations from folder structure');
        return order.unfiledLocations || [];
      }
      
      // Handle old format: simple array
      if (Array.isArray(order)) {
        return order;
      }
      
      return [];
    }
    console.log('📂 [LocationOrder] No saved order found');
    return [];
  } catch (error) {
    console.error('❌ [LocationOrder] Error loading order:', error);
    return [];
  }
}

/**
 * Sort locations array based on saved custom order
 * New locations (not in saved order) are appended to the end
 * Locations in saved order but not in current list are ignored
 */
export function applySavedOrder(
  locations: SavedLocation[],
  savedOrder: number[] | undefined
): SavedLocation[] {
  // Handle undefined or empty order
  if (!savedOrder || !Array.isArray(savedOrder) || savedOrder.length === 0) {
    return locations;
  }

  // Create a map for quick lookup
  const locationMap = new Map<number, SavedLocation>();
  locations.forEach(loc => {
    locationMap.set(loc.location.id, loc);
  });

  // Build sorted array based on saved order
  const sorted: SavedLocation[] = [];
  const processedIds = new Set<number>();

  // First, add locations in the saved order
  savedOrder.forEach(id => {
    const location = locationMap.get(id);
    if (location) {
      sorted.push(location);
      processedIds.add(id);
    }
  });

  // Then, append any new locations that weren't in the saved order
  locations.forEach(location => {
    if (!processedIds.has(location.location.id)) {
      sorted.push(location);
    }
  });

  console.log('🔄 [LocationOrder] Applied order - sorted:', sorted.length, 'locations');
  return sorted;
}

/**
 * Clear the saved location order
 */
export async function clearLocationOrder(): Promise<void> {
  try {
    await AsyncStorage.removeItem(STORAGE_KEY);
    console.log('🗑️ [LocationOrder] Cleared saved order');
  } catch (error) {
    console.error('❌ [LocationOrder] Error clearing order:', error);
  }
}


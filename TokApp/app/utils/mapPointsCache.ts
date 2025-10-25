import AsyncStorage from '@react-native-async-storage/async-storage';
import { MapPoint } from '../mapData';

const MAP_POINTS_CACHE_KEY = '@cached_map_points';
const CACHE_TIMESTAMP_KEY = '@map_points_cache_timestamp';

export interface CachedMapData {
  savedLocations: any[];
  recommendedLocations: any[];
  transformedMapPoints: MapPoint[];
  timestamp: number;
}

/**
 * Save map points to cache
 */
export async function cacheMapPoints(data: CachedMapData): Promise<void> {
  try {
    const cacheData = {
      ...data,
      timestamp: Date.now(),
    };
    
    await AsyncStorage.setItem(MAP_POINTS_CACHE_KEY, JSON.stringify(cacheData));
    console.log('💾 [MapCache] Cached map points:', {
      savedLocations: data.savedLocations.length,
      recommendedLocations: data.recommendedLocations.length,
      transformedPoints: data.transformedMapPoints.length,
    });
  } catch (error) {
    console.error('❌ [MapCache] Error caching map points:', error);
  }
}

/**
 * Load cached map points
 */
export async function loadCachedMapPoints(): Promise<CachedMapData | null> {
  try {
    const cachedDataString = await AsyncStorage.getItem(MAP_POINTS_CACHE_KEY);
    
    if (cachedDataString) {
      const cachedData: CachedMapData = JSON.parse(cachedDataString);
      console.log('📦 [MapCache] Loaded cached map points:', {
        savedLocations: cachedData.savedLocations.length,
        recommendedLocations: cachedData.recommendedLocations.length,
        transformedPoints: cachedData.transformedMapPoints.length,
        cacheAge: Math.round((Date.now() - cachedData.timestamp) / 1000) + 's',
      });
      return cachedData;
    }
    
    console.log('📦 [MapCache] No cached data found');
    return null;
  } catch (error) {
    console.error('❌ [MapCache] Error loading cached map points:', error);
    return null;
  }
}

/**
 * Clear cached map points
 */
export async function clearMapPointsCache(): Promise<void> {
  try {
    await AsyncStorage.removeItem(MAP_POINTS_CACHE_KEY);
    console.log('🗑️ [MapCache] Cleared map points cache');
  } catch (error) {
    console.error('❌ [MapCache] Error clearing cache:', error);
  }
}

/**
 * Check if cache exists
 */
export async function hasCachedMapPoints(): Promise<boolean> {
  try {
    const cachedDataString = await AsyncStorage.getItem(MAP_POINTS_CACHE_KEY);
    return cachedDataString !== null;
  } catch (error) {
    console.error('❌ [MapCache] Error checking cache:', error);
    return false;
  }
}

/**
 * Get cache age in milliseconds
 */
export async function getCacheAge(): Promise<number | null> {
  try {
    const cachedDataString = await AsyncStorage.getItem(MAP_POINTS_CACHE_KEY);
    if (cachedDataString) {
      const cachedData: CachedMapData = JSON.parse(cachedDataString);
      return Date.now() - cachedData.timestamp;
    }
    return null;
  } catch (error) {
    console.error('❌ [MapCache] Error getting cache age:', error);
    return null;
  }
}


/**
 * Cache for saved locations API response
 * Shared between map page and saved page to avoid duplicate requests
 */

interface CachedSavedLocationsData {
  data: any;
  timestamp: number;
}

let savedLocationsCache: CachedSavedLocationsData | null = null;
let ongoingFetchPromise: Promise<any> | null = null;
const CACHE_DURATION = 30000; // 30 seconds

/**
 * Get cached saved locations data if available and not expired
 */
export const getCachedSavedLocations = (): any | null => {
  if (!savedLocationsCache) {
    return null;
  }

  const now = Date.now();
  const age = now - savedLocationsCache.timestamp;

  if (age > CACHE_DURATION) {
    // Cache expired
    console.log('🗑️ [SavedLocationsCache] Cache expired');
    savedLocationsCache = null;
    return null;
  }

  console.log(`✅ [SavedLocationsCache] Returning cached data (age: ${age}ms)`);
  return savedLocationsCache.data;
};

/**
 * Cache saved locations data
 */
export const cacheSavedLocations = (data: any): void => {
  savedLocationsCache = {
    data,
    timestamp: Date.now(),
  };
  console.log('💾 [SavedLocationsCache] Data cached');
};

/**
 * Clear the cache manually
 */
export const clearSavedLocationsCache = (): void => {
  savedLocationsCache = null;
  ongoingFetchPromise = null;
  console.log('🗑️ [SavedLocationsCache] Cache cleared manually');
};

/**
 * Fetch saved locations with caching
 * Handles concurrent requests by returning the same promise
 */
export const fetchSavedLocationsWithCache = async (
  apiUrl: string,
  sessionToken: string
): Promise<any> => {
  // Try to get from cache first
  const cached = getCachedSavedLocations();
  if (cached) {
    console.log('✅ [SavedLocationsCache] Cache hit!');
    return cached;
  }

  // If there's already an ongoing fetch, return that promise instead of making a new request
  if (ongoingFetchPromise) {
    console.log('⏳ [SavedLocationsCache] Request already in progress, waiting for it...');
    return ongoingFetchPromise;
  }

  // If not in cache and no ongoing fetch, fetch from API
  console.log('🌐 [SavedLocationsCache] Fetching from API...');
  
  ongoingFetchPromise = (async () => {
    try {
      const response = await fetch(apiUrl, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${sessionToken}`,
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      
      // Cache the response
      cacheSavedLocations(data);
      console.log('✅ [SavedLocationsCache] Fresh data fetched and cached');
      
      return data;
    } finally {
      // Clear the ongoing promise after it completes (success or failure)
      ongoingFetchPromise = null;
    }
  })();

  return ongoingFetchPromise;
};

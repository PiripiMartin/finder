// API Configuration
export const API_CONFIG = {
  // Local API server
  BASE_URL: 'http://localhost:8000/api',
  ENDPOINTS: {
    LOGIN: '/login',
    CREATE_ACCOUNT: '/signup', // Note: API uses /signup, not /create-account
    MAP_POINTS: '/map/1/posts', // Use location ID 1 as default, will be replaced dynamically
    VALIDATE_TOKEN: '/validate-token',
  },
};

// Helper function to build full API URLs
export const buildApiUrl = (endpoint: string): string => {
  return `${API_CONFIG.BASE_URL}${endpoint}`;
};

// Helper function to get full endpoint URLs
export const getApiUrl = (endpointKey: keyof typeof API_CONFIG.ENDPOINTS): string => {
  return buildApiUrl(API_CONFIG.ENDPOINTS[endpointKey]);
};

// Helper function to get map points URL with specific location ID
export const getMapPointsUrl = (locationId: number): string => {
  return `${API_CONFIG.BASE_URL}/map/${locationId}/posts`;
};

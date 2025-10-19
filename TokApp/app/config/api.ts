// API Configuration
export const API_CONFIG = {
  // Production API server
  BASE_URL: 'https://ptvalert.xyz/api',
  //BASE_URL: 'http://127.0.0.1:8000/api',
  ENDPOINTS: {
    LOGIN: '/login',
    CREATE_ACCOUNT: '/signup', // Note: API uses /signup, not /create-account
    MAP_POINTS: '/map/saved-and-recommended', 
    VALIDATE_TOKEN: '/validate-token',
    PROFILE: '/profile',
    GUEST_POSTS: '/map/guest-posts',
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

// Helper function to get guest posts URL with coordinates
export const getGuestPostsUrl = (latitude: number, longitude: number): string => {
  return `${API_CONFIG.BASE_URL}/map/guest-posts?lat=${latitude}&lon=${longitude}`;
};

// Helper function to get edit location URL with specific location ID
export const getEditLocationUrl = (locationId: number): string => {
  return `${API_CONFIG.BASE_URL}/map/edit/${locationId}`;
};

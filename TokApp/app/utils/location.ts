import * as Location from 'expo-location';

export interface Coordinates {
  latitude: number;
  longitude: number;
}

export const getCurrentLocation = async (): Promise<Coordinates | null> => {
  try {
    // Request location permissions
    const { status } = await Location.requestForegroundPermissionsAsync();
    
    if (status !== 'granted') {
      console.log('Location permission denied');
      return null;
    }

    // Get current position
    const location = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });

    return {
      latitude: location.coords.latitude,
      longitude: location.coords.longitude,
    };
  } catch (error) {
    console.error('Error getting location:', error);
    return null;
  }
};

export const getDefaultCoordinates = (): Coordinates => {
  // Default to a central location (you can change this to your app's default location)
  return {
    latitude: 40.7128, // New York City coordinates as default
    longitude: -74.0060,
  };
};

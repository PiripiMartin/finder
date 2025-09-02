import React, { createContext, ReactNode, useContext, useState } from 'react';

export interface StoredLocation {
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

interface LocationContextType {
  savedLocations: StoredLocation[];
  recommendedLocations: StoredLocation[];
  setSavedLocations: (locations: StoredLocation[]) => void;
  setRecommendedLocations: (locations: StoredLocation[]) => void;
  findLocationById: (id: string) => StoredLocation | null;
  refreshLocations: () => void;
  removeLocation: (id: string) => void;
  blockedLocationIds: string[];
  addBlockedLocation: (locationId: string) => void;
}

const LocationContext = createContext<LocationContextType | undefined>(undefined);

export const useLocationContext = () => {
  const context = useContext(LocationContext);
  if (context === undefined) {
    throw new Error('useLocationContext must be used within a LocationProvider');
  }
  return context;
};

interface LocationProviderProps {
  children: ReactNode;
}

export const LocationProvider: React.FC<LocationProviderProps> = ({ children }) => {
  const [savedLocations, setSavedLocations] = useState<StoredLocation[]>([]);
  const [recommendedLocations, setRecommendedLocations] = useState<StoredLocation[]>([]);
  const [blockedLocationIds, setBlockedLocationIds] = useState<string[]>([]);

  const findLocationById = (id: string): StoredLocation | null => {
    // Search in both saved and recommended locations
    const allLocations = [...savedLocations, ...recommendedLocations];
    return allLocations.find(loc => String(loc.location.id) === id) || null;
  };

  const refreshLocations = () => {
    // This function will be called to refresh all locations
    // For now, it's a placeholder that can be implemented later
    // to fetch fresh data from the API
    console.log('Refreshing locations...');
  };

  const removeLocation = (id: string) => {
    // Remove location from both saved and recommended locations
    setSavedLocations(prev => prev.filter(loc => String(loc.location.id) !== id));
    setRecommendedLocations(prev => prev.filter(loc => String(loc.location.id) !== id));
    console.log(`Location ${id} removed from local state`);
  };

  const addBlockedLocation = (locationId: string) => {
    setBlockedLocationIds(prev => [...prev, locationId]);
    console.log(`Location ${locationId} added to blocked list`);
  };

  const value: LocationContextType = {
    savedLocations,
    recommendedLocations,
    setSavedLocations,
    setRecommendedLocations,
    findLocationById,
    refreshLocations,
    removeLocation,
    blockedLocationIds,
    addBlockedLocation,
  };

  return (
    <LocationContext.Provider value={value}>
      {children}
    </LocationContext.Provider>
  );
};

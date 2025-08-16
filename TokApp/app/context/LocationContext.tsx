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

  const findLocationById = (id: string): StoredLocation | null => {
    // Search in both saved and recommended locations
    const allLocations = [...savedLocations, ...recommendedLocations];
    return allLocations.find(loc => String(loc.location.id) === id) || null;
  };

  const value: LocationContextType = {
    savedLocations,
    recommendedLocations,
    setSavedLocations,
    setRecommendedLocations,
    findLocationById,
  };

  return (
    <LocationContext.Provider value={value}>
      {children}
    </LocationContext.Provider>
  );
};
